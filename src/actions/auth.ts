'use server';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { enforce } from '@/lib/rateLimit';
import { subjectFor } from '@/lib/rateLimitRequest';
import { sendEmail, passwordResetEmail } from '@/lib/email';

/**
 * Password reset for credential accounts (merchants and admins).
 *
 * Until now there was none at all: the credentials provider is the only way a
 * merchant signs in, and a forgotten password meant a support ticket with no
 * mechanism behind it.
 *
 * Reset tokens are stored hashed, exactly like passwords. The table is
 * Auth.js's verification_tokens, reused with a `pwreset:` identifier prefix so
 * these can never collide with (or be redeemed as) an email sign-in token.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000;
const IDENTIFIER_PREFIX = 'pwreset:';

const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

export async function requestPasswordReset(email: string) {
  const parsed = z.string().trim().toLowerCase().email().safeParse(email);

  // Throttle before the lookup, keyed on the caller rather than the address, so
  // this cannot be used to probe which addresses are throttled.
  enforce('auth.passwordReset', await subjectFor(null));

  // Always report success. Distinguishing "no such account" from "email sent"
  // turns this endpoint into a membership oracle for every address someone
  // cares to try.
  const generic = { ok: true as const };
  if (!parsed.success) return generic;

  const user = await db.user.findUnique({
    where: { email: parsed.data },
    select: { id: true, email: true, passwordHash: true, status: true },
  });

  // Social accounts have no password to reset, and a suspended account must not
  // be handed a route back in.
  if (!user?.email || !user.passwordHash || user.status !== 'ACTIVE') return generic;

  const raw = randomBytes(32).toString('base64url');
  const identifier = `${IDENTIFIER_PREFIX}${user.email}`;

  // One live token per account: issuing a second must retire the first, or a
  // stolen older link stays usable.
  await db.verificationToken.deleteMany({ where: { identifier } });
  await db.verificationToken.create({
    data: {
      identifier,
      token: hashToken(raw),
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  await sendEmail(passwordResetEmail({ to: user.email, token: raw }));
  return generic;
}

const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(200)
  .refine((v) => v.trim().length > 0, 'Password cannot be blank');

export async function resetPassword(input: { token: string; password: string }) {
  const token = z.string().min(10).max(500).parse(input.token);
  const password = passwordSchema.parse(input.password);

  const row = await db.verificationToken.findUnique({ where: { token: hashToken(token) } });

  if (!row || !row.identifier.startsWith(IDENTIFIER_PREFIX)) {
    throw new Error('This reset link is not valid.');
  }

  if (row.expires < new Date()) {
    await db.verificationToken.deleteMany({ where: { token: row.token } });
    throw new Error('This reset link has expired. Request a new one.');
  }

  const email = row.identifier.slice(IDENTIFIER_PREFIX.length);
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, status: true, passwordHash: true },
  });
  if (!user || user.status !== 'ACTIVE') throw new Error('This reset link is not valid.');

  // Constant-time comparison of the identifier is not needed (it is not a
  // secret), but re-hashing the presented token and matching the stored digest
  // is — a plain === on hex strings leaks position of first difference.
  const presented = Buffer.from(hashToken(token));
  const stored = Buffer.from(row.token);
  if (presented.length !== stored.length || !timingSafeEqual(presented, stored)) {
    throw new Error('This reset link is not valid.');
  }

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        // Invalidates every token minted before this moment. A reset that
        // leaves the attacker's existing session working has not achieved the
        // one thing the person resetting their password wanted.
        sessionVersion: { increment: 1 },
      },
    }),
    // Single use.
    db.verificationToken.deleteMany({ where: { identifier: row.identifier } }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);

  return { ok: true as const };
}

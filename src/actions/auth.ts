'use server';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { signIn } from '@/auth';
import { db } from '@/lib/db';
import { enforce, subjectFor } from '@/lib/rateLimit';
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

/**
 * Sign-up for credential accounts.
 *
 * Until now the register page was a mockup: its form was a GET back to
 * /register, so the only accounts that ever existed were the ones the seed
 * script inserted. That is the reason every store tile in the directory is
 * fictional — nothing in the application could create a user, and without a
 * user there is no owner, and without an owner there is no store.
 *
 * `intent` decides the role at creation. A shopper who later wants to sell is
 * promoted by createStore instead, because a Google account arrives through the
 * adapter as a SHOPPER and never passes through here at all.
 */
const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: passwordSchema,
  intent: z.enum(['shop', 'sell']).default('shop'),
});

export async function registerWithPassword(input: {
  email: string;
  password: string;
  intent?: 'shop' | 'sell';
}) {
  // Keyed on the caller, before the lookup: an unthrottled sign-up endpoint is
  // both an account-spam vector and a way to enumerate addresses by timing the
  // duplicate check.
  enforce('auth.register', await subjectFor(null));

  const { email, password, intent } = registerSchema.parse(input);

  // Sign-up is the one flow where refusing to say "already registered" buys
  // nothing: the same fact is discoverable by trying to sign in, and hiding it
  // only leaves someone stuck on a form that will never succeed.
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new Error('An account with that email already exists. Sign in instead.');
  }

  await db.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: intent === 'sell' ? 'OWNER' : 'SHOPPER',
    },
  });

  // Sign-up ends signed in. Passing the plaintext straight to the credentials
  // provider re-runs the same authorize() path a returning user takes, so there
  // is no second, weaker way into a session.
  //
  // redirect:false so the caller navigates. Letting signIn throw its redirect
  // here would make the validation errors above unreachable from the form,
  // since the client cannot tell a thrown redirect from a thrown failure.
  await signIn('credentials', { email, password, redirect: false });

  // Someone who already declared they are here to sell goes straight to the
  // store form. Everyone else lands on step 2, which is where this product
  // deliberately asks intent — after the account exists, not before.
  return {
    ok: true as const,
    next: intent === 'sell' ? '/merchant/new' : '/register?step=2&via=password',
  };
}

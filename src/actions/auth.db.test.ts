import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import bcrypt from 'bcryptjs';

/**
 * Password reset, end to end against a real database.
 *
 * Worth a DB test rather than mocks because every property that matters here is
 * a property of what is *stored*: that the raw token never lands in a row, that
 * redemption is genuinely single-use, and that sessionVersion moves — which is
 * the only thing that actually signs an attacker out.
 */

// The raw token exists only in the email body, which is where a real user gets
// it from. Capturing it here is how the test walks the same path they do.
const sent = vi.hoisted(() => ({ token: '' }));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => true),
  passwordResetEmail: vi.fn((input: { to: string; token: string }) => {
    sent.token = input.token;
    return { to: input.to, subject: 'Reset your password', text: '' };
  }),
}));

import { db } from '@/lib/db';
import { requestPasswordReset, resetPassword } from './auth';

const suffix = Math.random().toString(36).slice(2, 10);
const email = `reset-${suffix}@test.invalid`;
const socialEmail = `social-${suffix}@test.invalid`;
const ORIGINAL = 'original-password-123';

let userId: string;

beforeAll(async () => {
  const user = await db.user.create({
    data: {
      email,
      role: 'OWNER',
      passwordHash: await bcrypt.hash(ORIGINAL, 12),
    },
  });
  userId = user.id;

  // Social accounts have no password hash at all.
  await db.user.create({ data: { email: socialEmail, role: 'SHOPPER' } });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: [email, socialEmail] } } });
  await db.verificationToken.deleteMany({
    where: { identifier: { in: [`pwreset:${email}`, `pwreset:${socialEmail}`] } },
  });
  await db.$disconnect();
});

describe('requestPasswordReset', () => {
  it('stores the token hashed, never in the clear', async () => {
    sent.token = '';
    await requestPasswordReset(email);

    expect(sent.token).not.toBe('');

    const rows = await db.verificationToken.findMany({
      where: { identifier: `pwreset:${email}` },
    });
    expect(rows).toHaveLength(1);
    // A reset token is a bearer credential; a leaked table must not be a
    // leaked set of live links.
    expect(rows[0].token).not.toBe(sent.token);
    expect(rows[0].token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('issues no token for an account with no password', async () => {
    sent.token = '';
    await requestPasswordReset(socialEmail);

    const rows = await db.verificationToken.findMany({
      where: { identifier: `pwreset:${socialEmail}` },
    });
    expect(rows).toHaveLength(0);
    // And it still reports success, so this is not a membership oracle.
    expect(sent.token).toBe('');
  });
});

describe('resetPassword', () => {
  it('changes the password, bumps sessionVersion and consumes the token', async () => {
    const before = await db.user.findUniqueOrThrow({ where: { id: userId } });

    sent.token = '';
    await requestPasswordReset(email);
    const raw = sent.token;
    expect(raw).not.toBe('');

    await resetPassword({ token: raw, password: 'a-much-longer-new-password' });

    const after = await db.user.findUniqueOrThrow({ where: { id: userId } });

    expect(await bcrypt.compare('a-much-longer-new-password', after.passwordHash!)).toBe(true);
    expect(await bcrypt.compare(ORIGINAL, after.passwordHash!)).toBe(false);

    // The whole point of the reset: existing tokens stop working.
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);

    const rows = await db.verificationToken.findMany({
      where: { identifier: `pwreset:${email}` },
    });
    expect(rows).toHaveLength(0);
  });

  it('refuses to reuse a spent token', async () => {
    sent.token = '';
    await requestPasswordReset(email);
    const raw = sent.token;

    await resetPassword({ token: raw, password: 'first-use-password-xyz' });
    await expect(
      resetPassword({ token: raw, password: 'second-use-password-xyz' }),
    ).rejects.toThrow(/not valid/i);
  });

  it('refuses an expired token', async () => {
    sent.token = '';
    await requestPasswordReset(email);
    const raw = sent.token;

    await db.verificationToken.updateMany({
      where: { identifier: `pwreset:${email}` },
      data: { expires: new Date(Date.now() - 1000) },
    });

    await expect(resetPassword({ token: raw, password: 'expired-attempt-password' })).rejects.toThrow(
      /expired/i,
    );
  });

  it('refuses a token that was never issued', async () => {
    await expect(
      resetPassword({ token: 'not-a-real-token-value', password: 'whatever-password-123' }),
    ).rejects.toThrow(/not valid/i);
  });
});

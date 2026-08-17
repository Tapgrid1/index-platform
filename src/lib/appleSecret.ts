// Imported unprefixed on purpose. src/middleware.ts imports @/auth, which
// imports this file, so it lands in the Edge bundle — and webpack rejects the
// `node:` scheme there outright ("Unhandled scheme"). The bare specifier
// resolves; `node:crypto` fails the build. Do not "modernise" this line.
import { createSign } from 'crypto';

/**
 * Apple Sign-In client secret.
 *
 * Apple is the only provider here whose "secret" is not a secret: it is a
 * short-lived ES256 JWT that you mint yourself from a downloaded key, and it
 * expires after at most six months. A static string in AUTH_APPLE_SECRET —
 * which is what this repo shipped with — cannot authenticate at all; the
 * provider fails closed on first use.
 *
 * Required environment:
 *   APPLE_TEAM_ID      10-character team id from the developer portal
 *   APPLE_KEY_ID       10-character key id for the Sign-In key
 *   APPLE_PRIVATE_KEY  the .p8 contents (literal \n escapes are accepted)
 *   AUTH_APPLE_ID      the Services ID, used as both client id and JWT subject
 */

// Apple's documented ceiling is 6 months; 150 days leaves room to redeploy.
const LIFETIME_SECONDS = 150 * 24 * 60 * 60;
const REFRESH_BEFORE_SECONDS = 24 * 60 * 60;

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

let cached: { token: string; expiresAt: number } | null = null;

export function appleClientSecret(): string | undefined {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const clientId = process.env.AUTH_APPLE_ID;
  const rawKey = process.env.APPLE_PRIVATE_KEY;

  // Fall back to whatever is configured rather than throwing: Apple sign-in
  // being unconfigured must not take down Google sign-in and the credentials
  // provider with it.
  if (!teamId || !keyId || !clientId || !rawKey) return process.env.AUTH_APPLE_SECRET;

  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - REFRESH_BEFORE_SECONDS > now) return cached.token;

  // Env vars carry the PEM with escaped newlines far more often than real ones.
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const expiresAt = now + LIFETIME_SECONDS;
  const payload = {
    iss: teamId,
    iat: now,
    exp: expiresAt,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

  // JWS requires the raw r||s pair. Node defaults to DER for ECDSA, which Apple
  // rejects with an opaque invalid_client — dsaEncoding is the whole trick here.
  const signature = createSign('SHA256')
    .update(signingInput)
    .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

  const token = `${signingInput}.${b64url(signature)}`;
  cached = { token, expiresAt };
  return token;
}

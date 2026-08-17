import { headers } from 'next/headers';
import { hashClientKey } from '@/lib/rateLimit';

/**
 * Request-scoped subject keys for the rate limiter.
 *
 * Split from ./rateLimit because that module is reachable from src/auth.ts and
 * therefore from middleware, which bundles for the Edge runtime — `next/headers`
 * must not follow it there. Server actions import from this file; anything on
 * the auth path imports the pure module and passes headers explicitly.
 */

/** Bucket key for an anonymous caller in a server action or route handler. */
export async function anonymousSubject() {
  try {
    const h = await headers();
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown';
    return hashClientKey(ip);
  } catch {
    // Outside a request scope (seeding, scripts): one shared bucket is correct.
    return 'no-request-scope';
  }
}

/** Subject key for an action that may or may not have a signed-in caller. */
export async function subjectFor(userId?: string | null) {
  return userId ? `u:${userId}` : `a:${await anonymousSubject()}`;
}

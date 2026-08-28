import { createHash, randomBytes } from 'node:crypto';
import { headers } from 'next/headers';

/**
 * Fixed-window rate limiting, in process.
 *
 * In-process is the right first move, not a shortcut: this is a single Next.js
 * deployment, and a Redis dependency bought before there is a second instance
 * is an outage source with no offsetting benefit. The limiter is deliberately
 * shaped so that swapping the store for Redis touches only `hit()` — the rules
 * and the call sites do not change.
 *
 * Caveat worth knowing before relying on it: on a serverless host each instance
 * keeps its own counters, so the effective limit is (limit × live instances).
 * That still stops the runaway cases these limits exist for; it is not a
 * defence against a distributed attacker, which is a WAF's job, not this file's.
 */

export class RateLimited extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super('Too many requests');
    this.name = 'RateLimited';
    this.retryAfterMs = retryAfterMs;
  }
}

type Rule = { limit: number; windowMs: number };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Limits are set to be invisible to a real user and obvious to a script. The
 * forum is free at every tier precisely to build liquidity (§3), so these are
 * abuse ceilings, not engagement throttles — if a limit here is ever hit by
 * ordinary enthusiasm, it is set wrong.
 */
export const RULES = {
  'community.thread': { limit: 10, windowMs: HOUR },
  'community.comment': { limit: 30, windowMs: 10 * MINUTE },
  'community.report': { limit: 15, windowMs: HOUR },
  'search.log': { limit: 60, windowMs: MINUTE },
  'account.export': { limit: 5, windowMs: DAY },
  'auth.passwordReset': { limit: 5, windowMs: HOUR },
  'auth.register': { limit: 8, windowMs: HOUR },
} as const satisfies Record<string, Rule>;

export type RuleName = keyof typeof RULES;

type Window = { count: number; resetAt: number };
const buckets = new Map<string, Window>();

// Sweeping on write keeps the map bounded without a background timer, which a
// serverless instance would not reliably run anyway.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < MINUTE) return;
  lastSweep = now;
  for (const [key, win] of buckets) {
    if (win.resetAt <= now) buckets.delete(key);
  }
}

/** Records a hit and reports whether it was allowed. Never throws. */
export function hit(rule: RuleName, subject: string) {
  const { limit, windowMs } = RULES[rule];
  const now = Date.now();
  sweep(now);

  const key = `${rule}:${subject}`;
  const win = buckets.get(key);

  if (!win || win.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, remaining: limit - 1, retryAfterMs: 0 };
  }

  win.count += 1;
  if (win.count > limit) {
    return { ok: false as const, remaining: 0, retryAfterMs: win.resetAt - now };
  }
  return { ok: true as const, remaining: limit - win.count, retryAfterMs: 0 };
}

/** Throwing form, for server actions that should simply refuse. */
export function enforce(rule: RuleName, subject: string) {
  const result = hit(rule, subject);
  if (!result.ok) throw new RateLimited(result.retryAfterMs);
  return result;
}

/**
 * Per-process salt. Restarting the process rotates it, which is fine — the
 * hashes only need to be stable for the length of a rate-limit window, and a
 * salt that never leaves memory cannot be exfiltrated from a backup.
 */
const IP_SALT = randomBytes(32);

/**
 * Subject key for an unauthenticated caller.
 *
 * This hashes the client IP and holds it ONLY in the in-memory bucket map. That
 * is not a contradiction of the rule that search_log carries no IP and no device
 * fingerprint (§6) — that rule is about what gets *persisted*, and this value is
 * never written to a table, never logged, and dies with the process. Throttling
 * anonymous traffic with no client identifier at all is not possible, and
 * leaving anonymous search unthrottled is the larger privacy risk, since an
 * unthrottled log is the one that fills with scraped queries.
 */
export async function anonymousSubject() {
  try {
    const h = await headers();
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip')?.trim() ||
      'unknown';
    return createHash('sha256').update(IP_SALT).update(ip).digest('base64url').slice(0, 22);
  } catch {
    // Outside a request scope (seeding, scripts): one shared bucket is correct.
    return 'no-request-scope';
  }
}

/** Subject key for an action that may or may not have a signed-in caller. */
export async function subjectFor(userId?: string | null) {
  return userId ? `u:${userId}` : `a:${await anonymousSubject()}`;
}

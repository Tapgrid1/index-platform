import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// headers() is only available inside a request scope; the limiter is expected
// to degrade rather than throw when it is not.
vi.mock('next/headers', () => ({
  headers: async () => {
    throw new Error('called outside a request scope');
  },
}));

import { hit, enforce, RateLimited, RULES, anonymousSubject, subjectFor } from './rateLimit';

describe('rate limiter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows exactly the configured number of hits in a window', () => {
    const subject = `test-${Math.random()}`;
    const { limit } = RULES['community.comment'];

    for (let i = 0; i < limit; i++) {
      expect(hit('community.comment', subject).ok).toBe(true);
    }
    expect(hit('community.comment', subject).ok).toBe(false);
  });

  it('reports how long the caller has to wait', () => {
    const subject = `test-${Math.random()}`;
    const { limit, windowMs } = RULES['community.thread'];

    for (let i = 0; i < limit; i++) hit('community.thread', subject);
    const blocked = hit('community.thread', subject);

    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(windowMs);
  });

  it('opens the window again once it has elapsed', () => {
    const subject = `test-${Math.random()}`;
    const { limit, windowMs } = RULES['community.thread'];

    for (let i = 0; i < limit; i++) hit('community.thread', subject);
    expect(hit('community.thread', subject).ok).toBe(false);

    vi.advanceTimersByTime(windowMs + 1);
    expect(hit('community.thread', subject).ok).toBe(true);
  });

  it('keeps subjects independent', () => {
    const { limit } = RULES['community.thread'];
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;

    for (let i = 0; i < limit; i++) hit('community.thread', a);
    expect(hit('community.thread', a).ok).toBe(false);
    // One noisy account must not throttle everyone else.
    expect(hit('community.thread', b).ok).toBe(true);
  });

  it('keeps rules independent for the same subject', () => {
    const subject = `test-${Math.random()}`;
    const { limit } = RULES['community.thread'];

    for (let i = 0; i < limit; i++) hit('community.thread', subject);
    expect(hit('community.thread', subject).ok).toBe(false);
    expect(hit('community.comment', subject).ok).toBe(true);
  });

  it('enforce() throws RateLimited rather than returning a flag', () => {
    const subject = `test-${Math.random()}`;
    const { limit } = RULES['community.report'];

    for (let i = 0; i < limit; i++) enforce('community.report', subject);
    expect(() => enforce('community.report', subject)).toThrow(RateLimited);
  });

  it('falls back to a shared bucket outside a request scope', async () => {
    // Seeding and scripts call these paths with no headers() available.
    await expect(anonymousSubject()).resolves.toBe('no-request-scope');
  });

  it('separates signed-in subjects from anonymous ones', async () => {
    await expect(subjectFor('user-1')).resolves.toBe('u:user-1');
    await expect(subjectFor(null)).resolves.toMatch(/^a:/);
  });
});

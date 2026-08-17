import { db } from '@/lib/db';

/**
 * Buffered impression counter.
 *
 * Incrementing Store.impressionCount once per render is both wrong and
 * expensive: it counts prefetches, bot crawls and re-renders as shopper
 * attention, and it puts a write on the read path of the busiest page in the
 * product. So views are reported by the client only when a card actually
 * reaches the viewport, and land here to be coalesced.
 *
 * Coalescing is the point. A hundred shoppers scrolling past the same store in
 * one flush window becomes one UPDATE, not a hundred.
 *
 * Same serverless caveat as the rate limiter: a buffer lives in one instance
 * and a recycled instance loses at most one window of counts. That is an
 * acceptable trade for a metric that exists to be read as a trend — and
 * ClickEvent, not this counter, is the source of truth for anything precise
 * (docs/ARCHITECTURE.md §6).
 */

const FLUSH_AFTER_MS = 5_000;
const FLUSH_AT_PENDING = 500;

const pending = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function bufferImpressions(storeIds: string[]) {
  for (const id of storeIds) {
    pending.set(id, (pending.get(id) ?? 0) + 1);
  }

  if (pending.size >= FLUSH_AT_PENDING) {
    void flushImpressions();
    return;
  }

  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      void flushImpressions();
    }, FLUSH_AFTER_MS);
    // Do not hold a serverless instance (or `next dev`) open for a counter.
    timer.unref?.();
  }
}

export async function flushImpressions() {
  if (!pending.size) return;

  // Snapshot and clear first: a write that fails should drop its window rather
  // than replay indefinitely into a counter that is already approximate.
  const batch = [...pending.entries()];
  pending.clear();

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  await Promise.all(
    batch.map(([storeId, count]) =>
      db.store
        .update({ where: { id: storeId }, data: { impressionCount: { increment: count } } })
        .catch(() => {}),
    ),
  );
}

/** Test seam: lets a test assert on what is buffered without waiting 5s. */
export function pendingImpressions() {
  return new Map(pending);
}

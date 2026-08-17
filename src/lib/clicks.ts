import { db } from '@/lib/db';
import type { ClickKind } from '@prisma/client';

/**
 * Outbound click recording, shared by /out/s and /out/p.
 *
 * Two writes per click: the raw ClickEvent (the source of truth — trend
 * questions are answered from these, per docs/ARCHITECTURE.md §6) and an
 * increment of the denormalised counter the merchant dashboard reads.
 *
 * Never awaited by the route handler. A shopper mid-click must not wait on
 * analytics, and a failed write must not cost the merchant the visit — the
 * redirect is the product, the logging is bookkeeping.
 */
export function recordClick(input: {
  kind: ClickKind;
  storeId?: string | null;
  productId?: string | null;
  userId?: string | null;
}) {
  const writes: Promise<unknown>[] = [
    db.clickEvent.create({
      data: {
        kind: input.kind,
        storeId: input.storeId ?? null,
        productId: input.productId ?? null,
        userId: input.userId ?? null,
      },
    }),
  ];

  if (input.kind === 'ENTER' && input.storeId) {
    writes.push(
      db.store.update({
        where: { id: input.storeId },
        data: { enterClickCount: { increment: 1 } },
      }),
    );
  }

  if (input.kind === 'PRODUCT' && input.productId) {
    writes.push(
      db.product.update({
        where: { id: input.productId },
        data: { clickCount: { increment: 1 } },
      }),
    );
  }

  void Promise.all(writes).catch(() => {});
}

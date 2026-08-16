import { db } from '@/lib/db';

const CARD_SELECT = {
  id: true,
  name: true,
  monogram: true,
  logoUrl: true,
  story: true,
  isVerifiedMaker: true,
  category: { select: { name: true } },
  products: {
    orderBy: { sortOrder: 'asc' },
    select: { id: true, title: true, imageUrl: true },
  },
} as const;

export async function publishedStores(where: Record<string, unknown> = {}) {
  return db.store.findMany({
    where: { status: 'PUBLISHED', ...where },
    orderBy: { publishedAt: 'desc' },
    select: CARD_SELECT,
  });
}

export async function savedIdsFor(userId?: string) {
  if (!userId) return new Set<string>();
  const rows = await db.savedStore.findMany({ where: { userId }, select: { storeId: true } });
  return new Set(rows.map((r) => r.storeId));
}

/** Store of the Week — scheduled data from collection_stores, never hardcoded. */
export async function spotlightStore() {
  const now = new Date();
  const row = await db.collectionStore.findFirst({
    where: {
      collection: { kind: 'SPOTLIGHT', isActive: true },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { sortOrder: 'asc' },
    select: { store: { select: CARD_SELECT } },
  });
  return row?.store ?? null;
}

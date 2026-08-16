'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, currentUser } from '@/lib/authz';

/** Quick-Save. The saved count is the platform's strongest first-party signal. */
export async function toggleSave(storeId: string) {
  const user = await requireUser();
  const existing = await db.savedStore.findUnique({
    where: { userId_storeId: { userId: user.id, storeId } },
  });

  if (existing) {
    await db.$transaction([
      db.savedStore.delete({ where: { userId_storeId: { userId: user.id, storeId } } }),
      db.store.update({ where: { id: storeId }, data: { savedCount: { decrement: 1 } } }),
    ]);
  } else {
    await db.$transaction([
      db.savedStore.create({ data: { userId: user.id, storeId } }),
      db.store.update({ where: { id: storeId }, data: { savedCount: { increment: 1 } } }),
    ]);
  }

  revalidatePath('/');
  revalidatePath('/archive');
  return { saved: !existing };
}

/** Recently viewed, trimmed to the last 10 per user on write. */
export async function recordView(storeId: string) {
  const user = await currentUser();
  if (!user) return;

  await db.viewHistory.create({ data: { userId: user.id, storeId } });

  const stale = await db.viewHistory.findMany({
    where: { userId: user.id },
    orderBy: { viewedAt: 'desc' },
    skip: 10,
    select: { id: true },
  });
  if (stale.length) {
    await db.viewHistory.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
  }
}

/**
 * Search logging. Anonymous rows carry no IP and no device fingerprint —
 * without that rule the table is a privacy liability with no offsetting value.
 */
export async function logSearch(query: string, resultCount: number) {
  const parsed = z.string().trim().min(1).max(200).safeParse(query);
  if (!parsed.success) return;

  const user = await currentUser();
  await db.searchLog.create({
    data: { userId: user?.id ?? null, query: parsed.data, resultCount },
  });
}

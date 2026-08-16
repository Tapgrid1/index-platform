'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireOwnStore, hasTier } from '@/lib/authz';

/** The 150-character cap is enforced here AND at the database. A UI-only limit
 *  drifts the moment anything else writes to the column. */
const storeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  monogram: z.string().trim().min(1).max(3),
  story: z.string().trim().min(1).max(150),
  homeUrl: z.string().trim().min(4).max(200),
  categoryId: z.string().optional().nullable(),
});

export async function updateStoreCard(input: z.infer<typeof storeSchema>) {
  const { store } = await requireOwnStore();
  const data = storeSchema.parse(input);

  await db.store.update({
    where: { id: store.id },
    data: { ...data, monogram: data.monogram.toUpperCase() },
  });

  revalidatePath('/');
  revalidatePath('/merchant');
  revalidatePath('/merchant/store');
}

const productSchema = z.object({
  sortOrder: z.number().int().min(0).max(4), // five slots, mirrored by a DB CHECK
  title: z.string().trim().min(1).max(120),
  destinationUrl: z.string().trim().min(1).max(400),
  imageUrl: z.string().trim().min(1),
});

export async function upsertProduct(input: z.infer<typeof productSchema>) {
  const { store } = await requireOwnStore();
  const data = productSchema.parse(input);

  await db.product.upsert({
    where: { storeId_sortOrder: { storeId: store.id, sortOrder: data.sortOrder } },
    create: { storeId: store.id, ...data },
    update: { title: data.title, destinationUrl: data.destinationUrl, imageUrl: data.imageUrl },
  });

  revalidatePath('/');
  revalidatePath('/merchant/products');
}

/**
 * Image upload. In this repo the handler accepts a URL or data URI so the app
 * runs with no object storage configured. Before production: presigned upload
 * to S3/R2, server-side re-encode, EXIF strip, and a hard dimension floor so
 * the grid never renders a blurry card.
 */
export async function setProductImage(sortOrder: number, imageUrl: string) {
  const { store } = await requireOwnStore();
  z.number().int().min(0).max(4).parse(sortOrder);
  if (!/^(https?:\/\/|data:image\/)/i.test(imageUrl)) throw new Error('Images only');

  await db.product.update({
    where: { storeId_sortOrder: { storeId: store.id, sortOrder } },
    data: { imageUrl },
  });
  revalidatePath('/');
  revalidatePath('/merchant/products');
}

/** Dynamic scan routing — T3 only. The command center is the moat. */
export async function setPlacementRoute(placementId: string, targetUrl: string) {
  const { user, store } = await requireOwnStore();
  if (!hasTier(store.ownerId ? (await tierOf(store.ownerId)) : 'NONE', 'T3')) {
    throw new Error('Routing control requires the Network tier');
  }

  const placement = await db.adPlacement.findUnique({ where: { id: placementId } });
  if (!placement || placement.storeId !== store.id) throw new Error('Not your placement');

  // History matters: without placement_routes you cannot explain a scan-count
  // change to a merchant who has re-pointed the destination three times.
  await db.$transaction([
    db.adPlacement.update({ where: { id: placementId }, data: { currentTargetUrl: targetUrl } }),
    db.placementRoute.create({ data: { placementId, targetUrl, setById: user.id } }),
  ]);

  revalidatePath('/merchant/bridge');
}

async function tierOf(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { subscriptionTier: true } });
  return u?.subscriptionTier ?? 'NONE';
}

/** One-click revert of a support edit. Required by the override contract. */
export async function revertOverride(noticeId: string) {
  const { store } = await requireOwnStore();
  const notice = await db.overrideNotice.findUnique({ where: { id: noticeId } });
  if (!notice || notice.storeId !== store.id) throw new Error('Not your notice');

  if (notice.field === 'homeUrl') {
    await db.store.update({ where: { id: store.id }, data: { homeUrl: notice.beforeValue } });
  }
  await db.overrideNotice.update({
    where: { id: noticeId },
    data: { revertedAt: new Date(), acknowledgedAt: new Date() },
  });

  revalidatePath('/merchant');
}

export async function acknowledgeOverride(noticeId: string) {
  const { store } = await requireOwnStore();
  const notice = await db.overrideNotice.findUnique({ where: { id: noticeId } });
  if (!notice || notice.storeId !== store.id) throw new Error('Not your notice');

  // The banner clears. The audit row is permanent.
  await db.overrideNotice.update({ where: { id: noticeId }, data: { acknowledgedAt: new Date() } });
  revalidatePath('/merchant');
}

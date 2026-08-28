'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, requireOwnStore, hasTier } from '@/lib/authz';
import { safeExternalUrl } from '@/lib/url';

/** The 150-character cap is enforced here AND at the database. A UI-only limit
 *  drifts the moment anything else writes to the column. */
const storeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  monogram: z.string().trim().min(1).max(3),
  story: z.string().trim().min(1).max(150),
  homeUrl: z.string().trim().min(4).max(200),
  categoryId: z.string().optional().nullable(),
});

/**
 * Store creation — the write path that did not exist.
 *
 * Until now nothing in the application created a Store: every merchant action
 * was gated behind requireOwnStore, which resolves a store that something else
 * had to have inserted. That something else was only ever prisma/seed.ts, which
 * is why every tile in the directory was fictional.
 *
 * Guarded by requireUser rather than requireOwnStore for the obvious reason —
 * the caller has no store yet, that is the point.
 */
export async function createStore(input: z.infer<typeof storeSchema>) {
  const user = await requireUser();
  const data = storeSchema.parse(input);

  // One store per account. Store.ownerId is @unique, so the database refuses a
  // second one regardless; this check is here to answer with something a form
  // can display instead of a constraint violation.
  const existing = await db.store.findUnique({ where: { ownerId: user.id }, select: { id: true } });
  if (existing) throw new Error('This account already has a store.');

  const homeUrl = safeExternalUrl(data.homeUrl);
  if (!homeUrl) throw new Error('Enter a valid http(s) storefront URL');

  const slug = await uniqueSlug(data.name);

  // Creating the store and promoting the owner must not be separable: a store
  // whose owner is still a SHOPPER is one middleware bounces out of the portal
  // it just sent them to.
  const [store] = await db.$transaction([
    db.store.create({
      data: {
        ...data,
        slug,
        homeUrl,
        monogram: data.monogram.toUpperCase(),
        ownerId: user.id,
        // Auto-publish on submission, per docs/DECISIONS.md D2. Every counter
        // is left at its schema default of zero — a new store has earned no
        // impressions, and inventing some is what made the seeded cards fake.
        status: 'PUBLISHED',
      },
      select: { id: true, slug: true },
    }),
    db.user.update({
      where: { id: user.id },
      data: { role: user.role === 'SHOPPER' ? 'OWNER' : user.role },
    }),
  ]);

  revalidatePath('/');
  revalidatePath('/merchant');

  return { ok: true as const, storeId: store.id, slug: store.slug };
}

/**
 * Store.slug is unique and public, so a second "Kiln & Vessel" cannot simply
 * take the same one. Suffix rather than reject: the merchant chose a name, not
 * a URL, and failing their submission over a stranger's collision is a bad
 * trade.
 */
async function uniqueSlug(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'store';

  const taken = new Set(
    (await db.store.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    })).map((s) => s.slug),
  );

  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function updateStoreCard(input: z.infer<typeof storeSchema>) {
  const { store } = await requireOwnStore();
  const data = storeSchema.parse(input);

  // Validated at write time, not at click time: a merchant who saves a broken
  // homeUrl otherwise finds out from a shopper who could not reach them.
  const homeUrl = safeExternalUrl(data.homeUrl);
  if (!homeUrl) throw new Error('Enter a valid http(s) storefront URL');

  await db.store.update({
    where: { id: store.id },
    data: { ...data, homeUrl, monogram: data.monogram.toUpperCase() },
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

  const destinationUrl = safeExternalUrl(data.destinationUrl);
  if (!destinationUrl) throw new Error('Enter a valid http(s) product URL');

  await db.product.upsert({
    where: { storeId_sortOrder: { storeId: store.id, sortOrder: data.sortOrder } },
    create: { storeId: store.id, ...data, destinationUrl },
    update: { title: data.title, destinationUrl, imageUrl: data.imageUrl },
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

  // The strictest of the three URL checks, because this one is printed. A
  // placement re-pointed at an unusable target sends every future scan of a
  // physical asset to the fallback, and the asset cannot be recalled.
  const target = safeExternalUrl(targetUrl);
  if (!target) throw new Error('Enter a valid http(s) destination for this placement');

  // History matters: without placement_routes you cannot explain a scan-count
  // change to a merchant who has re-pointed the destination three times.
  await db.$transaction([
    db.adPlacement.update({ where: { id: placementId }, data: { currentTargetUrl: target } }),
    db.placementRoute.create({ data: { placementId, targetUrl: target, setById: user.id } }),
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

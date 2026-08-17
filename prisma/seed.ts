/**
 * Seed. Creates the admin account, the taxonomy, eight demo stores with five
 * products each, forum content, and one T3 store with live placements so the
 * resolver can be exercised end to end.
 *
 * Run: npm run db:seed
 */
import { PrismaClient, type Tier } from '@prisma/client';

const db = new PrismaClient();

const CATEGORIES = [
  'Ceramics', 'Vintage & Resale', 'Leather Goods', 'Home & Scent',
  'Prints & Paper', 'Jewelry', 'Textiles', 'Skincare',
];

const COLLECTIONS = [
  { slug: 'trending', name: 'Trending' },
  { slug: 'vintage-resale', name: 'Vintage & Resale' },
  { slug: 'independent-makers', name: 'Independent Makers' },
  { slug: 'one-of-one-drops', name: '1-of-1 Drops' },
];

const IMG = 'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=800&q=70';

type Seed = {
  slug: string; name: string; mono: string; story: string; url: string;
  category: string; tier: Tier; verified: boolean; collections: string[];
  products: string[];
};

const STORES: Seed[] = [
  { slug: 'kiln-and-vessel', name: 'Kiln & Vessel', mono: 'KV', category: 'Ceramics', tier: 'T2', verified: true,
    story: 'Two potters, one gas kiln in Rockford. Everything thrown, glazed and fired within forty feet of where the clay is wedged.',
    url: 'kilnandvessel.com', collections: ['independent-makers', 'trending'],
    products: ['Marbled Stone Mug', 'Khaki Studio Cup', 'Sandy White Tumbler', 'Table Set, Six', 'Charcoal Rim Mug'] },
  { slug: 'sedgefield-supply', name: 'Sedgefield Supply', mono: 'SS', category: 'Vintage & Resale', tier: 'T2', verified: true,
    story: 'Sourced denim from estate lots across the upper Midwest. One of each, measured flat, photographed as found.',
    url: 'sedgefieldsupply.com', collections: ['vintage-resale', 'trending'],
    products: ['1970s Do-Nothing Jacket', 'Cone Mills Trucker', 'Wrangler 124MJ', 'Golden Horse Trucker', 'Blueway Type III'] },
  { slug: 'marrow-leather', name: 'Marrow Leather', mono: 'ML', category: 'Leather Goods', tier: 'T1', verified: false,
    story: 'Vegetable-tanned shoulder, hand-stitched with linen thread. Built to be repaired, not replaced.',
    url: 'marrowleather.com', collections: ['independent-makers'],
    products: ['Field Tote, Tan', 'Shoulder Bag No. 4', 'Kodiak Carryall', 'Oak Bucket Bag', 'Everyday Shopper'] },
  { slug: 'ninth-hour-candle', name: 'Ninth Hour Candle Co.', mono: 'NH', category: 'Home & Scent', tier: 'T3', verified: true,
    story: 'Hand-poured soy in amber glass, in batches of sixty. Scents built around the hour the studio smells best.',
    url: 'ninthhourcandle.com', collections: ['independent-makers', 'trending'],
    products: ['No. 12 Apple Cider', 'No. 404 Juniper', 'Italian Dream', 'Maple Bourbon', 'Butterscotch'] },
  { slug: 'press-nine', name: 'Press Nine', mono: 'P9', category: 'Prints & Paper', tier: 'T1', verified: false,
    story: 'Risograph editions of forty or fewer, pulled by hand on a 1994 RP3700. Misregistration is the point.',
    url: 'pressnine.studio', collections: ['one-of-one-drops', 'independent-makers'],
    // Deliberately includes a price in a title so the card-audit regex has something to catch.
    products: ['Bylom, Edition of 40', 'April Riso — only $45', 'Poster A3-003', 'Blue/Red Stamp', 'Chuhai Can'] },
  { slug: 'argent-small-goods', name: 'Argent Small Goods', mono: 'AS', category: 'Jewelry', tier: 'T2', verified: true,
    story: 'Recycled sterling, cut and soldered at a single bench in Milwaukee. Sized to order, stamped on the inside.',
    url: 'argentsmallgoods.com', collections: ['independent-makers', 'trending'],
    products: ['Stacking Band, Fine', 'Swirl Ring', 'Multi-Band', 'Adjustable Statement', 'Tiny Dot Ring'] },
  { slug: 'loom-and-ledger', name: 'Loom & Ledger', mono: 'LL', category: 'Textiles', tier: 'T1', verified: false,
    story: 'Floor-loom throws in madder, indigo and walnut. Each piece logged in a ledger with its dye date and lot.',
    url: 'loomandledger.com', collections: ['one-of-one-drops', 'independent-makers'],
    products: ['Noche Merino Throw', 'Natural Dye Blanket', 'Madder Stripe', 'Cotton Sofa Throw', 'Walnut Weave'] },
  { slug: 'rising-iris', name: 'Rising Iris Apothecary', mono: 'RI', category: 'Skincare', tier: 'T2', verified: true,
    story: 'Farm-grown botanicals, extracted on site and bottled in amber. Formulated by the person who grows them.',
    url: 'risingiris.farm', collections: ['independent-makers'],
    products: ['Garden Serum', 'Apothecary Collection', 'Mini Set', 'Facial Oil', 'Balm No. 3'] },
];

async function main() {
  console.log('Seeding…');

  /**
   * The admin row is a placeholder for audit-log foreign keys, NOT a grant.
   * Admin access comes from the ADMIN_EMAILS allowlist, re-derived on every
   * token rotation — so seeding role: 'ADMIN' here confers nothing unless that
   * same address is also in the allowlist, and removing it from the allowlist
   * demotes this row on its owner's next request.
   */
  const adminEmail = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? 'admin@example.com')
    .split(',')[0]
    .trim()
    .toLowerCase();

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, name: 'Platform Admin', role: 'ADMIN' },
  });

  const categories = new Map<string, string>();
  for (const [i, name] of CATEGORIES.entries()) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const c = await db.category.upsert({
      where: { slug }, update: {}, create: { slug, name, sortOrder: i },
    });
    categories.set(name, c.id);
  }

  const collections = new Map<string, string>();
  for (const [i, c] of COLLECTIONS.entries()) {
    const row = await db.collection.upsert({
      where: { slug: c.slug }, update: {}, create: { ...c, kind: 'PILL', sortOrder: i },
    });
    collections.set(c.slug, row.id);
  }
  const spotlight = await db.collection.upsert({
    where: { slug: 'store-of-the-week' },
    update: {},
    create: { slug: 'store-of-the-week', name: 'Store of the Week', kind: 'SPOTLIGHT' },
  });

  const storeIds = new Map<string, string>();
  for (const s of STORES) {
    const owner = await db.user.upsert({
      where: { email: `owner@${s.url}` },
      update: {},
      create: {
        email: `owner@${s.url}`,
        name: s.name,
        role: 'OWNER',
        subscriptionTier: s.tier,
        billingStatus: 'ACTIVE',
      },
    });

    const store = await db.store.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        slug: s.slug, ownerId: owner.id, name: s.name, monogram: s.mono,
        story: s.story, homeUrl: s.url, categoryId: categories.get(s.category),
        isVerifiedMaker: s.verified,
        verificationState: s.verified ? 'GRANTED' : 'PENDING',
        verifiedAt: s.verified ? new Date() : null,
        impressionCount: 6000 + Math.floor(Math.random() * 16000),
        enterClickCount: 300 + Math.floor(Math.random() * 2100),
        savedCount: 120 + Math.floor(Math.random() * 750),
      },
    });
    storeIds.set(s.slug, store.id);

    for (const [i, title] of s.products.entries()) {
      await db.product.upsert({
        where: { storeId_sortOrder: { storeId: store.id, sortOrder: i } },
        update: {},
        create: {
          storeId: store.id, sortOrder: i, title, imageUrl: IMG,
          // Absolute, because this column is a redirect target, not a link
          // within this app. A relative path here resolves to a nonsense host.
          destinationUrl: `https://${s.url}/product/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          clickCount: 40 + Math.floor(Math.random() * 380),
        },
      });
    }

    for (const slug of s.collections) {
      await db.collectionStore.upsert({
        where: { collectionId_storeId: { collectionId: collections.get(slug)!, storeId: store.id } },
        update: {}, create: { collectionId: collections.get(slug)!, storeId: store.id },
      });
    }
  }

  await db.collectionStore.upsert({
    where: { collectionId_storeId: { collectionId: spotlight.id, storeId: storeIds.get('ninth-hour-candle')! } },
    update: {}, create: { collectionId: spotlight.id, storeId: storeIds.get('ninth-hour-candle')! },
  });

  // Boards
  const boards = ['Getting Started', 'Marketing & Growth', 'Shipping & Fulfillment', 'Platform Feedback'];
  const boardIds = new Map<string, string>();
  for (const [i, name] of boards.entries()) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const b = await db.forumBoard.upsert({ where: { slug }, update: {}, create: { slug, name, sortOrder: i } });
    boardIds.set(name, b.id);
  }

  // A shopper, so forum parity is visible in the seed data.
  const shopper = await db.user.upsert({
    where: { email: 'dana@example.com' },
    update: {},
    create: { email: 'dana@example.com', name: 'Dana R.', role: 'SHOPPER' },
  });

  const kiln = await db.store.findUniqueOrThrow({ where: { slug: 'kiln-and-vessel' }, select: { ownerId: true } });

  const existing = await db.forumThread.count();
  if (existing === 0) {
    const t1 = await db.forumThread.create({
      data: {
        boardId: boardIds.get('Shipping & Fulfillment')!,
        authorId: shopper.id,
        title: 'What are you all paying for sub-1lb ceramics shipping in 2026?',
        body: 'Bought three mugs from different shops here last month and shipping ranged from $6 to $19 for basically the same box. Curious what the actual cost is on the maker side.',
        score: 34, likeCount: 12,
      },
    });
    await db.forumPost.create({
      data: {
        threadId: t1.id, authorId: kiln.ownerId, score: 52, likeCount: 19,
        body: 'Real numbers: a double-boxed mug runs us $8.40 regional, $12.10 cross-country. Anything under that is either subsidised or the piece arrives in pieces. We eat the difference above $9.',
      },
    });
    await db.forumThread.update({ where: { id: t1.id }, data: { replyCount: 1 } });

    await db.forumThread.create({
      data: {
        boardId: boardIds.get('Platform Feedback')!,
        authorId: shopper.id,
        title: 'Is the no-price rule on store cards helping or hurting?',
        body: 'As a shopper I like it. Prices turn browsing into comparison shopping and then I buy nothing. This feels more like flipping through a magazine.',
        score: 61, likeCount: 24,
      },
    });
  }

  // T3 placements so /r/:code can be exercised immediately.
  const ninth = storeIds.get('ninth-hour-candle')!;
  for (const p of [
    { code: 'GRID-4471', venueName: 'Fourth & Vine Coffee', medium: 'DISPLAY' as const },
    { code: 'GRID-4488', venueName: 'Package inserts, batch 12', medium: 'PACKAGING' as const },
  ]) {
    await db.adPlacement.upsert({
      where: { code: p.code },
      update: {},
      create: { ...p, storeId: ninth, currentTargetUrl: 'https://ninthhourcandle.com' },
    });
  }

  console.log(`Done. Admin: ${admin.email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());

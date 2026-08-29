import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';

/**
 * The outbound click loggers, against a real database.
 *
 * These routes carry the primary conversion action of the product — Enter on
 * every store card, and every product tile — so the properties worth pinning
 * down are the ones a shopper feels: that the redirect happens at all, that it
 * never 404s whatever the input, and that a suspended listing stops receiving
 * traffic. The counters are checked too, because they were dead for as long as
 * these routes were missing and the merchant dashboard reads them.
 */

vi.mock('@/lib/authz', () => ({ currentUser: async () => null }));

const { GET: enterGET } = await import('./s/[storeId]/route');
const { GET: productGET } = await import('./p/[productId]/route');

const suffix = Math.random().toString(36).slice(2, 10);
const ids = {
  live: `store-live-${suffix}`,
  suspended: `store-susp-${suffix}`,
  hostile: `store-hostile-${suffix}`,
  bare: `store-bare-${suffix}`,
  productLive: `prod-live-${suffix}`,
  productBroken: `prod-broken-${suffix}`,
  productSuspended: `prod-susp-${suffix}`,
};

const enter = (storeId: string) =>
  enterGET(new Request(`http://localhost:3000/out/s/${storeId}`), {
    params: Promise.resolve({ storeId }),
  });

const product = (productId: string) =>
  productGET(new Request(`http://localhost:3000/out/p/${productId}`), {
    params: Promise.resolve({ productId }),
  });

/** The routes log fire-and-forget, so the write lands just after the response. */
const settle = () => new Promise((r) => setTimeout(r, 250));

async function makeStore(id: string, homeUrl: string, status: 'PUBLISHED' | 'SUSPENDED') {
  const owner = await db.user.create({
    data: { email: `${id}@test.invalid`, role: 'OWNER' },
  });
  return db.store.create({
    data: {
      id,
      slug: id,
      ownerId: owner.id,
      name: id,
      monogram: 'TS',
      story: 'A story.',
      homeUrl,
      status,
    },
  });
}

beforeAll(async () => {
  await makeStore(ids.live, 'https://live.example.com/shop', 'PUBLISHED');
  await makeStore(ids.suspended, 'https://suspended.example.com', 'SUSPENDED');
  await makeStore(ids.hostile, 'javascript:alert(1)', 'PUBLISHED');
  await makeStore(ids.bare, 'bare-host.example', 'PUBLISHED');

  await db.product.create({
    data: {
      id: ids.productLive,
      storeId: ids.live,
      sortOrder: 0,
      title: 'A product',
      imageUrl: 'https://img.example.com/a.png',
      destinationUrl: 'https://live.example.com/product/a',
    },
  });
  await db.product.create({
    data: {
      id: ids.productBroken,
      storeId: ids.live,
      sortOrder: 1,
      title: 'Broken destination',
      imageUrl: 'https://img.example.com/b.png',
      destinationUrl: 'not a url at all',
    },
  });
  await db.product.create({
    data: {
      id: ids.productSuspended,
      storeId: ids.suspended,
      sortOrder: 0,
      title: 'On a suspended store',
      imageUrl: 'https://img.example.com/c.png',
      destinationUrl: 'https://suspended.example.com/product/c',
    },
  });
});

afterAll(async () => {
  await db.clickEvent.deleteMany({ where: { storeId: { in: [ids.live, ids.suspended] } } });
  await db.store.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await db.user.deleteMany({ where: { email: { endsWith: `-${suffix}@test.invalid` } } });
});

describe('GET /out/s/:storeId', () => {
  it('redirects to the storefront and never renders a page', async () => {
    const res = await enter(ids.live);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://live.example.com/shop');
  });

  it('counts the click and writes the event', async () => {
    // Logging is deliberately not awaited by the handler, so an earlier test's
    // write can still be in flight. Let it land before taking the baseline.
    await settle();

    const before = await db.store.findUniqueOrThrow({
      where: { id: ids.live },
      select: { enterClickCount: true },
    });

    await enter(ids.live);
    await settle();

    const after = await db.store.findUniqueOrThrow({
      where: { id: ids.live },
      select: { enterClickCount: true },
    });
    expect(after.enterClickCount).toBe(before.enterClickCount + 1);

    // The counter is a cache; ClickEvent is the source of truth for trends.
    const events = await db.clickEvent.count({ where: { storeId: ids.live, kind: 'ENTER' } });
    expect(events).toBeGreaterThan(0);
  });

  it('never 404s, for any input', async () => {
    for (const id of ['does-not-exist', '', '../etc/passwd', ids.suspended, ids.hostile]) {
      const res = await enter(id);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBeTruthy();
    }
  });

  it('refuses to send traffic to a suspended store', async () => {
    const res = await enter(ids.suspended);
    expect(res.headers.get('location')).not.toContain('suspended.example.com');
  });

  it('does not count a click it did not send anywhere', async () => {
    await enter(ids.suspended);
    await settle();
    const store = await db.store.findUniqueOrThrow({
      where: { id: ids.suspended },
      select: { enterClickCount: true },
    });
    expect(store.enterClickCount).toBe(0);
  });

  it('rejects a stored URL that is not http(s), at click time', async () => {
    // The row predates the write-time allowlist. It must still not reach a
    // shopper's Location header.
    const res = await enter(ids.hostile);
    expect(res.headers.get('location')?.startsWith('javascript:')).toBe(false);
  });

  it('upgrades a bare host the way the merchant typed it', async () => {
    const res = await enter(ids.bare);
    expect(res.headers.get('location')).toBe('https://bare-host.example/');
  });
});

describe('GET /out/p/:productId', () => {
  it('redirects to the product destination and counts it', async () => {
    const res = await product(ids.productLive);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://live.example.com/product/a');

    await settle();
    const p = await db.product.findUniqueOrThrow({
      where: { id: ids.productLive },
      select: { clickCount: true },
    });
    expect(p.clickCount).toBeGreaterThan(0);
  });

  it('falls back to the store when the destination is unusable', async () => {
    // A broken product link still has a merchant behind it.
    const res = await product(ids.productBroken);
    expect(res.headers.get('location')).toBe('https://live.example.com/shop');
  });

  it('never 404s, and will not route to a suspended store', async () => {
    for (const id of ['nope', '', ids.productSuspended]) {
      const res = await product(id);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).not.toContain('suspended.example.com');
    }
  });
});

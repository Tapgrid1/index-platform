import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';

/**
 * The database-level constraints in prisma/sql/constraints.sql.
 *
 * These exist precisely because application-layer checks drift — README puts it
 * plainly about the 150-character cap: "enforced three times, only the first one
 * actually holds". Nothing verified that the first one was still there. A
 * migration that silently dropped one of these would leave every Zod schema and
 * every form still passing, and the guarantee gone.
 *
 * Each test therefore writes through Prisma with the application checks bypassed
 * — the whole point is what happens when something *other* than the happy path
 * writes to the column.
 */

const suffix = Math.random().toString(36).slice(2, 10);
let ownerId: string;
let storeId: string;

beforeAll(async () => {
  const owner = await db.user.create({
    data: { email: `constraints-${suffix}@test.invalid`, role: 'OWNER' },
  });
  ownerId = owner.id;

  const store = await db.store.create({
    data: {
      ownerId,
      slug: `constraints-${suffix}`,
      name: 'Constraint Test Store',
      monogram: 'CT',
      story: 'A story that is comfortably within the cap.',
      homeUrl: 'https://example.com',
    },
  });
  storeId = store.id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: ownerId } });
  await db.$disconnect();
});

describe('products_slot_range', () => {
  it('accepts slots 0 through 4', async () => {
    for (let slot = 0; slot <= 4; slot++) {
      const p = await db.product.create({
        data: {
          storeId,
          sortOrder: slot,
          title: `Slot ${slot}`,
          imageUrl: 'https://example.com/i.png',
          destinationUrl: 'https://example.com/p',
        },
      });
      expect(p.sortOrder).toBe(slot);
    }
  });

  it('rejects a sixth slot at the database', async () => {
    // The cap is five. An application-layer check alone drifts the moment
    // another code path writes.
    await expect(
      db.product.create({
        data: {
          storeId,
          sortOrder: 5,
          title: 'Slot 5',
          imageUrl: 'https://example.com/i.png',
          destinationUrl: 'https://example.com/p',
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects a negative slot', async () => {
    await expect(
      db.product.create({
        data: {
          storeId,
          sortOrder: -1,
          title: 'Negative',
          imageUrl: 'https://example.com/i.png',
          destinationUrl: 'https://example.com/p',
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects two products in the same slot', async () => {
    await expect(
      db.product.create({
        data: {
          storeId,
          sortOrder: 0,
          title: 'Duplicate slot',
          imageUrl: 'https://example.com/i.png',
          destinationUrl: 'https://example.com/p',
        },
      }),
    ).rejects.toThrow();
  });
});

describe('stores_story_not_blank', () => {
  it('rejects a whitespace-only story', async () => {
    await expect(
      db.store.update({ where: { id: storeId }, data: { story: '     ' } }),
    ).rejects.toThrow();
  });

  it('rejects a story over 150 characters at the column', async () => {
    // varchar(150) is the cap that actually holds, independently of Zod.
    await expect(
      db.store.update({ where: { id: storeId }, data: { story: 'x'.repeat(151) } }),
    ).rejects.toThrow();
  });

  it('accepts a story of exactly 150 characters', async () => {
    const story = 'x'.repeat(150);
    const updated = await db.store.update({ where: { id: storeId }, data: { story } });
    expect(updated.story).toHaveLength(150);
  });
});

describe('forum_votes_value', () => {
  it('accepts +1 and -1', async () => {
    const up = await db.forumVote.create({
      data: { userId: ownerId, targetType: 'THREAD', targetId: `t-up-${suffix}`, value: 1 },
    });
    expect(up.value).toBe(1);

    const down = await db.forumVote.create({
      data: { userId: ownerId, targetType: 'THREAD', targetId: `t-down-${suffix}`, value: -1 },
    });
    expect(down.value).toBe(-1);
  });

  it('rejects any other vote weight', async () => {
    // Without this, a bug that writes a weight of 100 silently buys rank.
    await expect(
      db.forumVote.create({
        data: { userId: ownerId, targetType: 'THREAD', targetId: `t-big-${suffix}`, value: 100 },
      }),
    ).rejects.toThrow();

    await expect(
      db.forumVote.create({
        data: { userId: ownerId, targetType: 'THREAD', targetId: `t-zero-${suffix}`, value: 0 },
      }),
    ).rejects.toThrow();
  });
});

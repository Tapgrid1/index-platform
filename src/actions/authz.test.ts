import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Authorization boundary tests.
 *
 * Server actions ARE the authorization boundary in this codebase — middleware
 * only guards page routes, so an action missing its guard is reachable by any
 * caller who can POST, regardless of what the UI shows. That makes "the wrong
 * actor is refused" the highest-value assertion in the repo: a missed check
 * here is a vulnerability, not a cosmetic bug.
 *
 * These tests deliberately assert on *rejection*, not on happy paths. A happy
 * path that breaks shows up immediately in any manual click-through; a guard
 * that silently stops guarding does not.
 */

const session = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@/auth', () => ({
  auth: async () => session.current,
  signOut: async () => undefined,
  signIn: async () => undefined,
}));

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

// Any DB call reaching a mock that was not primed is itself a failure signal:
// it means the guard let the caller through to the data layer.
const db = vi.hoisted(() => ({
  store: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), create: vi.fn() },
  forumBoard: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  forumThread: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  forumPost: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  forumVote: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
  forumLike: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
  userBoardPref: { upsert: vi.fn() },
  report: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  savedStore: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
  product: { upsert: vi.fn(), update: vi.fn() },
  adPlacement: { findUnique: vi.fn(), update: vi.fn() },
  placementRoute: { create: vi.fn() },
  overrideNotice: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  adminAuditLog: { create: vi.fn(), count: vi.fn() },
  viewHistory: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  searchLog: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db }));
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => true),
  overrideNoticeEmail: vi.fn(() => ({ to: '', subject: '', text: '' })),
  verificationDecisionEmail: vi.fn(() => ({ to: '', subject: '', text: '' })),
  passwordResetEmail: vi.fn(() => ({ to: '', subject: '', text: '' })),
}));

import * as admin from './admin';
import * as community from './community';
import * as merchant from './merchant';
import * as shopper from './shopper';
import * as account from './account';
import * as auth from './auth';
import { Forbidden } from '@/lib/authz';

const asAnonymous = () => (session.current = null);
const asShopper = () =>
  (session.current = { user: { id: 'u-shopper', role: 'SHOPPER', status: 'ACTIVE' } });
const asOwner = () =>
  (session.current = { user: { id: 'u-owner', role: 'OWNER', status: 'ACTIVE' } });
const asAdmin = () => (session.current = { user: { id: 'u-admin', role: 'ADMIN', status: 'ACTIVE' } });
const asSuspended = () =>
  (session.current = { user: { id: 'u-susp', role: 'OWNER', status: 'SUSPENDED' } });

beforeEach(() => {
  vi.clearAllMocks();
  asAnonymous();
});

describe('admin actions reject non-admins', () => {
  // Every exported mutation in admin.ts. If a new one is added without a guard,
  // adding it to this list is what catches it.
  const calls: [string, () => Promise<unknown>][] = [
    ['overrideStoreUrl', () => admin.overrideStoreUrl({ storeId: 's1', newUrl: 'https://a.com', reason: 'a good reason' })],
    ['setVerification', () => admin.setVerification('s1', true)],
    ['setSuspension', () => admin.setSuspension('u1', true)],
    ['moderate', () => admin.moderate('r1', 'DISMISS')],
    ['createBoard', () => admin.createBoard('New board')],
    ['renameBoard', () => admin.renameBoard('b1', 'Renamed')],
    ['setBoardArchived', () => admin.setBoardArchived('b1', true)],
    ['reorderBoard', () => admin.reorderBoard('b1', 2)],
    ['moveThread', () => admin.moveThread('t1', 'b1')],
    ['setThreadFlags', () => admin.setThreadFlags('t1', { isPinned: true })],
  ];

  for (const [name, call] of calls) {
    it(`${name} refuses an anonymous caller`, async () => {
      asAnonymous();
      await expect(call()).rejects.toThrow(Forbidden);
    });

    it(`${name} refuses a signed-in shopper`, async () => {
      asShopper();
      await expect(call()).rejects.toThrow(Forbidden);
    });

    it(`${name} refuses a store owner`, async () => {
      // The privilege-escalation case that matters: a legitimate merchant
      // account calling the admin surface directly.
      asOwner();
      await expect(call()).rejects.toThrow(Forbidden);
    });
  }

  it('does not touch the database when refusing', async () => {
    asOwner();
    await expect(admin.setVerification('s1', true)).rejects.toThrow(Forbidden);
    expect(db.store.update).not.toHaveBeenCalled();
    expect(db.adminAuditLog.create).not.toHaveBeenCalled();
  });
});

describe('community actions require an active session', () => {
  const calls: [string, () => Promise<unknown>][] = [
    ['createThread', () => community.createThread({ boardId: 'b1', title: 'A title', body: 'body' })],
    ['createComment', () => community.createComment('t1', 'body')],
    ['vote', () => community.vote('THREAD', 't1', 1)],
    ['toggleLike', () => community.toggleLike('THREAD', 't1')],
    ['setBoardPref', () => community.setBoardPref('b1', { isPinned: true })],
    ['fileReport', () => community.fileReport({ targetType: 'THREAD', targetId: 't1', reason: 'spam' })],
    ['deleteOwnPost', () => community.deleteOwnPost('p1')],
  ];

  for (const [name, call] of calls) {
    it(`${name} refuses an anonymous caller`, async () => {
      asAnonymous();
      await expect(call()).rejects.toThrow(Forbidden);
    });

    it(`${name} refuses a suspended account`, async () => {
      // A suspended user still holds a valid JWT until it rotates, so the
      // status check in currentUser() is the only thing standing in the way.
      asSuspended();
      await expect(call()).rejects.toThrow(Forbidden);
    });
  }

  it('deleteOwnPost refuses someone else’s post', async () => {
    asShopper();
    db.forumPost.findUnique.mockResolvedValue({ authorId: 'someone-else' });
    await expect(community.deleteOwnPost('p1')).rejects.toThrow('Not your post');
    expect(db.forumPost.update).not.toHaveBeenCalled();
  });
});

describe('merchant actions require an owned store', () => {
  const calls: [string, () => Promise<unknown>][] = [
    ['updateStoreCard', () => merchant.updateStoreCard({ name: 'Shop', monogram: 'SH', story: 'A story', homeUrl: 'https://a.com', categoryId: null })],
    ['upsertProduct', () => merchant.upsertProduct({ sortOrder: 0, title: 'T', destinationUrl: 'https://a.com/p', imageUrl: 'https://a.com/i.png' })],
    ['setProductImage', () => merchant.setProductImage(0, 'https://a.com/i.png')],
    ['setPlacementRoute', () => merchant.setPlacementRoute('pl1', 'https://a.com')],
    ['revertOverride', () => merchant.revertOverride('n1')],
    ['acknowledgeOverride', () => merchant.acknowledgeOverride('n1')],
  ];

  for (const [name, call] of calls) {
    it(`${name} refuses an anonymous caller`, async () => {
      asAnonymous();
      await expect(call()).rejects.toThrow(Forbidden);
    });

    it(`${name} refuses a signed-in user with no store`, async () => {
      asShopper();
      db.store.findUnique.mockResolvedValue(null);
      await expect(call()).rejects.toThrow(Forbidden);
    });
  }

  it('revertOverride refuses a notice belonging to another store', async () => {
    // Cross-tenant access: the guard proves ownership of *a* store, and the
    // per-record check is what proves ownership of *this* record.
    asOwner();
    db.store.findUnique.mockResolvedValue({ id: 'store-mine', ownerId: 'u-owner' });
    db.overrideNotice.findUnique.mockResolvedValue({ id: 'n1', storeId: 'store-theirs' });

    await expect(merchant.revertOverride('n1')).rejects.toThrow('Not your notice');
    expect(db.store.update).not.toHaveBeenCalled();
  });

  it('setPlacementRoute refuses a placement belonging to another store', async () => {
    asOwner();
    db.store.findUnique.mockResolvedValue({ id: 'store-mine', ownerId: 'u-owner' });
    db.user.findUnique.mockResolvedValue({ subscriptionTier: 'T3' });
    db.adPlacement.findUnique.mockResolvedValue({ id: 'pl1', storeId: 'store-theirs' });

    await expect(merchant.setPlacementRoute('pl1', 'https://a.com')).rejects.toThrow('Not your placement');
    expect(db.placementRoute.create).not.toHaveBeenCalled();
  });

  it('setPlacementRoute is gated on the Network tier', async () => {
    // Routing is the one genuinely tier-gated capability (§3); everything else
    // free at every tier. A regression here gives away the moat.
    asOwner();
    db.store.findUnique.mockResolvedValue({ id: 'store-mine', ownerId: 'u-owner' });
    db.user.findUnique.mockResolvedValue({ subscriptionTier: 'T2' });

    await expect(merchant.setPlacementRoute('pl1', 'https://a.com')).rejects.toThrow(/Network tier/);
    expect(db.adPlacement.update).not.toHaveBeenCalled();
  });
});

describe('shopper actions', () => {
  it('toggleSave requires a session', async () => {
    asAnonymous();
    await expect(shopper.toggleSave('s1')).rejects.toThrow(Forbidden);
  });

  it('recordView is a silent no-op when anonymous', async () => {
    // Deliberately not a throw: this is called during page render, and an
    // anonymous visitor browsing must not hit an error.
    asAnonymous();
    await expect(shopper.recordView('s1')).resolves.toBeUndefined();
    expect(db.viewHistory.create).not.toHaveBeenCalled();
  });
});

describe('account actions', () => {
  it('exportMyData requires a session', async () => {
    asAnonymous();
    await expect(account.exportMyData()).rejects.toThrow(Forbidden);
  });

  it('deleteMyAccount requires a session', async () => {
    asAnonymous();
    await expect(account.deleteMyAccount()).rejects.toThrow(Forbidden);
  });

  it('deleteMyAccount refuses an account that has taken admin actions', async () => {
    // admin_audit_log.admin is onDelete: Restrict on purpose — the record of
    // who did what must not be dissolvable by deleting the who.
    asAdmin();
    db.user.findUnique.mockResolvedValue({ id: 'u-admin', role: 'ADMIN' });
    db.adminAuditLog.count.mockResolvedValue(3);

    await expect(account.deleteMyAccount()).rejects.toThrow(/audit log/i);
    expect(db.user.delete).not.toHaveBeenCalled();
  });

  it('deleteMyAccount refuses to destroy a store without explicit confirmation', async () => {
    asOwner();
    db.user.findUnique.mockResolvedValue({ id: 'u-owner', role: 'OWNER' });
    db.adminAuditLog.count.mockResolvedValue(0);
    db.store.findUnique.mockResolvedValue({ id: 'store-1' });

    await expect(account.deleteMyAccount()).rejects.toThrow(/owns a published store/i);
    expect(db.user.delete).not.toHaveBeenCalled();
  });
});

describe('createStore', () => {
  const valid = {
    name: 'Kiln & Vessel',
    monogram: 'kv',
    story: 'Two potters, one gas kiln.',
    homeUrl: 'kilnandvessel.com',
    categoryId: null,
  };

  const primeWrites = () => {
    db.store.findMany.mockResolvedValue([]);
    db.store.create.mockResolvedValue({ id: 'store-new', slug: 'kiln-vessel' });
    db.user.update.mockResolvedValue({});
    db.$transaction.mockImplementation(async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : ops,
    );
  };

  it('refuses an anonymous caller', async () => {
    asAnonymous();
    await expect(merchant.createStore(valid)).rejects.toThrow(Forbidden);
    expect(db.store.create).not.toHaveBeenCalled();
  });

  it('refuses a suspended account', async () => {
    asSuspended();
    await expect(merchant.createStore(valid)).rejects.toThrow(Forbidden);
    expect(db.store.create).not.toHaveBeenCalled();
  });

  it('refuses a second store on an account that already has one', async () => {
    // Store.ownerId is @unique, so the database refuses this too. The check
    // exists so the form gets a message rather than a constraint violation —
    // and this test is what proves the check runs before the write.
    asOwner();
    db.store.findUnique.mockResolvedValue({ id: 'store-existing' });

    await expect(merchant.createStore(valid)).rejects.toThrow(/already has a store/i);
    expect(db.store.create).not.toHaveBeenCalled();
  });

  it('refuses a storefront URL that is not http(s)', async () => {
    // The same allowlist the Enter button relies on. A javascript: homeUrl
    // stored here would be reflected into a Location header later.
    asShopper();
    db.store.findUnique.mockResolvedValue(null);

    await expect(
      merchant.createStore({ ...valid, homeUrl: 'javascript:alert(1)' }),
    ).rejects.toThrow(/valid http/i);
    expect(db.store.create).not.toHaveBeenCalled();
  });

  it('promotes the creating shopper to OWNER', async () => {
    // The whole point of the action: a Google account arrives as a SHOPPER, and
    // without this it would be bounced straight back out of the portal.
    asShopper();
    db.store.findUnique.mockResolvedValue(null);
    primeWrites();

    await merchant.createStore(valid);

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'OWNER' } }),
    );
  });

  it('does not demote an admin who creates a store', async () => {
    asAdmin();
    db.store.findUnique.mockResolvedValue(null);
    primeWrites();

    await merchant.createStore(valid);

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'ADMIN' } }),
    );
  });

  it('normalises the monogram and derives a slug', async () => {
    asShopper();
    db.store.findUnique.mockResolvedValue(null);
    primeWrites();

    await merchant.createStore(valid);

    expect(db.store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          monogram: 'KV',
          slug: 'kiln-vessel',
          homeUrl: 'https://kilnandvessel.com/',
          status: 'PUBLISHED',
        }),
      }),
    );
  });

  it('suffixes a slug that is already taken', async () => {
    asShopper();
    db.store.findUnique.mockResolvedValue(null);
    primeWrites();
    db.store.findMany.mockResolvedValue([{ slug: 'kiln-vessel' }, { slug: 'kiln-vessel-2' }]);

    await merchant.createStore(valid);

    expect(db.store.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'kiln-vessel-3' }) }),
    );
  });
});

describe('registerWithPassword', () => {
  const valid = { email: 'New@Example.com', password: 'a-long-enough-password' };

  it('refuses an email that is already registered', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u-existing' });
    await expect(auth.registerWithPassword(valid)).rejects.toThrow(/already exists/i);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('refuses a password below the reset flow’s minimum', async () => {
    // Sign-up and reset must agree. A weaker bar here would mean the only way
    // to get a short password onto an account is to register with one.
    db.user.findUnique.mockResolvedValue(null);
    await expect(
      auth.registerWithPassword({ ...valid, password: 'short' }),
    ).rejects.toThrow();
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('never stores the password in the clear, and normalises the address', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: 'u-new' });

    await auth.registerWithPassword(valid);

    const { data } = db.user.create.mock.calls[0][0];
    expect(data.email).toBe('new@example.com');
    expect(data.passwordHash).not.toBe(valid.password);
    expect(data.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(data.role).toBe('SHOPPER');
  });

  it('creates an OWNER when the intent is to sell', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: 'u-new' });

    const result = await auth.registerWithPassword({ ...valid, intent: 'sell' });

    expect(db.user.create.mock.calls[0][0].data.role).toBe('OWNER');
    expect(result.next).toBe('/merchant/new');
  });
});

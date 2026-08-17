import { db } from '@/lib/db';

/**
 * Account export and erasure.
 *
 * docs/DECISIONS.md flags this as cheap now and expensive to retrofit "after
 * the first request arrives", and that is exactly right: social auth, search
 * logs, browsing history and coarse scan geo put this product in scope for real
 * disclosure obligations.
 *
 * The hard part is not deletion, it is deletion that does not corrupt everything
 * around it. Three problems the schema creates and this module solves:
 *
 *  1. Cascades leave counters lying. saved_stores cascades on user delete, but
 *     Store.savedCount does not — so the metric that leads the merchant
 *     dashboard would drift upward permanently on every account closure.
 *  2. Cascades destroy other people's conversations. ForumThread.author and
 *     ForumPost.author both cascade, so a plain delete would take a thread and
 *     everyone's replies to it with the departing account.
 *  3. Admins must not be deletable while their audit rows exist. That is
 *     enforced by onDelete: Restrict on admin_audit_log and is deliberate —
 *     see below.
 */

/** Sentinel author that departed users' forum content is reassigned to. */
const TOMBSTONE_EMAIL = 'deleted-user@index.invalid';

/**
 * The tombstone is BANNED, has no password hash and owns a .invalid address, so
 * it can never obtain a session: auth.ts refuses any account whose status is
 * not ACTIVE, and there is no credential to present in the first place.
 */
async function tombstoneUser() {
  const existing = await db.user.findUnique({ where: { email: TOMBSTONE_EMAIL } });
  if (existing) return existing;

  return db.user.create({
    data: {
      email: TOMBSTONE_EMAIL,
      name: '[deleted]',
      role: 'SHOPPER',
      status: 'BANNED',
    },
  });
}

export type AccountExport = Awaited<ReturnType<typeof collectAccountExport>>;

/**
 * Everything the platform holds about one person, in one object.
 *
 * Includes the derived records people forget they generated — view history and
 * the search log especially — because an export that only returns the profile
 * the user typed in themselves is not an export.
 */
export async function collectAccountExport(userId: string) {
  const [user, saved, views, searches, threads, posts, votes, likes, boardPrefs, reports, store] =
    await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          status: true,
          subscriptionTier: true,
          billingStatus: true,
          trialEndsAt: true,
          createdAt: true,
          lastSeenAt: true,
        },
      }),
      db.savedStore.findMany({
        where: { userId },
        select: { createdAt: true, store: { select: { id: true, name: true, slug: true } } },
      }),
      db.viewHistory.findMany({
        where: { userId },
        orderBy: { viewedAt: 'desc' },
        select: { viewedAt: true, store: { select: { id: true, name: true } } },
      }),
      db.searchLog.findMany({
        where: { userId },
        orderBy: { searchedAt: 'desc' },
        select: { query: true, resultCount: true, searchedAt: true },
      }),
      db.forumThread.findMany({
        where: { authorId: userId },
        select: { id: true, title: true, body: true, createdAt: true, isDeleted: true },
      }),
      db.forumPost.findMany({
        where: { authorId: userId },
        select: { id: true, threadId: true, body: true, createdAt: true, isDeleted: true },
      }),
      db.forumVote.findMany({
        where: { userId },
        select: { targetType: true, targetId: true, value: true },
      }),
      db.forumLike.findMany({
        where: { userId },
        select: { targetType: true, targetId: true, createdAt: true },
      }),
      db.userBoardPref.findMany({
        where: { userId },
        select: { boardId: true, isPinned: true, isHidden: true, sortOrder: true },
      }),
      db.report.findMany({
        where: { reporterId: userId },
        select: { targetType: true, targetId: true, reason: true, status: true, createdAt: true },
      }),
      db.store.findUnique({
        where: { ownerId: userId },
        select: {
          id: true,
          slug: true,
          name: true,
          story: true,
          homeUrl: true,
          status: true,
          isVerifiedMaker: true,
          createdAt: true,
          products: {
            orderBy: { sortOrder: 'asc' },
            select: { title: true, destinationUrl: true, sortOrder: true, clickCount: true },
          },
        },
      }),
    ]);

  if (!user) throw new Error('Account not found');

  return {
    exportedAt: new Date().toISOString(),
    format: 'index-platform/account-export@1',
    user,
    store,
    savedStores: saved,
    viewHistory: views,
    searchLog: searches,
    forum: { threads, posts, votes, likes, boardPrefs },
    reportsFiled: reports,
  };
}

export class AccountDeletionBlocked extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'AccountDeletionBlocked';
  }
}

/**
 * Hard-deletes the account and everything personal to it, while leaving the
 * community and merchant metrics consistent.
 *
 * Note this is a real delete of the user row, not an in-place anonymisation.
 * Anonymising is easier and is what most implementations settle for, but it
 * leaves a row that still joins to everything the person did — which is not
 * what someone asking to be deleted is asking for.
 */
export async function deleteAccount(userId: string, opts: { confirmStoreDeletion?: boolean } = {}) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user) throw new AccountDeletionBlocked('Account not found');

  /**
   * An admin with audit rows cannot be deleted, and this is not an oversight to
   * work around: admin_audit_log.admin is onDelete: Restrict precisely so that
   * the record of who did what cannot be dissolved by deleting the who. Such an
   * account has to be demoted and handed over, not erased.
   */
  const auditRows = await db.adminAuditLog.count({ where: { adminId: userId } });
  if (auditRows > 0) {
    throw new AccountDeletionBlocked(
      'This account has taken administrative actions and cannot be deleted — the audit log must stay attributable. Demote the account and transfer ownership instead.',
    );
  }

  const store = await db.store.findUnique({ where: { ownerId: userId }, select: { id: true } });
  if (store && !opts.confirmStoreDeletion) {
    throw new AccountDeletionBlocked(
      'This account owns a published store. Deleting it removes the storefront, its products and its placements. Confirm explicitly to proceed.',
    );
  }

  const tombstone = await tombstoneUser();
  if (tombstone.id === userId) throw new AccountDeletionBlocked('Cannot delete the tombstone account');

  const [saved, votes, likes] = await Promise.all([
    db.savedStore.findMany({ where: { userId }, select: { storeId: true } }),
    db.forumVote.findMany({ where: { userId }, select: { targetType: true, targetId: true, value: true } }),
    db.forumLike.findMany({ where: { userId }, select: { targetType: true, targetId: true } }),
  ]);

  await db.$transaction(async (tx) => {
    // 1. Unwind the counters this user contributed to, before the cascade
    //    removes the rows that prove they contributed.
    for (const row of saved) {
      await tx.store.update({
        where: { id: row.storeId },
        data: { savedCount: { decrement: 1 } },
      });
    }

    for (const v of votes) {
      if (v.targetType === 'THREAD') {
        await tx.forumThread
          .update({ where: { id: v.targetId }, data: { score: { decrement: v.value } } })
          .catch(() => {});
      } else if (v.targetType === 'POST') {
        await tx.forumPost
          .update({ where: { id: v.targetId }, data: { score: { decrement: v.value } } })
          .catch(() => {});
      }
    }

    for (const l of likes) {
      if (l.targetType === 'THREAD') {
        await tx.forumThread
          .update({ where: { id: l.targetId }, data: { likeCount: { decrement: 1 } } })
          .catch(() => {});
      } else if (l.targetType === 'POST') {
        await tx.forumPost
          .update({ where: { id: l.targetId }, data: { likeCount: { decrement: 1 } } })
          .catch(() => {});
      }
    }

    // 2. Hand authored content to the tombstone so the cascade cannot take
    //    other people's replies with it. The body is scrubbed — the person is
    //    leaving, and their words are personal data too — but the row survives
    //    so the thread still reads as a conversation.
    await tx.forumThread.updateMany({
      where: { authorId: userId },
      data: { authorId: tombstone.id, body: '[removed by author]' },
    });
    await tx.forumPost.updateMany({
      where: { authorId: userId },
      data: { authorId: tombstone.id, body: '[removed by author]', isDeleted: true },
    });

    // 3. Reports keep the moderation record intact; the reporter is detached.
    await tx.report.updateMany({
      where: { reporterId: userId },
      data: { reporterId: tombstone.id },
    });

    // 4. Everything else is personal state and goes with the cascade:
    //    accounts, sessions, saved_stores, view_history, votes, likes,
    //    board prefs, and the store if one is owned. search_log is SetNull, so
    //    those rows survive as anonymous — which is what the table is for.
    await tx.user.delete({ where: { id: userId } });
  });

  return { deleted: true, storeRemoved: !!store };
}

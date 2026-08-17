'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/authz';
import { recordAudit } from '@/lib/audit';
import { safeExternalUrl } from '@/lib/url';
import { sendEmail, overrideNoticeEmail, verificationDecisionEmail } from '@/lib/email';

/**
 * THE OVERRIDE SWITCH — the highest-risk action in the product.
 *
 * Guardrails, all mandatory:
 *   1. reason required (stored on the audit row)
 *   2. before/after captured
 *   3. merchant notified automatically, with one-click revert
 *   4. cross-domain repoints require explicit confirmation — indistinguishable
 *      from an attack otherwise
 */
export async function overrideStoreUrl(input: {
  storeId: string;
  newUrl: string;
  reason: string;
  confirmedDomainChange?: boolean;
}) {
  const admin = await requireAdmin();

  const reason = z.string().trim().min(8, 'A real reason is required').max(500).parse(input.reason);
  const raw = z.string().trim().min(4).max(200).parse(input.newUrl);

  // The override writes the destination every shopper is sent to. A value that
  // will not survive safeExternalUrl at click time is a silently dead Enter
  // button, so it is rejected here rather than discovered by a merchant later.
  const newUrl = safeExternalUrl(raw);
  if (!newUrl) throw new Error('That is not a usable http(s) URL');

  const store = await db.store.findUnique({
    where: { id: input.storeId },
    select: { id: true, homeUrl: true, name: true, owner: { select: { email: true } } },
  });
  if (!store) throw new Error('Store not found');

  if (host(newUrl) !== host(store.homeUrl) && !input.confirmedDomainChange) {
    throw new Error(
      'DOMAIN_CHANGE_REQUIRES_CONFIRMATION: repointing a merchant to an unrelated domain needs a second confirmation.',
    );
  }

  await db.$transaction([
    db.store.update({ where: { id: store.id }, data: { homeUrl: newUrl } }),
    // The merchant finds out immediately, in-portal and by email, with a revert.
    db.overrideNotice.create({
      data: {
        storeId: store.id,
        field: 'homeUrl',
        beforeValue: store.homeUrl,
        afterValue: newUrl,
        reason,
        adminId: admin.id,
      },
    }),
  ]);

  await recordAudit({
    adminId: admin.id,
    action: 'merchant.override',
    targetType: 'store',
    targetId: store.id,
    before: { homeUrl: store.homeUrl },
    after: { homeUrl: newUrl },
    reason,
  });

  // The in-portal banner is the guarantee; the email is the thing that reaches
  // a merchant who is not logged in right now. Deliberately after the audit
  // write and never awaited into the failure path — the override is already
  // recorded, and a mail outage must not roll it back or surface as an error.
  if (store.owner.email) {
    void sendEmail(
      overrideNoticeEmail({
        to: store.owner.email,
        storeName: store.name,
        field: 'storefront URL',
        before: store.homeUrl,
        after: newUrl,
        reason,
      }),
    );
  }

  revalidatePath('/tg-admin/merchants');
  revalidatePath('/merchant');
}

const host = (u: string) => {
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).host.replace(/^www\./, '');
  } catch {
    return u;
  }
};

/** Verified Maker. Manual grant, never tier-correlated: a purchasable badge is
 *  not a trust signal, and the badge's value in the forum is the entire point. */
export async function setVerification(storeId: string, granted: boolean, note?: string) {
  const admin = await requireAdmin();
  const before = await db.store.findUnique({
    where: { id: storeId },
    select: {
      isVerifiedMaker: true,
      verificationState: true,
      name: true,
      owner: { select: { email: true } },
    },
  });

  await db.store.update({
    where: { id: storeId },
    data: {
      isVerifiedMaker: granted,
      verificationState: granted ? 'GRANTED' : 'DENIED',
      verifiedAt: granted ? new Date() : null,
      verifiedByAdminId: granted ? admin.id : null,
    },
  });

  await recordAudit({
    adminId: admin.id,
    action: granted ? 'verification.granted' : 'verification.denied',
    targetType: 'store',
    targetId: storeId,
    before,
    after: { isVerifiedMaker: granted },
    reason: note,
  });

  // Verification is a queue the merchant is waiting on; a decision they are
  // never told about is indistinguishable from one that was never made.
  if (before?.owner.email) {
    void sendEmail(
      verificationDecisionEmail({
        to: before.owner.email,
        storeName: before.name,
        granted,
        note,
      }),
    );
  }

  revalidatePath('/');
  revalidatePath('/community');
  revalidatePath('/tg-admin/verification');
}

/**
 * Suspension unpublishes the listing AND pauses billing in the same
 * transaction. Suspending without pausing billing charges a merchant whose
 * storefront is hidden.
 */
export async function setSuspension(userId: string, suspended: boolean, reason?: string) {
  const admin = await requireAdmin();

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        status: suspended ? 'SUSPENDED' : 'ACTIVE',
        suspendedReason: suspended ? (reason ?? 'Policy review') : null,
        billingStatus: suspended ? 'PAST_DUE' : 'ACTIVE',
      },
    });
    const store = await tx.store.findUnique({ where: { ownerId: userId }, select: { id: true } });
    if (store) {
      await tx.store.update({
        where: { id: store.id },
        data: { status: suspended ? 'SUSPENDED' : 'PUBLISHED' },
      });
    }
  });

  await recordAudit({
    adminId: admin.id,
    action: suspended ? 'account.suspended' : 'account.restored',
    targetType: 'user',
    targetId: userId,
    after: { suspended, billingPaused: suspended },
    reason,
  });

  revalidatePath('/tg-admin/merchants');
  revalidatePath('/');
}

/** Admin deletion preserves the original text on the audit row for any later
 *  dispute. Self-deletion tombstones instead — different handler on purpose. */
export async function moderate(reportId: string, action: 'DELETE' | 'BAN' | 'DISMISS', note?: string) {
  const admin = await requireAdmin();
  const report = await db.report.findUnique({ where: { id: reportId } });
  if (!report) throw new Error('Report not found');

  if (action !== 'DISMISS' && report.targetType === 'THREAD') {
    const thread = await db.forumThread.findUnique({ where: { id: report.targetId } });
    if (thread) {
      await db.forumThread.update({
        where: { id: thread.id },
        data: { isDeleted: true, deletedByAdminId: admin.id, deletedAt: new Date() },
      });
      await recordAudit({
        adminId: admin.id,
        action: 'content.deleted',
        targetType: 'thread',
        targetId: thread.id,
        before: { title: thread.title, body: thread.body }, // preserved deliberately
        reason: note,
      });
      if (action === 'BAN') {
        await db.user.update({ where: { id: thread.authorId }, data: { status: 'BANNED' } });
        await recordAudit({
          adminId: admin.id,
          action: 'user.banned',
          targetType: 'user',
          targetId: thread.authorId,
          reason: note,
        });
      }
    }
  }

  await db.report.update({
    where: { id: reportId },
    data: {
      status: action === 'DISMISS' ? 'DISMISSED' : 'ACTIONED',
      resolvedByAdminId: admin.id,
      resolutionNote: note,
      resolvedAt: new Date(),
    },
  });

  revalidatePath('/tg-admin/moderation');
  revalidatePath('/community');
}

// ── community administration (proactive, distinct from the report queue) ──

export async function createBoard(name: string) {
  const admin = await requireAdmin();
  const clean = z.string().trim().min(2).max(60).parse(name);
  const board = await db.forumBoard.create({
    data: { name: clean, slug: slugify(clean), sortOrder: await nextBoardOrder() },
  });
  await recordAudit({ adminId: admin.id, action: 'board.created', targetType: 'board', targetId: board.id, after: { name: clean } });
  revalidatePath('/community');
  revalidatePath('/tg-admin/community');
}

/** Renaming rewrites the slug; thread URLs are unaffected because they never
 *  encode the board slug. That is the whole reason for that rule. */
export async function renameBoard(boardId: string, name: string) {
  const admin = await requireAdmin();
  const clean = z.string().trim().min(2).max(60).parse(name);
  const before = await db.forumBoard.findUnique({ where: { id: boardId } });
  await db.forumBoard.update({ where: { id: boardId }, data: { name: clean, slug: slugify(clean) } });
  await recordAudit({ adminId: admin.id, action: 'board.renamed', targetType: 'board', targetId: boardId, before, after: { name: clean } });
  revalidatePath('/community');
  revalidatePath('/tg-admin/community');
}

/** Archive hides a board and preserves its threads. Deletion is not offered. */
export async function setBoardArchived(boardId: string, archived: boolean) {
  const admin = await requireAdmin();
  await db.forumBoard.update({ where: { id: boardId }, data: { isArchived: archived } });
  await recordAudit({
    adminId: admin.id,
    action: archived ? 'board.archived' : 'board.restored',
    targetType: 'board',
    targetId: boardId,
    after: { archived },
  });
  revalidatePath('/community');
  revalidatePath('/tg-admin/community');
}

export async function reorderBoard(boardId: string, sortOrder: number) {
  const admin = await requireAdmin();
  await db.forumBoard.update({ where: { id: boardId }, data: { sortOrder } });
  await recordAudit({ adminId: admin.id, action: 'board.reordered', targetType: 'board', targetId: boardId, after: { sortOrder } });
  revalidatePath('/tg-admin/community');
}

export async function moveThread(threadId: string, boardId: string) {
  const admin = await requireAdmin();
  const before = await db.forumThread.findUnique({ where: { id: threadId }, select: { boardId: true } });
  await db.forumThread.update({ where: { id: threadId }, data: { boardId } });
  await recordAudit({ adminId: admin.id, action: 'thread.moved', targetType: 'thread', targetId: threadId, before, after: { boardId } });
  revalidatePath('/community');
  revalidatePath('/tg-admin/community');
}

export async function setThreadFlags(threadId: string, flags: { isPinned?: boolean; isLocked?: boolean }) {
  const admin = await requireAdmin();
  await db.forumThread.update({ where: { id: threadId }, data: flags });
  await recordAudit({
    adminId: admin.id,
    action: flags.isPinned !== undefined ? 'thread.pin_toggled' : 'thread.lock_toggled',
    targetType: 'thread',
    targetId: threadId,
    after: flags,
  });
  revalidatePath('/community');
  revalidatePath('/tg-admin/community');
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function nextBoardOrder() {
  const last = await db.forumBoard.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
  return (last?.sortOrder ?? 0) + 1;
}

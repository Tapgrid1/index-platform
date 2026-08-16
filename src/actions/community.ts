'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/authz';
import type { TargetType } from '@prisma/client';

/**
 * Forum parity: shoppers and owners call exactly these same actions with
 * exactly the same rights. The only difference anywhere in the community is
 * the Verified Maker badge, which is a display concern.
 */

const bodySchema = z.string().trim().min(1).max(10_000);

export async function createThread(input: { boardId: string; title: string; body: string; sharedStoreId?: string }) {
  const user = await requireUser();
  const title = z.string().trim().min(3).max(200).parse(input.title);
  const body = bodySchema.parse(input.body);

  const board = await db.forumBoard.findUnique({ where: { id: input.boardId } });
  if (!board || board.isArchived) throw new Error('Board unavailable');

  const thread = await db.forumThread.create({
    data: {
      boardId: board.id,
      authorId: user.id,
      title,
      body,
      sharedStoreId: input.sharedStoreId ?? null,
      score: 1,
    },
  });

  revalidatePath('/community');
  return thread.id;
}

export async function createComment(threadId: string, body: string) {
  const user = await requireUser();
  const text = bodySchema.parse(body);

  const thread = await db.forumThread.findUnique({
    where: { id: threadId },
    select: { id: true, isLocked: true, isDeleted: true },
  });
  if (!thread || thread.isDeleted) throw new Error('Thread not found');
  // Locked threads stay readable; they just take no new comments.
  if (thread.isLocked) throw new Error('Thread is locked');

  await db.$transaction([
    db.forumPost.create({ data: { threadId, authorId: user.id, body: text } }),
    db.forumThread.update({ where: { id: threadId }, data: { replyCount: { increment: 1 } } }),
  ]);

  revalidatePath('/community');
  revalidatePath(`/community/t/${threadId}`);
}

/** Votes rank content. One vote per user per target. */
export async function vote(targetType: TargetType, targetId: string, value: 1 | -1) {
  const user = await requireUser();
  const key = { userId_targetType_targetId: { userId: user.id, targetType, targetId } };
  const existing = await db.forumVote.findUnique({ where: key });

  let delta: number = value;
  if (existing?.value === value) {
    await db.forumVote.delete({ where: key });
    delta = -value;
  } else if (existing) {
    await db.forumVote.update({ where: key, data: { value } });
    delta = value * 2;
  } else {
    await db.forumVote.create({ data: { userId: user.id, targetType, targetId, value } });
  }

  if (targetType === 'THREAD') {
    await db.forumThread.update({ where: { id: targetId }, data: { score: { increment: delta } } });
  } else if (targetType === 'POST') {
    await db.forumPost.update({ where: { id: targetId }, data: { score: { increment: delta } } });
  }

  revalidatePath('/community');
}

/**
 * Likes signal appreciation and deliberately do NOT touch rank. Separate table,
 * separate counter — collapsing likes into votes loses the ability to sort by
 * one and display the other.
 */
export async function toggleLike(targetType: TargetType, targetId: string) {
  const user = await requireUser();
  const key = { userId_targetType_targetId: { userId: user.id, targetType, targetId } };
  const existing = await db.forumLike.findUnique({ where: key });
  const delta = existing ? -1 : 1;

  if (existing) await db.forumLike.delete({ where: key });
  else await db.forumLike.create({ data: { userId: user.id, targetType, targetId } });

  if (targetType === 'THREAD') {
    await db.forumThread.update({ where: { id: targetId }, data: { likeCount: { increment: delta } } });
  } else if (targetType === 'POST') {
    await db.forumPost.update({ where: { id: targetId }, data: { likeCount: { increment: delta } } });
  }

  revalidatePath('/community');
  return { liked: !existing };
}

/** Per-user sidebar preferences. Never cached alongside the global board list. */
export async function setBoardPref(boardId: string, patch: { isPinned?: boolean; isHidden?: boolean }) {
  const user = await requireUser();
  await db.userBoardPref.upsert({
    where: { userId_boardId: { userId: user.id, boardId } },
    create: { userId: user.id, boardId, ...patch },
    update: patch,
  });
  revalidatePath('/community');
}

export async function fileReport(input: {
  targetType: TargetType;
  targetId: string;
  reason: string;
  notes?: string;
}) {
  const user = await requireUser();
  await db.report.create({
    data: {
      reporterId: user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: z.string().trim().min(2).max(120).parse(input.reason),
      notes: input.notes?.slice(0, 2000),
    },
  });
  revalidatePath('/tg-admin/moderation');
}

/** Self-deletion tombstones. Admin deletion is a different operation entirely
 *  (see actions/admin.ts) because it must preserve the text for the audit log. */
export async function deleteOwnPost(postId: string) {
  const user = await requireUser();
  const post = await db.forumPost.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (post?.authorId !== user.id) throw new Error('Not your post');

  await db.forumPost.update({
    where: { id: postId },
    data: { isDeleted: true, deletedAt: new Date(), body: '[removed by author]' },
  });
  revalidatePath('/community');
}

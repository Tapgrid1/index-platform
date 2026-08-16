import { db } from '@/lib/db';
import { BoardControls, NewBoardButton, ThreadControls } from '@/components/AdminClient';

/** Proactive forum administration. Distinct from the reactive, report-driven
 *  moderation queue — both write to the same append-only audit log. */
export default async function AdminCommunity() {
  const [boards, threads] = await Promise.all([
    db.forumBoard.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { threads: true } } } }),
    db.forumThread.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, title: true, score: true, likeCount: true, replyCount: true,
        isPinned: true, isLocked: true, boardId: true,
        author: { select: { name: true, role: true, store: { select: { name: true } } } },
      },
    }),
  ]);
  const active = boards.filter((b) => !b.isArchived);

  return (
    <>
      <h2 className="font-sans text-lg tracking-tight text-white">Community Administration</h2>
      <p className="mb-6 text-[11.5px] tracking-wide text-[#5c6470]">BOARD STRUCTURE &amp; THREAD CONTROLS</p>

      <div className="mb-4 border border-admin-line bg-admin-panel p-4">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="text-[9.5px] tracking-[0.11em] text-[#5c6470]">BOARDS · {active.length} ACTIVE</div>
          <NewBoardButton />
        </div>
        <table className="w-full border-collapse">
          <thead><tr>{['#', 'BOARD', 'THREADS', 'STATE', 'ACTIONS'].map((h) => (
            <th key={h} className="border-b border-admin-line px-2 py-2 text-left text-[9.5px] font-medium tracking-[0.11em] text-[#5c6470]">{h}</th>
          ))}</tr></thead>
          <tbody>
            {boards.map((b, i) => (
              <tr key={b.id}>
                <td className="border-b border-[#1d2128] px-2 py-2 text-[#5c6470]">{i + 1}</td>
                <td className="border-b border-[#1d2128] px-2 py-2"><b className="text-white">{b.name}</b>
                  <div className="text-[10px] text-[#5c6470]">/{b.slug}</div></td>
                <td className="border-b border-[#1d2128] px-2 py-2">{b._count.threads}</td>
                <td className="border-b border-[#1d2128] px-2 py-2">{b.isArchived ? 'ARCHIVED' : 'ACTIVE'}</td>
                <td className="border-b border-[#1d2128] px-2 py-2"><BoardControls boardId={b.id} archived={b.isArchived} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[10.5px] leading-relaxed text-[#5c6470]">
          Renaming rewrites the slug in one transaction; thread URLs are unaffected because they never encode it.
          Archiving hides a board without destroying threads — deletion is deliberately not offered.
        </p>
      </div>

      <div className="border border-admin-line bg-admin-panel p-4">
        <div className="mb-3.5 text-[9.5px] tracking-[0.11em] text-[#5c6470]">THREAD INDEX</div>
        <table className="w-full border-collapse">
          <thead><tr>{['THREAD', 'AUTHOR', 'ENGAGEMENT', 'CONTROLS'].map((h) => (
            <th key={h} className="border-b border-admin-line px-2 py-2 text-left text-[9.5px] font-medium tracking-[0.11em] text-[#5c6470]">{h}</th>
          ))}</tr></thead>
          <tbody>
            {threads.map((t) => (
              <tr key={t.id}>
                <td className="max-w-[260px] border-b border-[#1d2128] px-2 py-2">
                  <b className="font-sans text-xs text-white">{t.title.slice(0, 52)}{t.title.length > 52 ? '…' : ''}</b>
                  <div className="text-[10px] text-[#5c6470]">
                    {t.isPinned && '📌 pinned · '}{t.isLocked && '🔒 locked · '}{t.id.slice(0, 8)}
                  </div>
                </td>
                <td className="border-b border-[#1d2128] px-2 py-2">{t.author.store?.name ?? t.author.name}</td>
                <td className="border-b border-[#1d2128] px-2 py-2 text-[10.5px]">
                  {t.score > 0 ? '+' : ''}{t.score} rank · {t.likeCount} likes · {t.replyCount} replies
                </td>
                <td className="border-b border-[#1d2128] px-2 py-2">
                  <ThreadControls threadId={t.id} boardId={t.boardId} pinned={t.isPinned} locked={t.isLocked}
                    boards={active.map((b) => ({ id: b.id, name: b.name }))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

import { Header } from '@/components/Header';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/authz';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { ThreadActions, SidebarControls } from '@/components/CommunityClient';

/**
 * Forum parity: shoppers and owners have an identical toolset — create,
 * comment, vote, like, share a Store Card, report. The ONLY difference is the
 * Verified Maker badge. Gating participation would starve the retention
 * mechanism the whole daily-destination thesis depends on.
 */
export default async function CommunityPage() {
  const user = await currentUser();

  const [boards, prefs] = await Promise.all([
    db.forumBoard.findMany({ where: { isArchived: false }, orderBy: { sortOrder: 'asc' } }),
    user
      ? db.userBoardPref.findMany({ where: { userId: user.id } })
      : Promise.resolve([]),
  ]);

  const prefFor = (id: string) => prefs.find((p) => p.boardId === id);
  const hiddenIds = prefs.filter((p) => p.isHidden).map((p) => p.boardId);
  const ordered = [...boards].sort(
    (a, b) => Number(!!prefFor(b.id)?.isPinned) - Number(!!prefFor(a.id)?.isPinned),
  );

  const threads = await db.forumThread.findMany({
    where: { isDeleted: false, boardId: { notIn: hiddenIds } },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    take: 40,
    select: {
      id: true, title: true, body: true, score: true, likeCount: true,
      isPinned: true, isLocked: true, createdAt: true,
      board: { select: { name: true } },
      author: {
        select: { id: true, name: true, role: true, store: { select: { name: true, isVerifiedMaker: true } } },
      },
      posts: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, body: true, likeCount: true, createdAt: true,
          author: { select: { name: true, role: true, store: { select: { name: true, isVerifiedMaker: true } } } },
        },
      },
    },
  });

  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-[1280px] gap-11 px-6 pb-20 pt-8 md:grid-cols-[200px_1fr] md:px-10">
        <aside>
          <SidebarControls
            signedIn={!!user}
            boards={ordered.map((b) => ({
              id: b.id,
              name: b.name,
              threads: threads.filter((t) => t.board.name === b.name).length,
              pinned: !!prefFor(b.id)?.isPinned,
              hidden: !!prefFor(b.id)?.isHidden,
            }))}
          />
        </aside>

        <div>
          {threads.map((t) => {
            const display = t.author.store?.name ?? t.author.name ?? 'Member';
            return (
              <article key={t.id} className="border-b border-line py-6">
                {t.isPinned && (
                  <div className="mb-2 font-mono text-[10px] tracking-[0.1em] text-accent">📌 PINNED BY MODERATOR</div>
                )}
                <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.07em] text-ink-4">
                  {t.board.name} · {t.createdAt.toISOString().slice(0, 10)}
                  {t.isLocked && <span className="text-amber-600"> · 🔒 LOCKED</span>}
                </div>
                <h3 className="mb-2 text-lg font-semibold leading-tight tracking-[-0.02em]">{t.title}</h3>
                <div className="mb-2.5 flex items-center gap-2 text-[13px]">
                  <b className="font-semibold">{display}</b>
                  {t.author.store?.isVerifiedMaker && <VerifiedBadge />}
                  <span className="font-mono text-[11px] text-ink-3">
                    {t.score > 0 ? '+' : ''}{t.score} rank
                  </span>
                </div>
                <p className="mb-3 max-w-[74ch] text-sm text-ink-2">{t.body}</p>

                <ThreadActions
                  threadId={t.id}
                  likeCount={t.likeCount}
                  replyCount={t.posts.length}
                  locked={t.isLocked}
                  signedIn={!!user}
                />

                {t.posts.map((p) => (
                  <div key={p.id} className="mb-2 border-l-2 border-line py-3 pl-4.5 pl-5">
                    <div className="mb-1.5 flex items-center gap-2 text-[13px]">
                      <b className="font-semibold">{p.author.store?.name ?? p.author.name}</b>
                      {p.author.store?.isVerifiedMaker && <VerifiedBadge />}
                      <span className="font-mono text-[10.5px] text-ink-4">
                        {p.createdAt.toISOString().slice(0, 10)}
                      </span>
                    </div>
                    <p className="max-w-[70ch] text-[13.5px] text-ink-2">{p.body}</p>
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}

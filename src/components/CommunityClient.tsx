'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleLike, vote, createComment, setBoardPref, fileReport } from '@/actions/community';

const btn = 'rounded-sm border border-line px-2.5 py-1 text-[12.5px] hover:border-ink disabled:opacity-50';

export function ThreadActions({
  threadId, likeCount, replyCount, locked, signedIn,
}: { threadId: string; likeCount: number; replyCount: number; locked: boolean; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(likeCount);
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  const gate = () => { if (!signedIn) { router.push('/register'); return true; } return false; };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button className={btn} disabled={pending} onClick={() => !gate() && start(() => vote('THREAD', threadId, 1).then(() => router.refresh()))}>▲</button>
        <button className={btn} disabled={pending} onClick={() => !gate() && start(() => vote('THREAD', threadId, -1).then(() => router.refresh()))}>▼</button>

        {/* Likes are visually and structurally distinct from votes: they never move rank. */}
        <button
          className={`${btn} ${liked ? 'border-ink bg-ink text-white' : ''}`}
          disabled={pending}
          onClick={() => {
            if (gate()) return;
            setLiked((v) => !v);
            setCount((c) => c + (liked ? -1 : 1));
            start(() => toggleLike('THREAD', threadId).then(() => {}));
          }}
        >
          {liked ? '♥' : '♡'} {count}
        </button>

        <button
          className={btn}
          onClick={() => {
            if (gate()) return;
            if (locked) return alert('Thread locked by a moderator — no new comments.');
            setOpen((v) => !v);
          }}
        >
          💬 Comment {replyCount || ''}
        </button>

        <button
          className={`${btn} ml-auto text-ink-3`}
          onClick={() => {
            if (gate()) return;
            const reason = prompt('Reason for report?');
            if (reason) start(() => fileReport({ targetType: 'THREAD', targetId: threadId, reason }).then(() => alert('Ticket filed — it is now in the admin moderation queue.')));
          }}
        >
          ⚑ Report
        </button>
      </div>

      {open && (
        <div className="mb-3.5 border-l-2 border-accent py-3 pl-5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a reply…"
            className="min-h-[74px] w-full resize-y border border-line p-2.5 focus:border-ink focus:outline-none"
          />
          <div className="mt-2 flex gap-1.5">
            <button
              className="rounded-sm bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50"
              disabled={pending || !body.trim()}
              onClick={() => start(async () => {
                await createComment(threadId, body);
                setBody(''); setOpen(false); router.refresh();
              })}
            >
              Post comment
            </button>
            <button className={btn} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

export function SidebarControls({
  boards, signedIn,
}: { boards: { id: string; name: string; threads: number; pinned: boolean; hidden: boolean }[]; signedIn: boolean }) {
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();

  return (
    <>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="eyebrow">Boards</div>
        <button
          className="font-mono text-[9.5px] tracking-wider text-ink-4 underline"
          onClick={() => (signedIn ? setEditing((v) => !v) : router.push('/register'))}
        >
          {editing ? 'DONE' : 'CUSTOMIZE'}
        </button>
      </div>

      {boards.map((b) => (
        <div key={b.id} className={`flex items-center gap-2 border-b border-line-2 py-2 text-[13.5px] ${b.hidden ? 'opacity-40' : ''}`}>
          {b.pinned && <span className="text-[10px]">📌</span>}
          <span className={`flex-1 ${b.hidden ? 'line-through' : ''}`}>{b.name}</span>
          {editing ? (
            <>
              <button
                className="font-mono text-[9px] text-ink-3 underline"
                onClick={() => start(() => setBoardPref(b.id, { isPinned: !b.pinned }).then(() => router.refresh()))}
              >
                {b.pinned ? 'UNPIN' : 'PIN'}
              </button>
              <button
                className="font-mono text-[9px] text-ink-3 underline"
                onClick={() => start(() => setBoardPref(b.id, { isHidden: !b.hidden }).then(() => router.refresh()))}
              >
                {b.hidden ? 'SHOW' : 'HIDE'}
              </button>
            </>
          ) : (
            <span className="font-mono text-[11px] text-ink-4">{b.threads}</span>
          )}
        </div>
      ))}

      <p className="mt-3.5 font-mono text-[10.5px] leading-relaxed text-ink-4">
        {signedIn
          ? 'Preferences are per-user (user_board_prefs) — never cached with the global board list.'
          : 'Read-only as guest. Sidebar preferences need a session to persist.'}
      </p>
    </>
  );
}

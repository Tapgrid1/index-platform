'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { overrideStoreUrl, setSuspension, setVerification, moderate,
         createBoard, renameBoard, setBoardArchived, moveThread, setThreadFlags } from '@/actions/admin';

const abtn = 'rounded-sm border border-[#2f3641] px-2.5 py-1 text-[10px] tracking-wider text-[#c9d1d9] hover:border-accent hover:text-white disabled:opacity-40';

/** Override is the highest-risk action in the product: reason mandatory,
 *  domain changes need a second confirmation, merchant is always notified. */
export function OverrideForm({ storeId, currentUrl, name }: { storeId: string; currentUrl: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(currentUrl);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = (confirmedDomainChange = false) =>
    start(async () => {
      try {
        await overrideStoreUrl({ storeId, newUrl: url, reason, confirmedDomainChange });
        setOpen(false); setErr(''); router.refresh();
      } catch (e) {
        const m = e instanceof Error ? e.message : 'Failed';
        if (m.includes('DOMAIN_CHANGE_REQUIRES_CONFIRMATION')) {
          if (confirm(`This repoints ${name} to a different domain. That is indistinguishable from an attack. Continue?`)) {
            submit(true);
            return;
          }
          setErr('Cancelled.');
        } else setErr(m);
      }
    });

  if (!open) return <button className={abtn} onClick={() => setOpen(true)}>OVERRIDE</button>;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg border border-admin-line bg-admin-panel p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[9.5px] tracking-[0.11em] text-red-400">HIGH-RISK ACTION</div>
        <h3 className="mb-4 font-sans text-lg text-white">Override — {name}</h3>
        <div className="mb-4 border-l-2 border-amber-500 bg-[#33260a] p-3 text-[11.5px] leading-relaxed text-amber-200">
          <b className="mb-1 block">Reason is mandatory.</b>
          It is stored on the audit row, and the merchant is notified with a one-click revert.
        </div>
        <label className="mb-1 block text-[9.5px] tracking-[0.11em] text-[#5c6470]">NEW ENTER URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} className="mb-3 w-full border border-[#2f3641] bg-admin-bg px-2.5 py-2 text-[#e4e7ec]" />
        <label className="mb-1 block text-[9.5px] tracking-[0.11em] text-[#5c6470]">REASON (MIN 8 CHARS)</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mb-3 min-h-[70px] w-full border border-[#2f3641] bg-admin-bg px-2.5 py-2 text-[#e4e7ec]" />
        {err && <p className="mb-2 text-[11px] text-red-400">{err}</p>}
        <div className="flex gap-2">
          <button className={abtn} disabled={pending} onClick={() => submit(false)}>APPLY &amp; NOTIFY MERCHANT</button>
          <button className={abtn} onClick={() => setOpen(false)}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

export function SuspendButton({ userId, suspended }: { userId: string; suspended: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className={abtn}
      disabled={pending}
      onClick={() => {
        const reason = suspended ? undefined : prompt('Reason for suspension?') ?? undefined;
        start(() => setSuspension(userId, !suspended, reason).then(() => router.refresh()));
      }}
    >
      {suspended ? 'RESTORE' : 'SUSPEND'}
    </button>
  );
}

export function VerifyButtons({ storeId }: { storeId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex justify-end gap-1.5">
      <button className={abtn} disabled={pending} onClick={() => start(() => setVerification(storeId, true).then(() => router.refresh()))}>GRANT BADGE</button>
      <button className={abtn} disabled={pending} onClick={() => start(() => setVerification(storeId, false).then(() => router.refresh()))}>DENY</button>
    </div>
  );
}

export function ModerationButtons({ reportId }: { reportId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = (a: 'DELETE' | 'BAN' | 'DISMISS') =>
    start(() => moderate(reportId, a, a === 'DISMISS' ? 'No violation found' : 'Policy violation').then(() => router.refresh()));
  return (
    <div className="flex flex-col gap-1.5">
      <button className={abtn} disabled={pending} onClick={() => act('DELETE')}>DELETE CONTENT</button>
      <button className={abtn} disabled={pending} onClick={() => act('BAN')}>BAN AUTHOR</button>
      <button className={abtn} disabled={pending} onClick={() => act('DISMISS')}>DISMISS</button>
    </div>
  );
}

export function BoardControls({ boardId, archived }: { boardId: string; archived: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex justify-end gap-1.5">
      <button className={abtn} disabled={pending} onClick={() => {
        const n = prompt('New board name?');
        if (n) start(() => renameBoard(boardId, n).then(() => router.refresh()));
      }}>RENAME</button>
      <button className={abtn} disabled={pending} onClick={() => start(() => setBoardArchived(boardId, !archived).then(() => router.refresh()))}>
        {archived ? 'RESTORE' : 'ARCHIVE'}
      </button>
    </div>
  );
}

export function NewBoardButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button className={abtn} disabled={pending} onClick={() => {
      const n = prompt('Board name?');
      if (n) start(() => createBoard(n).then(() => router.refresh()));
    }}>+ NEW BOARD</button>
  );
}

export function ThreadControls({
  threadId, boards, boardId, pinned, locked,
}: { threadId: string; boards: { id: string; name: string }[]; boardId: string; pinned: boolean; locked: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex items-center justify-end gap-1.5">
      {/* Moving threads is only safe because the thread URL never encodes the
          board slug — otherwise every move breaks existing links. */}
      <select
        defaultValue={boardId}
        onChange={(e) => start(() => moveThread(threadId, e.target.value).then(() => router.refresh()))}
        className="border border-[#2f3641] bg-admin-bg px-1.5 py-1 font-mono text-[10.5px] text-[#c9d1d9]"
      >
        {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <button className={abtn} disabled={pending} onClick={() => start(() => setThreadFlags(threadId, { isPinned: !pinned }).then(() => router.refresh()))}>
        {pinned ? 'UNPIN' : 'PIN'}
      </button>
      <button className={abtn} disabled={pending} onClick={() => start(() => setThreadFlags(threadId, { isLocked: !locked }).then(() => router.refresh()))}>
        {locked ? 'UNLOCK' : 'LOCK'}
      </button>
    </div>
  );
}

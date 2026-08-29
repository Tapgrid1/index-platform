'use client';

import { useState, useTransition } from 'react';
import { deleteMyAccount } from '@/actions/account';

/**
 * Account deletion, with the confirmation the action insists on.
 *
 * deleteAccount() refuses an owner's account unless confirmStoreDeletion is
 * passed, and it is right to: a merchant deleting their login is also deleting
 * the store card shoppers have saved. That refusal is only useful if a human
 * is told what they are agreeing to, which is what this component is for.
 */
export function DeleteAccount({ ownsStore }: { ownsStore: boolean }) {
  const [armed, setArmed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();

  if (!armed) {
    return (
      <button
        onClick={() => setArmed(true)}
        className="h-10 rounded-sm border border-line px-5 text-[13.5px] text-red-700 transition hover:border-red-700"
      >
        Delete my account
      </button>
    );
  }

  return (
    <div className="border border-red-200 bg-red-50/50 p-5">
      <div className="mb-2 text-[14.5px] font-semibold">This cannot be undone.</div>
      <p className="mb-4 text-[13px] leading-relaxed text-ink-2">
        Your saved stores, view history and search history are deleted outright.
        Your forum posts stay, reassigned to a deleted-account placeholder, so the
        replies other people wrote underneath them still make sense.
      </p>

      {ownsStore && (
        <label className="mb-4 flex cursor-pointer items-start gap-2.5 border border-red-200 bg-white p-3.5 text-[13px]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-[3px]"
          />
          <span>
            I understand my <b>Store Card and its products are deleted too</b>, and
            will disappear from the directory.
          </span>
        </label>
      )}

      <div className="flex flex-wrap gap-2.5">
        <button
          disabled={pending || (ownsStore && !confirmed)}
          onClick={() =>
            start(async () => {
              try {
                await deleteMyAccount({ confirmStoreDeletion: ownsStore ? confirmed : undefined });
              } catch (err) {
                setMsg(err instanceof Error ? err.message : 'Could not delete the account');
              }
            })
          }
          className="h-10 rounded-sm bg-red-700 px-5 text-[13.5px] font-medium text-white disabled:opacity-40"
        >
          {pending ? 'Deleting…' : 'Delete permanently'}
        </button>
        <button
          onClick={() => setArmed(false)}
          className="h-10 rounded-sm border border-line px-5 text-[13.5px] hover:border-ink"
        >
          Keep my account
        </button>
      </div>

      {msg && <p className="mt-3 font-mono text-[11.5px] text-red-700">{msg}</p>}
    </div>
  );
}

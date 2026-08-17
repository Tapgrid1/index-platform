'use client';

import { useState, useTransition } from 'react';
import { deleteMyAccount } from '@/actions/account';

/**
 * Self-service export and deletion.
 *
 * These have to be reachable from a page, not just callable as actions:
 * docs/DECISIONS.md is explicit that social auth, search logs, browsing history
 * and coarse scan geo put this product in scope for real disclosure
 * obligations, and a right the user cannot exercise is not one they have.
 *
 * Deletion asks the user to type DELETE rather than showing a confirm dialog.
 * The action is irreversible and, for an owner, takes the storefront and its
 * placements with it — a misclick must not be able to reach it.
 */
export function AccountDataPanel({ ownsStore }: { ownsStore: boolean }) {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const armed = confirm.trim().toUpperCase() === 'DELETE';

  return (
    <section className="mb-16 border border-line">
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-[13px] font-bold">YOUR DATA</h2>
      </div>

      <div className="border-b border-line px-6 py-5">
        <div className="mb-1 text-[14.5px] font-semibold">Download everything we hold</div>
        <p className="mb-3.5 max-w-[60ch] text-[13px] text-ink-2">
          Your profile, saved stores, view history, search log, forum posts and — if you list a
          store — its card and products. One JSON file.
        </p>
        {/* A plain link, not an action: the browser has to receive a file, and
            only a real navigation to a Content-Disposition response does that. */}
        <a
          href="/api/account/export"
          className="inline-flex h-9 items-center rounded-sm border border-line px-3.5 text-[13px] hover:border-ink"
        >
          Download my data
        </a>
      </div>

      <div className="px-6 py-5">
        <div className="mb-1 text-[14.5px] font-semibold">Delete this account</div>
        <p className="mb-3.5 max-w-[60ch] text-[13px] text-ink-2">
          Permanent. Removes your saved stores, history, searches and account.
          {ownsStore && (
            <>
              {' '}
              <b className="text-ink">
                It also deletes your store, its products and any physical placements.
              </b>
            </>
          )}{' '}
          Posts you made stay readable so replies to them still make sense, but they are detached
          from you and their text is removed.
        </p>

        {error && (
          <div className="mb-3.5 border border-line bg-wash p-3 text-[12.5px] text-ink-2">{error}</div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type DELETE to confirm"
            aria-label="Type DELETE to confirm account deletion"
            className="h-9 w-[220px] rounded-sm border border-line px-3 text-[13px] focus:border-ink focus:outline-none"
          />
          <button
            disabled={!armed || pending}
            onClick={() => {
              setError(null);
              start(async () => {
                try {
                  await deleteMyAccount({ confirmStoreDeletion: ownsStore });
                } catch (err) {
                  // redirect() throws NEXT_REDIRECT on success; that is not a
                  // failure and must not be shown as one.
                  const message = err instanceof Error ? err.message : String(err);
                  if (message.includes('NEXT_REDIRECT')) return;
                  setError(message);
                }
              });
            }}
            className="h-9 rounded-sm bg-ink px-3.5 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            {pending ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </div>
    </section>
  );
}

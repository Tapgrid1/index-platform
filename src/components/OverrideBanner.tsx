'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { revertOverride, acknowledgeOverride } from '@/actions/merchant';

/**
 * A support edit the merchant is never told about is a chargeback waiting to
 * happen. This banner — with a working one-click revert — is what converts the
 * Override Switch from a liability into a support feature.
 */
export function OverrideBanner({ notice }: {
  notice: { id: string; field: string; beforeValue: string; afterValue: string; reason: string; createdAt: string };
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="mb-6 border-l-2 border-amber-500 bg-amber-50 p-4 text-[13px] leading-relaxed">
      <b className="mb-1 block text-[13.5px]">⚑ Edited by support — {notice.createdAt.slice(0, 16).replace('T', ' ')}</b>
      Your {notice.field} was changed. Reason given: “{notice.reason}”
      <div className="mt-1 font-mono text-[11px] text-ink-3">
        was: {notice.beforeValue} → now: {notice.afterValue}
      </div>
      <div className="mt-2.5 flex gap-2">
        <button
          disabled={pending}
          className="rounded-sm border border-line bg-white px-3 py-1.5 text-[12.5px] hover:border-ink"
          onClick={() => start(() => revertOverride(notice.id).then(() => router.refresh()))}
        >
          Revert to my version
        </button>
        <button
          disabled={pending}
          className="rounded-sm border border-line bg-white px-3 py-1.5 text-[12.5px] hover:border-ink"
          onClick={() => start(() => acknowledgeOverride(notice.id).then(() => router.refresh()))}
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}

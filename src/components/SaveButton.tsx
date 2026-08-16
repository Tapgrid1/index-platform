'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { toggleSave } from '@/actions/shopper';

export function SaveButton({ storeId, saved, signedIn }: { storeId: string; saved: boolean; signedIn: boolean }) {
  const [on, setOn] = useState(saved);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      aria-label={on ? 'Remove from My Archive' : 'Quick-Save'}
      disabled={pending}
      onClick={() => {
        if (!signedIn) return router.push('/register');
        setOn((v) => !v); // optimistic
        start(async () => {
          try {
            const r = await toggleSave(storeId);
            setOn(r.saved);
          } catch {
            setOn((v) => !v);
          }
        });
      }}
      className={`ml-auto grid h-[30px] w-[30px] shrink-0 place-items-center rounded-sm border transition ${
        on ? 'border-ink bg-ink' : 'border-line hover:border-ink'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={on ? '#fff' : 'none'} stroke={on ? '#fff' : '#3d3d3d'} strokeWidth="1.8">
        <path d="M12 20s-7-4.6-7-9.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 7 3.4C19 15.4 12 20 12 20z" />
      </svg>
    </button>
  );
}

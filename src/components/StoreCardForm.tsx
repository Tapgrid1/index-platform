'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createStore, updateStoreCard } from '@/actions/merchant';

/**
 * Shared by the edit page and by onboarding. The two differ only in which
 * action they call and where they go afterwards — the fields, the 150-character
 * counter and the URL hint are identical, and a second copy of them would drift
 * from this one the first time the story cap moved.
 */
export function StoreCardForm({
  initial, categories, mode = 'edit',
}: {
  initial: { name: string; monogram: string; story: string; homeUrl: string; categoryId: string | null };
  categories: { id: string; name: string }[];
  mode?: 'edit' | 'create';
}) {
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  const over = f.story.length > 140;

  return (
    <form
      className="max-w-[560px] space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            if (mode === 'create') {
              await createStore(f);
              router.push('/merchant');
            } else {
              await updateStoreCard(f);
              setMsg('Saved — the public card is updated.');
            }
            router.refresh();
          } catch (err) {
            setMsg(err instanceof Error ? err.message : 'Could not save');
          }
        });
      }}
    >
      <Field label="Store name">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} />
      </Field>

      <Field label="Logo monogram">
        <input value={f.monogram} maxLength={3} onChange={(e) => setF({ ...f, monogram: e.target.value.toUpperCase() })} className={`${input} w-24`} />
      </Field>

      <Field label="Origin story · 150 char max">
        <textarea
          value={f.story}
          maxLength={150}
          onChange={(e) => setF({ ...f, story: e.target.value })}
          className={`${input} min-h-[80px] resize-y`}
        />
        <div className={`mt-1 text-right font-mono text-[10.5px] ${over ? 'font-bold text-red-600' : 'text-ink-4'}`}>
          {f.story.length} / 150
        </div>
      </Field>

      <Field label="Primary category">
        <select value={f.categoryId ?? ''} onChange={(e) => setF({ ...f, categoryId: e.target.value || null })} className={input}>
          <option value="">Uncategorised</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>

      {/* The Enter destination. Changing this changes where every card click goes. */}
      <Field label="Store home URL — the Enter destination">
        <input value={f.homeUrl} onChange={(e) => setF({ ...f, homeUrl: e.target.value })} className={input} />
      </Field>

      <button disabled={pending} className="h-10 rounded-sm bg-ink px-5 text-[13.5px] font-medium text-white disabled:opacity-50">
        {pending
          ? 'Saving…'
          : mode === 'create'
            ? 'Publish my store'
            : 'Save changes'}
      </button>
      {msg && <p className="font-mono text-[11.5px] text-ink-3">{msg}</p>}
      {mode === 'create' && (
        <p className="font-mono text-[11px] leading-relaxed text-ink-4">
          Submitting publishes the card to the directory immediately. You can edit
          every field afterwards from the portal.
        </p>
      )}
    </form>
  );
}

const input = 'w-full rounded-sm border border-line px-3 py-2.5 focus:border-ink focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">{label}</span>
      {children}
    </label>
  );
}

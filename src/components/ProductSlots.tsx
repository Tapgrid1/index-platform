'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upsertProduct } from '@/actions/merchant';

type Slot = { sortOrder: number; title: string; destinationUrl: string; imageUrl: string; clickCount: number };

/** The no-price rule is enforceable on the image but not on free text, so the
 *  same regex the admin card audit uses warns the merchant here first. */
const PRICE_RX = /[$£€]|\busd\b|\bprice\b|\bonly\s*\d/i;

export function ProductSlots({ slots, homeUrl }: { slots: Slot[]; homeUrl: string }) {
  const [rows, setRows] = useState(slots);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const router = useRouter();

  const patch = (i: number, p: Partial<Slot>) =>
    setRows((r) => r.map((row, k) => (k === i ? { ...row, ...p } : row)));

  const onFile = (i: number, file: File) => {
    if (!file.type.startsWith('image/')) return setMsg('Images only.');
    const reader = new FileReader();
    reader.onload = (e) => patch(i, { imageUrl: String(e.target?.result ?? '') });
    reader.readAsDataURL(file);
  };

  const save = (i: number) =>
    start(async () => {
      const r = rows[i];
      try {
        await upsertProduct({
          sortOrder: r.sortOrder, title: r.title,
          destinationUrl: r.destinationUrl, imageUrl: r.imageUrl,
        });
        setMsg(`Slot 0${i + 1} saved.`);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Save failed');
      }
    });

  return (
    <>
      {rows.map((r, i) => (
        <div key={r.sortOrder} className="mb-2 flex items-start gap-3 border border-line p-3.5">
          <span className="w-4 pt-6 font-mono text-[10px] text-ink-4">0{i + 1}</span>

          <div className="shrink-0 text-center">
            <label className="block h-[78px] w-[78px] cursor-pointer overflow-hidden border border-line-2 bg-wash">
              {r.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={r.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full place-items-center font-mono text-[9px] text-ink-4">EMPTY</span>
              )}
              <input
                type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(i, e.target.files[0])}
              />
            </label>
            <span className="mt-1.5 block font-mono text-[9px] tracking-wider text-ink-3 underline">REPLACE</span>
          </div>

          <div className="flex-1">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-4">Title</div>
            <input value={r.title} onChange={(e) => patch(i, { title: e.target.value })} className={inp} placeholder="Product title" />

            <div className="mb-1 mt-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-4">
              Destination URL — where this image sends the shopper
            </div>
            <input value={r.destinationUrl} onChange={(e) => patch(i, { destinationUrl: e.target.value })} className={`${inp} font-mono text-[11px]`} placeholder="/product/…" />
            <div className="mt-1 font-mono text-[10px] text-ink-4">
              resolves to https://{homeUrl}{r.destinationUrl}
            </div>

            {PRICE_RX.test(r.title) && (
              <div className="mt-1.5 font-mono text-[10px] text-red-600">
                ⚑ CURRENCY DETECTED IN TITLE — will flag in the admin card audit
              </div>
            )}

            <button
              onClick={() => save(i)}
              disabled={pending || !r.title || !r.imageUrl}
              className="mt-2.5 rounded-sm border border-line px-3 py-1 text-[12.5px] hover:border-ink disabled:opacity-40"
            >
              Save slot
            </button>
          </div>

          <div className="w-14 shrink-0 pt-6 text-right font-mono text-[10.5px] text-ink-4">
            {r.clickCount}
            <div className="text-[9px]">CLICKS</div>
          </div>
        </div>
      ))}

      {msg && <p className="mt-3 font-mono text-[11.5px] text-ink-3">{msg}</p>}
      <p className="mt-3.5 font-mono text-[11px] leading-relaxed text-ink-4">
        Five slots are enforced by a database CHECK plus a unique index, not only by this form.<br />
        Uploads here are data URIs. Before production: presigned upload, server-side re-encode, EXIF strip,
        and a hard dimension floor so the grid never renders a blurry card.
      </p>
    </>
  );
}

const inp = 'w-full border-0 border-b border-line-2 py-1 focus:border-ink focus:outline-none';

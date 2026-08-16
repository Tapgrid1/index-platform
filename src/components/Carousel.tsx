'use client';

import { useState } from 'react';

type Item = { id: string; title: string; imageUrl: string };

/**
 * Single-frame product carousel. Images only, no prices — the card does
 * discovery, the merchant's own site does the closing.
 */
export function Carousel({ items }: { items: Item[] }) {
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  if (!items.length) return <div className="mb-3 aspect-square border border-line-2 bg-wash" />;

  const move = (d: number) => setI((p) => (p + d + items.length) % items.length);

  return (
    <>
      <div className="group relative mb-3 aspect-square overflow-hidden border border-line-2 bg-wash">
        <div
          className="flex h-full transition-transform duration-300"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {items.map((p) => (
            <a
              key={p.id}
              href={`/out/p/${p.id}`}
              className="relative h-full min-w-full"
              aria-label={p.title}
            >
              {failed[p.id] ? (
                <span className="absolute inset-0 grid place-items-center p-5 text-center font-mono text-[10.5px] uppercase tracking-wider text-ink-4">
                  {p.title}
                </span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.imageUrl}
                  alt={p.title}
                  className="h-full w-full object-cover"
                  onError={() => setFailed((f) => ({ ...f, [p.id]: true }))}
                />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                {p.title} →
              </span>
            </a>
          ))}
        </div>
        <button
          onClick={() => move(-1)}
          aria-label="Previous product"
          className="absolute left-0 top-1/2 grid h-11 w-7 -translate-y-1/2 place-items-center bg-white/90 opacity-0 transition group-hover:opacity-100"
        >
          ‹
        </button>
        <button
          onClick={() => move(1)}
          aria-label="Next product"
          className="absolute right-0 top-1/2 grid h-11 w-7 -translate-y-1/2 place-items-center bg-white/90 opacity-0 transition group-hover:opacity-100"
        >
          ›
        </button>
      </div>
      <div className="mb-3.5 flex justify-center gap-1">
        {items.map((p, k) => (
          <span
            key={p.id}
            className={`h-[5px] w-[5px] rounded-full ${k === i ? 'bg-ink' : 'bg-line'}`}
          />
        ))}
      </div>
    </>
  );
}

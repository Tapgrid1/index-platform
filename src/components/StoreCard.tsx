import { Carousel } from './Carousel';
import { SaveButton } from './SaveButton';
import { VerifiedBadge } from './VerifiedBadge';

export type StoreCardData = {
  id: string;
  name: string;
  monogram: string;
  logoUrl: string | null;
  story: string;
  isVerifiedMaker: boolean;
  category: { name: string } | null;
  products: { id: string; title: string; imageUrl: string }[];
};

export function StoreCard({
  store,
  saved,
  signedIn,
}: {
  store: StoreCardData;
  saved: boolean;
  signedIn: boolean;
}) {
  return (
    // data-impression-id is what ImpressionTracker observes; without it the
    // card is invisible to the impression count.
    <div className="flex flex-col bg-white p-5" data-impression-id={store.id}>
      <div className="mb-3 flex items-start gap-3">
        <div className="grid h-[38px] w-[38px] shrink-0 place-items-center overflow-hidden border border-line bg-wash text-[13px] font-extrabold tracking-tight">
          {store.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={store.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            store.monogram
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold tracking-[-0.015em]">
            {store.name}
            {store.isVerifiedMaker && <VerifiedBadge />}
          </div>
          <div className="mt-[3px] font-mono text-[10px] uppercase tracking-[0.1em] text-ink-4">
            {store.category?.name ?? 'Independent'}
          </div>
        </div>
        <SaveButton storeId={store.id} saved={saved} signedIn={signedIn} />
      </div>

      <p className="mb-4 min-h-[60px] text-[13.5px] leading-relaxed text-ink-2">{store.story}</p>

      <Carousel items={store.products} />

      {/* Enter routes through /out/s/:id so the click is logged before the 302. */}
      <a
        href={`/out/s/${store.id}`}
        className="mt-auto flex h-[42px] w-full items-center justify-center gap-2 bg-ink text-[13px] font-semibold text-white transition hover:bg-accent"
      >
        Enter
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </a>
    </div>
  );
}

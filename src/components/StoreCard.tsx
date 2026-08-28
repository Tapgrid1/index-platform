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
  // data-impression-id remains load-bearing — ImpressionTracker observes it via
  // a single root container.
  return (
    <div className="relative flex flex-col bg-white p-5" data-impression-id={store.id}>
      <div className="absolute right-4 top-4">
        <SaveButton storeId={store.id} saved={saved} signedIn={signedIn} />
      </div>

      <div className="flex w-full flex-col items-center pt-1">
        {store.logoUrl ? (
          <div
            className={[
              'grid shrink-0 place-items-center border border-line bg-wash overflow-hidden',
              'h-14 w-14 md:h-16 md:w-16',
            ].join(' ')}
          >
            {/* object-contain so logos with internal padding keep their
                proportions instead of being cropped to a square. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={store.logoUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div
            aria-label="No logo uploaded"
            className={[
              'grid shrink-0 place-items-center border border-dashed border-line bg-wash',
              'h-14 w-14 md:h-16 md:w-16',
            ].join(' ')}
          >
            <span className="text-[10px] uppercase tracking-[0.1em] text-ink-4">
              no logo
            </span>
          </div>
        )}

        <div className="mt-3 flex max-w-full flex-wrap items-center justify-center gap-1.5 text-[15px] font-semibold tracking-[-0.015em]">
          <span className="truncate">{store.name}</span>
          {store.isVerifiedMaker && <VerifiedBadge />}
        </div>

        <div className="mt-[3px] font-mono text-[10px] uppercase tracking-[0.1em] text-ink-4">
          {store.category?.name ?? 'Independent'}
        </div>
      </div>

      <p className="mb-4 mt-5 min-h-[60px] text-center text-[13.5px] leading-relaxed text-ink-2">
        {store.story}
      </p>

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

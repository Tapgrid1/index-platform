import { StoreCard } from '@/components/StoreCard';
import { db } from '@/lib/db';
import { requireOwnStore } from '@/lib/authz';

export default async function MerchantHome() {
  const { store } = await requireOwnStore();
  const full = await db.store.findUniqueOrThrow({
    where: { id: store.id },
    select: {
      id: true, name: true, monogram: true, logoUrl: true, story: true, isVerifiedMaker: true,
      verificationState: true, savedCount: true, enterClickCount: true, homeUrl: true,
      category: { select: { name: true } },
      products: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, imageUrl: true } },
    },
  });

  return (
    <>
      <div className="mb-7 flex items-end justify-between border-b border-ink pb-3.5">
        <div>
          <h2 className="text-2xl tracking-[-0.03em]">Live Preview</h2>
          <div className="mt-1 font-mono text-[10.5px] text-ink-3">EXACTLY WHAT SHOPPERS SEE ON THE MAIN FEED</div>
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[340px_1fr]">
        {/* Same component the public grid renders — if the portal renders a
            different card, the portal starts lying. */}
        <div className="border border-line">
          <StoreCard store={full} saved={false} signedIn />
        </div>

        <div>
          <div className="mb-6 grid grid-cols-2 gap-px border border-line bg-line">
            <div className="bg-ink p-4.5 p-5 text-white">
              <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-white/60">Saved by shoppers</div>
              <div className="text-3xl font-bold tracking-tight">{full.savedCount}</div>
              <div className="mt-1.5 text-[11.5px] text-white/60">First-party. Not visible in your own analytics.</div>
            </div>
            <div className="bg-white p-5">
              <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-3">Enter clicks</div>
              <div className="text-3xl font-bold tracking-tight">{full.enterClickCount}</div>
              <div className="mt-1.5 text-[11.5px] text-ink-3">Outbound to {full.homeUrl}</div>
            </div>
          </div>

          <div className="border border-line p-4.5 p-5 text-[13.5px] leading-loose">
            <div className="eyebrow mb-2.5">Status</div>
            Listing — <b>published</b> <span className="text-ink-3">(auto-published on submission)</span><br />
            Verified Maker — <b>{full.verificationState.toLowerCase()}</b>{' '}
            {!full.isVerifiedMaker && <span className="text-ink-3">(manual grant, not purchasable)</span>}
          </div>
        </div>
      </div>
    </>
  );
}

import { db } from '@/lib/db';
import { ownStoreOrOnboard, hasTier } from '@/lib/authz';

export default async function AnalyticsPage() {
  const { user, store } = await ownStoreOrOnboard();
  const tier = (await db.user.findUnique({ where: { id: user.id }, select: { subscriptionTier: true } }))?.subscriptionTier ?? 'NONE';
  const advanced = hasTier(tier, 'T2');

  const [full, products, terms] = await Promise.all([
    db.store.findUniqueOrThrow({
      where: { id: store.id },
      select: { savedCount: true, impressionCount: true, enterClickCount: true },
    }),
    db.product.findMany({ where: { storeId: store.id }, orderBy: { clickCount: 'desc' } }),
    advanced
      ? db.searchLog.findMany({ orderBy: { searchedAt: 'desc' }, take: 10, select: { id: true, query: true, resultCount: true } })
      : Promise.resolve([]),
  ]);

  const ctr = full.impressionCount ? ((full.enterClickCount / full.impressionCount) * 100).toFixed(1) : '0.0';

  return (
    <>
      <div className="mb-7 border-b border-ink pb-3.5">
        <h2 className="text-2xl tracking-[-0.03em]">Analytics</h2>
        <div className="mt-1 font-mono text-[10.5px] text-ink-3">{advanced ? 'ADVANCED · T2' : 'BASIC · T1'}</div>
      </div>

      {/* Saved-store count leads deliberately: impressions and outbound clicks
          always lose an argument against the merchant's own dashboard, but this
          number is first-party and they cannot contradict it. */}
      <div className="mb-7 grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
        <Metric hero label="Saved by shoppers" value={full.savedCount} note="Only we have this" />
        <Metric label="Impressions" value={full.impressionCount} note="Catalog views" />
        <Metric label="Enter clicks" value={full.enterClickCount} note={`CTR ${ctr}%`} />
        <Metric label="Product clicks" value={products.reduce((a, p) => a + p.clickCount, 0)} note="Highest intent" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 border-b border-ink pb-2 text-[13px] font-bold">PER-PRODUCT ENGAGEMENT</div>
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-line-2 py-2.5">
              <div className="flex-1 text-[13px]">{p.title}</div>
              <div className="h-1 w-28 bg-line-2">
                <div className="h-full bg-ink" style={{ width: `${Math.min(100, (p.clickCount / 420) * 100)}%` }} />
              </div>
              <div className="w-9 text-right font-mono text-[11px]">{p.clickCount}</div>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-3 border-b border-ink pb-2 text-[13px] font-bold">
            SEARCH TERMS {advanced ? '' : '· T2 LOCKED'}
          </div>
          {advanced ? (
            terms.length ? terms.map((t) => (
              <div key={t.id} className="flex justify-between border-b border-line-2 py-2.5 text-[13px]">
                <span>{t.query}</span>
                <span className="font-mono text-[11px] text-ink-3">{t.resultCount} results</span>
              </div>
            )) : <p className="py-4 font-mono text-[11.5px] text-ink-4">No queries logged yet.</p>
          ) : (
            <div className="border border-dashed border-line bg-wash p-10 text-center font-mono text-[11px] text-ink-3">
              SEARCH-TERM DATA IS A T2 FEATURE
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Metric({ label, value, note, hero }: { label: string; value: number; note: string; hero?: boolean }) {
  return (
    <div className={`p-4.5 p-5 ${hero ? 'bg-ink text-white' : 'bg-white'}`}>
      <div className={`mb-2 font-mono text-[9.5px] uppercase tracking-[0.1em] ${hero ? 'text-white/60' : 'text-ink-3'}`}>{label}</div>
      <div className="text-[29px] font-bold leading-none tracking-[-0.04em]">{value}</div>
      <div className={`mt-1.5 text-[11.5px] ${hero ? 'text-white/60' : 'text-ink-3'}`}>{note}</div>
    </div>
  );
}

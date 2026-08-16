import { db } from '@/lib/db';
import { requireOwnStore, hasTier } from '@/lib/authz';
import { RoutingControls } from '@/components/RoutingControls';

export default async function BridgePage() {
  const { user, store } = await requireOwnStore();
  const tier = (await db.user.findUnique({ where: { id: user.id }, select: { subscriptionTier: true } }))?.subscriptionTier ?? 'NONE';

  if (!hasTier(tier, 'T3')) {
    return (
      <>
        <div className="mb-7 border-b border-ink pb-3.5">
          <h2 className="text-2xl tracking-[-0.03em]">Physical Ad Bridge</h2>
          <div className="mt-1 font-mono text-[10.5px] text-ink-3">LOCKED · T3 NETWORK</div>
        </div>
        <div className="border border-dashed border-line bg-wash p-12 text-center">
          <div className="eyebrow mb-3.5">Coming soon</div>
          <div className="mb-2.5 text-lg font-semibold tracking-[-0.02em]">
            Put your storefront in the physical world
          </div>
          <p className="mx-auto mb-5 max-w-[48ch] text-[13.5px] text-ink-2">
            Interactive materials in partner locations, with scans you can re-route in real time from this dashboard.
          </p>
        </div>
      </>
    );
  }

  const placements = await db.adPlacement.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, code: true, venueName: true, medium: true, scanCount: true, currentTargetUrl: true },
  });

  return (
    <>
      <div className="mb-7 border-b border-ink pb-3.5">
        <h2 className="text-2xl tracking-[-0.03em]">Routing Command Center</h2>
        <div className="mt-1 font-mono text-[10.5px] text-ink-3">
          T3 · {placements.length} ACTIVE PLACEMENTS
        </div>
      </div>
      <RoutingControls placements={placements} />
    </>
  );
}

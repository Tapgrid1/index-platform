import { db } from '@/lib/db';

export default async function AdminHealth() {
  const [stores, users, openReports, saves, scans] = await Promise.all([
    db.store.count({ where: { status: 'PUBLISHED' } }),
    db.user.count(),
    db.report.count({ where: { status: 'OPEN' } }),
    db.savedStore.count(),
    db.scanEvent.count(),
  ]);

  const agg = await db.store.aggregate({ _sum: { impressionCount: true, enterClickCount: true } });
  const imp = agg._sum.impressionCount ?? 0;
  const ent = agg._sum.enterClickCount ?? 0;
  const ctr = imp ? ((ent / imp) * 100).toFixed(1) : '0.0';

  // Day-31 churn risks: nothing in the product acquires shoppers, so a merchant
  // with no outbound clicks has no reason to renew.
  const cold = await db.store.count({ where: { status: 'PUBLISHED', enterClickCount: 0 } });

  return (
    <>
      <h2 className="font-sans text-lg tracking-tight text-white">System Health</h2>
      <p className="mb-6 text-[11.5px] tracking-wide text-[#5c6470]">GLOBAL ANALYTICS · ALL MERCHANTS</p>

      <div className="mb-6 grid grid-cols-2 gap-px border border-admin-line bg-admin-line lg:grid-cols-5">
        <Kpi label="STORES PUBLISHED" value={stores} />
        <Kpi label="ACCOUNTS" value={users} />
        <Kpi label="GLOBAL ENTER CTR" value={`${ctr}%`} />
        <Kpi label="TOTAL SAVES" value={saves} />
        <Kpi label="OPEN TICKETS" value={openReports} danger={openReports > 0} />
      </div>

      <div className="border border-admin-line bg-admin-panel p-4">
        <div className="mb-3 text-[9.5px] tracking-[0.11em] text-[#5c6470]">COLD-START WATCH</div>
        <div className="leading-loose text-[#c9d1d9]">
          Merchants with zero enter-clicks: <b className="text-amber-400">{cold}</b> — these are the day-31 churn risks.<br />
          Physical scans recorded: <b className="text-white">{scans}</b>.<br />
          Shopper-side supply is the binding constraint. Every feature here improves the experience of a
          shopper who already arrived; none of them acquire one.
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="bg-admin-panel p-3.5">
      <div className="mb-2 text-[9px] tracking-[0.11em] text-[#5c6470]">{label}</div>
      <div className={`text-[22px] font-bold tracking-tight ${danger ? 'text-red-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}

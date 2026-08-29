import { db } from '@/lib/db';
import { OverrideForm, SuspendButton } from '@/components/AdminClient';

export default async function AdminMerchants() {
  const stores = await db.store.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, name: true, homeUrl: true, status: true, isVerifiedMaker: true,
      owner: { select: { id: true, email: true, status: true, subscriptionTier: true } },
    },
  });

  return (
    <>
      <h2 className="font-sans text-lg tracking-tight text-white">Merchant Management</h2>
      <p className="mb-6 text-[11.5px] tracking-wide text-[#5c6470]">
        {stores.length} ACCOUNTS · OVERRIDE AUTHORITY ACTIVE
      </p>

      <table className="w-full border-collapse border border-admin-line bg-admin-panel">
        <thead>
          <tr>{['STORE', 'TIER', 'ENTER URL', 'VERIFIED', 'STATUS', 'ACTIONS'].map((h) => (
            <th key={h} className="border-b border-admin-line px-3 py-2.5 text-left text-[9.5px] tracking-[0.11em] font-medium text-[#5c6470]">{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {stores.map((s) => (
            <tr key={s.id} className="hover:bg-[#191d24]">
              <td className="border-b border-[#1d2128] px-3 py-2.5">
                <b className="text-white">{s.name}</b>
                <div className="text-[10px] text-[#5c6470]">{s.owner.email}</div>
              </td>
              <td className="border-b border-[#1d2128] px-3 py-2.5">{s.owner.subscriptionTier}</td>
              <td className="border-b border-[#1d2128] px-3 py-2.5 text-sky-300">{s.homeUrl}</td>
              <td className="border-b border-[#1d2128] px-3 py-2.5">{s.isVerifiedMaker ? 'GRANTED' : 'PENDING'}</td>
              <td className="border-b border-[#1d2128] px-3 py-2.5">{s.owner.status}</td>
              <td className="border-b border-[#1d2128] px-3 py-2.5">
                <div className="flex justify-end gap-1.5">
                  <OverrideForm storeId={s.id} currentUrl={s.homeUrl} name={s.name} />
                  <SuspendButton userId={s.owner.id} suspended={s.owner.status === 'SUSPENDED'} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

import { db } from '@/lib/db';
import { VerifyButtons } from '@/components/AdminClient';

export default async function VerificationQueue() {
  const pending = await db.store.findMany({
    where: { verificationState: 'PENDING' },
    select: {
      id: true, name: true, homeUrl: true, createdAt: true,
      category: { select: { name: true } },
      _count: { select: { products: true } },
    },
  });

  return (
    <>
      <h2 className="font-sans text-lg tracking-tight text-white">Verification Queue</h2>
      <p className="mb-6 text-[11.5px] tracking-wide text-[#5c6470]">
        MANUAL GRANT · {pending.length} PENDING · NOT TIER-CORRELATED
      </p>

      {pending.length ? (
        <table className="w-full border-collapse border border-admin-line bg-admin-panel">
          <thead><tr>{['APPLICANT', 'STORE URL', 'PRODUCTS', 'DECISION'].map((h) => (
            <th key={h} className="border-b border-admin-line px-3 py-2.5 text-left text-[9.5px] font-medium tracking-[0.11em] text-[#5c6470]">{h}</th>
          ))}</tr></thead>
          <tbody>
            {pending.map((s) => (
              <tr key={s.id} className="hover:bg-[#191d24]">
                <td className="border-b border-[#1d2128] px-3 py-2.5">
                  <b className="text-white">{s.name}</b>
                  <div className="text-[10px] text-[#5c6470]">{s.category?.name}</div>
                </td>
                <td className="border-b border-[#1d2128] px-3 py-2.5 text-sky-300">{s.homeUrl}</td>
                <td className="border-b border-[#1d2128] px-3 py-2.5">{s._count.products}/5</td>
                <td className="border-b border-[#1d2128] px-3 py-2.5"><VerifyButtons storeId={s.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="border border-admin-line bg-admin-panel p-7 text-center text-[11.5px] text-[#5c6470]">
          Queue clear. Every decision was written to the audit log.
        </div>
      )}

      <p className="mt-4 text-[10.5px] leading-relaxed text-[#5c6470]">
        Publish the criteria before launch. A badge with undocumented criteria generates support arguments
        you cannot win — and note the linear operating cost: an hour a week at 20 signups, a hire at 500.
      </p>
    </>
  );
}

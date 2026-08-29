import { db } from '@/lib/db';

export default async function AuditLog() {
  const rows = await db.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, action: true, targetType: true, targetId: true, reason: true, createdAt: true,
      admin: { select: { email: true, name: true } },
    },
  });

  return (
    <>
      <h2 className="font-sans text-lg tracking-tight text-white">Audit Log</h2>
      <p className="mb-6 text-[11.5px] tracking-wide text-[#5c6470]">
        APPEND-ONLY · NO UPDATE OR DELETE PATH, FOR ANYONE
      </p>

      <div className="border border-admin-line bg-admin-panel p-4">
        {rows.length ? rows.map((r) => (
          <div key={r.id} className="flex gap-3 border-b border-[#1d2128] py-2 text-[11px]">
            <span className="shrink-0 text-[#5c6470]">{r.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</span>
            <span className="min-w-[150px] shrink-0 text-sky-300">{r.action}</span>
            <span className="text-admin-dim">
              {r.targetType}:{r.targetId.slice(0, 10)} — {r.admin.email ?? r.admin.name}
              {r.reason && ` · ${r.reason}`}
            </span>
          </div>
        )) : (
          <div className="p-5 text-center text-[#5c6470]">No admin actions recorded yet.</div>
        )}
      </div>

      <p className="mt-4 text-[10.5px] leading-relaxed text-[#5c6470]">
        Enforce append-only at the database too — see prisma/sql/constraints.sql. If an admin can rewrite
        the record of admin actions, the record is worthless in exactly the situation you would need it.
      </p>
    </>
  );
}

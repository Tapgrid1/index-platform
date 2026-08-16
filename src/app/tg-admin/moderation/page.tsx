import { db } from '@/lib/db';
import { ModerationButtons } from '@/components/AdminClient';

/** Reports group by target: ten reports on one comment surface as one item
 *  with a count, not ten rows. */
export default async function Moderation() {
  const open = await db.report.findMany({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, targetType: true, targetId: true, reason: true, notes: true, createdAt: true,
      reporter: { select: { name: true, email: true } },
    },
  });

  const grouped = new Map<string, typeof open>();
  for (const r of open) {
    const key = `${r.targetType}:${r.targetId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), r]);
  }

  return (
    <>
      <h2 className="font-sans text-lg tracking-tight text-white">Content Moderation</h2>
      <p className="mb-6 text-[11.5px] tracking-wide text-[#5c6470]">
        {grouped.size} TARGETS · {open.length} TICKETS · GROUPED BY TARGET
      </p>

      {grouped.size ? (
        [...grouped.entries()].map(([key, rows]) => (
          <div key={key} className="mb-4 border border-admin-line bg-admin-panel p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="mb-2 text-[9.5px] tracking-[0.1em] text-red-400">
                  ⚑ {rows[0].reason.toUpperCase()} {rows.length > 1 && `· ${rows.length} REPORTS`}
                </div>
                <div className="mb-1.5 font-sans text-[13px] text-white">{key}</div>
                <div className="text-[10.5px] text-[#5c6470]">
                  reported by {rows[0].reporter.name ?? rows[0].reporter.email} · {rows[0].createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  {rows[0].notes && ` · note: “${rows[0].notes}”`}
                </div>
              </div>
              <ModerationButtons reportId={rows[0].id} />
            </div>
          </div>
        ))
      ) : (
        <div className="border border-admin-line bg-admin-panel p-7 text-center text-[11.5px] text-[#5c6470]">
          No open tickets.
        </div>
      )}

      <p className="mt-4 text-[10.5px] leading-relaxed text-[#5c6470]">
        Admin deletion preserves the original text on the audit row for any later dispute.
        Self-deletion tombstones instead — different operations, different handlers.
      </p>
    </>
  );
}

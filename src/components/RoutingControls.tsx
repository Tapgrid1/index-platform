'use client';

import { useTransition, useState } from 'react';
import { setPlacementRoute } from '@/actions/merchant';

/** The resolver plus placement_routes is the defensible asset; the directory
 *  itself is commodity. Every change here writes a history row. */
export function RoutingControls({
  placements,
}: {
  placements: { id: string; code: string; venueName: string | null; medium: string; scanCount: number; currentTargetUrl: string }[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');

  return (
    <>
      {placements.map((p) => (
        <div key={p.id} className="mb-2 flex items-center gap-3 border border-line p-4">
          <div className="w-28 shrink-0">
            <div className="font-mono text-xs font-bold">{p.code}</div>
            <div className="mt-1 font-mono text-[9.5px] uppercase tracking-wider text-ink-4">{p.medium}</div>
          </div>
          <div className="flex-1">
            <div className="mb-1.5 text-[13px]">{p.venueName ?? 'Unassigned placement'}</div>
            <input
              defaultValue={p.currentTargetUrl}
              onBlur={(e) => {
                if (e.target.value === p.currentTargetUrl) return;
                start(async () => {
                  await setPlacementRoute(p.id, e.target.value);
                  setMsg(`${p.code} re-routed — /r/${p.code} now resolves to the new target. Scan history preserved.`);
                });
              }}
              className="w-full border border-line px-2 py-1.5 font-mono text-[11.5px] focus:border-ink focus:outline-none"
            />
          </div>
          <div className="w-14 shrink-0 text-right font-mono text-[10.5px] text-ink-4">
            {p.scanCount}
            <div className="text-[9px]">SCANS</div>
          </div>
        </div>
      ))}
      {!placements.length && <p className="font-mono text-[11.5px] text-ink-4">No placements provisioned yet.</p>}
      {pending && <p className="font-mono text-[11.5px] text-ink-3">Saving…</p>}
      {msg && <p className="mt-2 font-mono text-[11.5px] text-ink-3">{msg}</p>}
    </>
  );
}

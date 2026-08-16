/** Trust signal, never purchasable — see docs/ARCHITECTURE.md §3. */
export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-ink px-1.5 py-[2px] font-mono text-[8.5px] font-bold uppercase tracking-[0.08em] text-white">
      ✓ Verified Maker
    </span>
  );
}

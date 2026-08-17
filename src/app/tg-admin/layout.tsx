import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin, Forbidden } from '@/lib/authz';
import { db } from '@/lib/db';

const TABS = [
  ['/tg-admin', 'SYSTEM HEALTH'],
  ['/tg-admin/merchants', 'MERCHANTS'],
  ['/tg-admin/verification', 'VERIFICATION'],
  ['/tg-admin/community', 'COMMUNITY'],
  ['/tg-admin/moderation', 'MODERATION'],
  ['/tg-admin/audit-log', 'AUDIT LOG'],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  /**
   * 404, not 403 — the same answer middleware gives, and for the same reason:
   * a prober must not be able to tell "this path exists but you may not have
   * it" from "this path does not exist".
   *
   * This is not redundant with the middleware check. Middleware reads role
   * from the session cookie's claims and cannot re-derive them (it runs on the
   * Edge runtime, with no database), so a token minted before an ADMIN_EMAILS
   * change still claims ADMIN until it rotates. This guard is the authoritative
   * one, and without the catch it surfaced that window as a 500 — which is
   * itself a disclosure.
   */
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof Forbidden) notFound();
    throw err;
  }

  const open = await db.report.count({ where: { status: 'OPEN' } });

  return (
    <div className="grid min-h-screen bg-admin-bg font-mono text-[12.5px] text-[#e4e7ec] md:grid-cols-[200px_1fr]">
      <nav className="border-r border-admin-line py-7">
        <div className="px-4.5 px-5 pb-6">
          <div className="text-xs font-bold tracking-[0.1em] text-white">CONSOLE</div>
          <div className="mt-1.5 text-[9.5px] tracking-[0.1em] text-[#5c6470]">/tg-admin · INTERNAL</div>
        </div>
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} className="block border-l-2 border-transparent px-5 py-2 text-[11.5px] tracking-wider text-admin-dim hover:bg-[#1a1e24] hover:text-white">
            {label}
            {href === '/tg-admin/moderation' && open > 0 && <span className="float-right font-bold text-red-400">{open}</span>}
          </Link>
        ))}
        <div className="mt-4 border-t border-admin-line px-5 pt-5">
          <Link href="/" className="text-[10px] tracking-wider text-admin-dim hover:text-white">← PUBLIC SITE</Link>
        </div>
      </nav>
      <div className="px-7 pb-16 pt-6">{children}</div>
    </div>
  );
}

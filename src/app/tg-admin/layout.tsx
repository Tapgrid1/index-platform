import Link from 'next/link';
import { requireAdmin } from '@/lib/authz';
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
  await requireAdmin();
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

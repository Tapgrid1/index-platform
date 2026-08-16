import Link from 'next/link';
import { db } from '@/lib/db';
import { requireOwnStore } from '@/lib/authz';
import { OverrideBanner } from '@/components/OverrideBanner';

const TABS = [
  ['/merchant', 'Live Preview'],
  ['/merchant/store', 'Edit Store Card'],
  ['/merchant/products', 'Products'],
  ['/merchant/analytics', 'Analytics'],
  ['/merchant/bridge', 'Physical Bridge'],
] as const;

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const { user, store } = await requireOwnStore();
  const tier = (await db.user.findUnique({ where: { id: user.id }, select: { subscriptionTier: true } }))?.subscriptionTier ?? 'NONE';

  const notices = await db.overrideNotice.findMany({
    where: { storeId: store.id, acknowledgedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="grid min-h-screen md:grid-cols-[210px_1fr]">
      <nav className="border-r border-line bg-wash py-8">
        <div className="px-6 pb-6">
          <div className="text-[15px] font-bold tracking-[-0.03em]">{store.name}</div>
          <div className="mt-1 font-mono text-[9.5px] tracking-[0.12em] text-ink-4">
            MERCHANT PORTAL · {tier}
          </div>
        </div>
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} className="block border-l-2 border-transparent px-6 py-2 text-[13.5px] text-ink-2 hover:bg-white hover:text-ink">
            {label}
            {href === '/merchant/bridge' && tier !== 'T3' && ' 🔒'}
          </Link>
        ))}
        <div className="mt-4 border-t border-line px-6 pt-5">
          <Link href="/" className="text-[12.5px] underline underline-offset-4">View public feed</Link>
        </div>
      </nav>

      <div className="max-w-[1080px] px-10 pb-20 pt-8">
        {notices.map((n) => (
          <OverrideBanner key={n.id} notice={{ ...n, createdAt: n.createdAt.toISOString() }} />
        ))}
        {children}
      </div>
    </div>
  );
}

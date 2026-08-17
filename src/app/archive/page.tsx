import Link from 'next/link';
import { Header } from '@/components/Header';
import { StoreCard } from '@/components/StoreCard';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/authz';
import { AccountDataPanel } from '@/components/AccountDataPanel';

/** Everything here is first-party data the merchant cannot see in their own
 *  dashboard — which is exactly why it is worth holding. */
export default async function ArchivePage() {
  const user = await requireUser();

  const cardSelect = {
    id: true, name: true, monogram: true, logoUrl: true, story: true, isVerifiedMaker: true,
    category: { select: { name: true } },
    products: { orderBy: { sortOrder: 'asc' as const }, select: { id: true, title: true, imageUrl: true } },
  };

  const [saved, history, searches, ownedStore] = await Promise.all([
    db.savedStore.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { store: { select: cardSelect } },
    }),
    db.viewHistory.findMany({
      where: { userId: user.id },
      orderBy: { viewedAt: 'desc' },
      take: 10,
      select: { id: true, store: { select: { id: true, name: true, monogram: true, category: { select: { name: true } } } } },
    }),
    db.searchLog.findMany({
      where: { userId: user.id },
      orderBy: { searchedAt: 'desc' },
      take: 12,
      select: { id: true, query: true, resultCount: true, searchedAt: true },
    }),
    // Deletion warns differently for an owner: it takes the storefront too.
    db.store.findUnique({ where: { ownerId: user.id }, select: { id: true } }),
  ]);

  const ownsStore = !!ownedStore;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1280px] px-6 pb-20 pt-9 md:px-10">
        <div className="eyebrow">My Archive</div>
        <h1 className="mb-2 mt-1.5 text-[38px] font-bold tracking-[-0.04em]">Your curation vault</h1>
        <p className="mb-8 max-w-[56ch] text-ink-2">
          Saved stores, recent views and your search log — the platform’s first-party record of what you care about.
        </p>

        <div className="mb-7 flex items-baseline justify-between border-b border-ink pb-2.5">
          <h2 className="text-[13px] font-bold">SAVED STORES</h2>
          <span className="font-mono text-[11.5px] text-ink-3">{saved.length} saved</span>
        </div>
        <div className="mb-14 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {saved.length ? (
            saved.map((r) => <StoreCard key={r.store.id} store={r.store} saved signedIn />)
          ) : (
            <div className="bg-white p-16 text-center text-ink-3">
              <b className="mb-1.5 block text-base text-ink">Nothing saved yet.</b>
              Click the heart on any store card.
            </div>
          )}
        </div>

        <div className="grid gap-11 md:grid-cols-2">
          <section>
            <div className="mb-4 border-b border-ink pb-2.5 text-[13px] font-bold">RECENTLY VIEWED</div>
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 border-b border-line-2 py-3">
                <div className="grid h-8 w-8 place-items-center border border-line bg-wash text-[11px] font-extrabold">
                  {h.store.monogram}
                </div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-medium">{h.store.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-ink-4">
                    {h.store.category?.name}
                  </div>
                </div>
                <a href={`/out/s/${h.store.id}`} className="rounded-sm border border-line px-2.5 py-1 text-[12.5px] hover:border-ink">
                  Re-enter
                </a>
              </div>
            ))}
            {!history.length && <p className="py-5 font-mono text-xs text-ink-4">Empty — trimmed to the last 10 on write.</p>}
          </section>

          <section>
            <div className="mb-4 border-b border-ink pb-2.5 text-[13px] font-bold">SEARCH LOG</div>
            {searches.map((s) => (
              <div key={s.id} className="border-b border-line-2 py-3">
                <Link href={`/search?q=${encodeURIComponent(s.query)}`} className="text-[13.5px] font-medium underline underline-offset-4">
                  {s.query}
                </Link>
                <div className="mt-1 font-mono text-[10.5px] text-ink-4">
                  {s.searchedAt.toISOString().slice(0, 16).replace('T', ' ')} · {s.resultCount} results
                </div>
              </div>
            ))}
            {!searches.length && <p className="py-5 font-mono text-xs text-ink-4">No queries logged yet.</p>}
          </section>
        </div>

        {/* The archive is where a shopper sees what we hold about them, which
            makes it the only honest place to offer export and deletion. */}
        <AccountDataPanel ownsStore={ownsStore} />
      </main>
    </>
  );
}

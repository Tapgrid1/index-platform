import { Header } from '@/components/Header';
import { StoreCard } from '@/components/StoreCard';
import { currentUser } from '@/lib/authz';
import { publishedStores, savedIdsFor } from '@/lib/queries';
import { logSearch } from '@/actions/shopper';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const user = await currentUser();

  const stores = q
    ? await publishedStores({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { story: { contains: q, mode: 'insensitive' } },
          { category: { name: { contains: q, mode: 'insensitive' } } },
          { products: { some: { title: { contains: q, mode: 'insensitive' } } } },
        ],
      })
    : [];

  if (q) await logSearch(q, stores.length);
  const saved = await savedIdsFor(user?.id);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mb-7 mt-9 flex items-baseline justify-between border-b border-ink pb-2.5">
          <h2 className="text-[13px] font-bold">RESULTS FOR “{q}”</h2>
          <span className="font-mono text-[11.5px] text-ink-3">{stores.length} stores</span>
        </div>
        <div className="mb-16 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <StoreCard key={s.id} store={s} saved={saved.has(s.id)} signedIn={!!user} />
          ))}
          {!stores.length && (
            <div className="bg-white p-16 text-center text-ink-3">Nothing matches that yet.</div>
          )}
        </div>
      </main>
    </>
  );
}

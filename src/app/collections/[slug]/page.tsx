import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { StoreCard } from '@/components/StoreCard';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/authz';
import { savedIdsFor } from '@/lib/queries';

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();

  const collection = await db.collection.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      stores: {
        orderBy: { sortOrder: 'asc' },
        select: {
          store: {
            select: {
              id: true, name: true, monogram: true, logoUrl: true, story: true,
              isVerifiedMaker: true, status: true,
              category: { select: { name: true } },
              products: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, imageUrl: true } },
            },
          },
        },
      },
    },
  });
  if (!collection) notFound();

  const stores = collection.stores.map((r) => r.store).filter((s) => s.status === 'PUBLISHED');
  const saved = await savedIdsFor(user?.id);

  return (
    <>
      <Header activePill={collection.slug} />
      <main className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="mb-7 mt-9 flex items-baseline justify-between border-b border-ink pb-2.5">
          <h2 className="text-[13px] font-bold">{collection.name.toUpperCase()}</h2>
          <span className="font-mono text-[11.5px] text-ink-3">{stores.length} stores</span>
        </div>
        <div className="mb-16 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <StoreCard key={s.id} store={s} saved={saved.has(s.id)} signedIn={!!user} />
          ))}
        </div>
      </main>
    </>
  );
}

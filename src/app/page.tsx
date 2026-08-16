import { Header } from '@/components/Header';
import { StoreCard } from '@/components/StoreCard';
import { currentUser } from '@/lib/authz';
import { publishedStores, savedIdsFor, spotlightStore } from '@/lib/queries';

/**
 * The directory IS the front door. There is deliberately no gateway or role
 * chooser in front of it: asking a visitor to classify themselves before they
 * have seen a single store is the highest-friction possible first screen for a
 * product whose central problem is getting shoppers to arrive.
 */
export default async function DirectoryPage() {
  const user = await currentUser();
  const [stores, saved, spotlight] = await Promise.all([
    publishedStores(),
    savedIdsFor(user?.id),
    spotlightStore(),
  ]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1280px] px-6 md:px-10">
        {spotlight && (
          <section className="my-9 grid min-h-[340px] grid-cols-1 border border-line md:grid-cols-2">
            <div className="flex flex-col justify-center p-10 md:p-12">
              <div className="eyebrow mb-5">
                Store of the week · <b className="text-accent">This week</b>
              </div>
              <h1 className="mb-4 text-[44px] font-bold leading-[1.02] tracking-[-0.04em]">
                {spotlight.name}
              </h1>
              <p className="mb-7 max-w-[44ch] text-ink-2">{spotlight.story}</p>
              <div>
                <a href={`/out/s/${spotlight.id}`} className="inline-flex h-9 items-center rounded-sm bg-ink px-4 text-[13.5px] font-medium text-white">
                  Enter store →
                </a>
              </div>
            </div>
            <div className="relative min-h-[240px] border-line bg-wash md:border-l">
              {spotlight.products[0] && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={spotlight.products[0].imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
            </div>
          </section>
        )}

        <div className="mb-7 flex items-baseline justify-between border-b border-ink pb-2.5">
          <h2 className="text-[13px] font-bold">ALL STORES</h2>
          <span className="font-mono text-[11.5px] text-ink-3">
            {stores.length} stores · no live pricing by design
          </span>
        </div>

        <div className="mb-16 grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {stores.length ? (
            stores.map((s) => (
              <StoreCard key={s.id} store={s} saved={saved.has(s.id)} signedIn={!!user} />
            ))
          ) : (
            <div className="bg-white p-16 text-center text-ink-3">
              <b className="mb-1.5 block text-base text-ink">Nothing here yet.</b>
              Hand-seed 50–100 curated stores before launch — a sparse grid is the cold-start failure mode.
            </div>
          )}
        </div>
      </main>
    </>
  );
}

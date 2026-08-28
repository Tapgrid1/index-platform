import { ownStoreOrOnboard } from '@/lib/authz';
import { db } from '@/lib/db';
import { StoreCardForm } from '@/components/StoreCardForm';

export default async function EditStoreCardPage() {
  const { store } = await ownStoreOrOnboard();
  const [full, categories] = await Promise.all([
    db.store.findUniqueOrThrow({ where: { id: store.id } }),
    db.category.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  return (
    <>
      <div className="mb-7 border-b border-ink pb-3.5">
        <h2 className="text-2xl tracking-[-0.03em]">Edit Store Card</h2>
        <div className="mt-1 font-mono text-[10.5px] text-ink-3">CHANGES WRITE STRAIGHT TO THE PUBLIC CARD</div>
      </div>
      <StoreCardForm
        initial={{
          name: full.name, monogram: full.monogram, story: full.story,
          homeUrl: full.homeUrl, categoryId: full.categoryId,
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </>
  );
}

import { ownStoreOrOnboard } from '@/lib/authz';
import { db } from '@/lib/db';
import { ProductSlots } from '@/components/ProductSlots';

export default async function ProductsPage() {
  const { store } = await ownStoreOrOnboard();
  const products = await db.product.findMany({
    where: { storeId: store.id },
    orderBy: { sortOrder: 'asc' },
  });

  const slots = Array.from({ length: 5 }, (_, i) => {
    const p = products.find((x) => x.sortOrder === i);
    return {
      sortOrder: i,
      title: p?.title ?? '',
      destinationUrl: p?.destinationUrl ?? '',
      imageUrl: p?.imageUrl ?? '',
      clickCount: p?.clickCount ?? 0,
    };
  });

  return (
    <>
      <div className="mb-7 border-b border-ink pb-3.5">
        <h2 className="text-2xl tracking-[-0.03em]">Products</h2>
        <div className="mt-1 font-mono text-[10.5px] text-ink-3">
          FIVE SLOTS · IMAGE + TITLE + DESTINATION URL · NO PRICES
        </div>
      </div>
      <ProductSlots slots={slots} homeUrl={store.homeUrl} />
    </>
  );
}

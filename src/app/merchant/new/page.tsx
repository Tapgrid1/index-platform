import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/authz';
import { StoreCardForm } from '@/components/StoreCardForm';

/**
 * Onboarding — the first Store Card.
 *
 * Deliberately outside the (portal) route group. That layout resolves the
 * signed-in owner's store to render its navigation, so a page whose whole
 * purpose is "you do not have a store yet" cannot live underneath it.
 */
export default async function NewStorePage() {
  const user = await currentUser();
  if (!user) redirect('/merchant/login');

  const [existing, categories] = await Promise.all([
    db.store.findUnique({ where: { ownerId: user.id }, select: { id: true } }),
    db.category.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  // One store per account. Someone who already has one belongs in the portal.
  if (existing) redirect('/merchant');

  return (
    <main className="mx-auto max-w-[620px] px-6 py-16">
      <div className="eyebrow">Merchant portal</div>
      <h1 className="mb-3 mt-2 text-[36px] font-bold leading-[1.05] tracking-[-0.04em]">
        Create your Store Card.
      </h1>
      <p className="mb-9 text-ink-2">
        This is the whole listing. Shoppers see it in the directory and leave through
        the Enter button straight to your own storefront — we never sit between you
        and the sale.
      </p>

      <StoreCardForm
        mode="create"
        initial={{ name: '', monogram: '', story: '', homeUrl: '', categoryId: null }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />

      <p className="mt-8 border-t border-line pt-4 font-mono text-[11px] leading-relaxed text-ink-3">
        Products come next — five slots, image and title only, no prices. Add them
        from the portal once the card exists.
      </p>

      <Link href="/" className="mt-6 inline-block text-[12.5px] underline underline-offset-4">
        Back to the directory
      </Link>
    </main>
  );
}

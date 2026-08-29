import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/authz';
import { recordClick } from '@/lib/clicks';
import { safeExternalUrl } from '@/lib/url';
import { directoryUrl } from '../../fallback';

/**
 * Product deep-link logger. Every tile in every card's carousel links here.
 *
 * Same contract as the store route, with one extra step: the destination lives
 * on the product, so it has to be read before the redirect can be issued.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;

  const [product, user] = await Promise.all([
    db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        destinationUrl: true,
        store: { select: { id: true, homeUrl: true, status: true } },
      },
    }),
    currentUser().catch(() => null),
  ]);

  const store = product?.store;
  if (!product || !store || store.status === 'SUSPENDED') {
    return NextResponse.redirect(directoryUrl(), { status: 302 });
  }

  // A broken product link still has a merchant behind it, so fall through to
  // the store's own front door before giving up on the visit entirely. Only a
  // click that resolves to nothing at all lands back on the directory.
  const target =
    safeExternalUrl(product.destinationUrl) ?? safeExternalUrl(store.homeUrl);
  if (!target) {
    return NextResponse.redirect(directoryUrl(), { status: 302 });
  }

  recordClick({
    kind: 'PRODUCT',
    productId: product.id,
    storeId: store.id,
    userId: user?.id ?? null,
  });

  return NextResponse.redirect(target, { status: 302 });
}

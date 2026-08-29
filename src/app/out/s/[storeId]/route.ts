import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/authz';
import { recordClick } from '@/lib/clicks';
import { safeExternalUrl } from '@/lib/url';
import { directoryUrl } from '../../fallback';

/**
 * Enter-click logger. Every store card in the directory links here.
 *
 * README.md and docs/ARCHITECTURE.md §4 have described this route as live from
 * the beginning, and StoreCard.tsx, the spotlight on the front page and the
 * archive all link to it — so while it did not exist, the primary conversion
 * action of the product returned a 404 on every card. The dead counters were
 * the second-order symptom, not the problem.
 *
 * Shape follows the resolver at src/app/r/[code]/route.ts, which got the hard
 * part right: redirect first, log after, never block the visit on a write.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;

  // In parallel, not in series. Attribution is worth having, but it is not
  // worth adding a round trip to the path a leaving shopper is already on.
  const [store, user] = await Promise.all([
    db.store.findUnique({
      where: { id: storeId },
      select: { id: true, homeUrl: true, status: true },
    }),
    currentUser().catch(() => null),
  ]);

  // Unknown id, or a suspended listing — which is unpublished everywhere else
  // in the product, so sending traffic to it from a stale link or an old tab
  // would quietly undo that. Either way the answer is the directory, never a
  // 404: lower stakes than the resolver's printed codes, same reasoning.
  if (!store || store.status === 'SUSPENDED') {
    return NextResponse.redirect(directoryUrl(), { status: 302 });
  }

  // Checked again at click time, not only at write time. A row that predates
  // the allowlist must not reach a shopper's Location header.
  const target = safeExternalUrl(store.homeUrl);
  if (!target) {
    return NextResponse.redirect(directoryUrl(), { status: 302 });
  }

  recordClick({ kind: 'ENTER', storeId: store.id, userId: user?.id ?? null });

  return NextResponse.redirect(target, { status: 302 });
}

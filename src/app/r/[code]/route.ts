import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * THE RESOLVER — physical scan entry point.
 *
 * This endpoint plus placement_routes is the platform's defensible asset;
 * the directory itself is commodity (docs/DECISIONS.md D3). It is hit by
 * someone standing in a physical location holding a phone: a cold start or a
 * slow query is a lost scan and there is no retry. Keep it fast and
 * dependency-light, and never block the redirect on logging.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const fallback = process.env.RESOLVER_FALLBACK_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000';

  const placement = await db.adPlacement.findUnique({
    where: { code },
    select: { id: true, currentTargetUrl: true, activeFrom: true, activeTo: true },
  });

  const now = new Date();
  const expired =
    !!placement &&
    ((placement.activeFrom && placement.activeFrom > now) ||
      (placement.activeTo && placement.activeTo < now));

  // Unknown or expired codes get a branded fallback, never a 404. A dead end on
  // a printed asset is permanent — the material cannot be recalled.
  const target = !placement || expired ? `${fallback}/?scan=unrecognised` : placement.currentTargetUrl;

  const ua = req.headers.get('user-agent') ?? '';
  const deviceType = /iPhone|iPad|Android|Mobile/i.test(ua) ? 'mobile' : 'desktop';
  const coarseGeo =
    req.headers.get('x-vercel-ip-country') ??
    req.headers.get('cf-ipcountry') ??
    null;

  void Promise.all([
    db.scanEvent.create({
      data: {
        placementId: placement?.id ?? null,
        code,
        resolvedTargetUrl: target,
        deviceType,
        coarseGeo,
      },
    }),
    placement
      ? db.adPlacement.update({ where: { id: placement.id }, data: { scanCount: { increment: 1 } } })
      : Promise.resolve(null),
  ]).catch(() => {});

  return NextResponse.redirect(target, { status: 302 });
}

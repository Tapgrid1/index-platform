import { NextResponse } from 'next/server';
import { z } from 'zod';
import { bufferImpressions } from '@/lib/impressions';
import { hit, anonymousSubject } from '@/lib/rateLimit';

/**
 * Impression ingest. Fed by navigator.sendBeacon from ImpressionTracker.
 *
 * A view has no natural server-side choke point the way a click does — a click
 * already redirects through /out/s, whereas a card that merely appears on
 * screen passes through nothing. That is why this endpoint exists at all, and
 * why it is unauthenticated: gating it on a session would count only signed-in
 * shoppers, and the anonymous majority is exactly who the merchant is paying to
 * reach.
 *
 * Unauthenticated means the numbers are soft. The mitigations below (bot UA
 * filter, per-caller ceiling, batch cap) make casual inflation inconvenient;
 * they do not make the counter trustworthy against a determined party, which is
 * why nothing billable should ever be computed from it.
 */
export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(60),
});

// Deliberately coarse. Matching every crawler is not achievable; catching the
// ones that announce themselves removes most of the noise for one regex.
const BOT_UA = /bot|crawl|spider|slurp|headless|preview|monitor|curl|wget|python-requests|axios|fetch\//i;

export async function POST(req: Request) {
  const ua = req.headers.get('user-agent') ?? '';
  // 204 for bots too: telling a crawler it was filtered invites it to lie.
  if (!ua || BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });

  // sendBeacon sends text/plain by default; accept it rather than forcing the
  // client into a preflighted content type for a fire-and-forget beacon.
  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 204 });

  const subject = await anonymousSubject();
  if (!hit('search.log', `imp:${subject}`).ok) {
    return new NextResponse(null, { status: 204 });
  }

  bufferImpressions([...new Set(parsed.data.ids)]);

  // 204 with no body: the client has nothing to do with a response, and
  // sendBeacon discards it anyway.
  return new NextResponse(null, { status: 204 });
}

import { NextResponse } from 'next/server';
import { requireUser, Forbidden } from '@/lib/authz';
import { RateLimited, enforce } from '@/lib/rateLimit';
import { collectAccountExport } from '@/lib/account';

/**
 * Download form of the account export.
 *
 * A server action can return the object, but it cannot hand the browser a file;
 * a data-rights export that a user cannot actually save is not a working
 * export. Same guard and same throttle as the action — this is a second door
 * onto one room, not a lighter-weight path into it.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    enforce('account.export', `u:${user.id}`);

    const payload = await collectAccountExport(user.id);
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="index-export-${stamp}.json"`,
        // Never cacheable: this is one person's entire record.
        'cache-control': 'no-store, private',
      },
    });
  } catch (err) {
    if (err instanceof Forbidden) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 403 });
    }
    if (err instanceof RateLimited) {
      return NextResponse.json(
        { error: 'Too many export requests' },
        { status: 429, headers: { 'retry-after': String(Math.ceil(err.retryAfterMs / 1000)) } },
      );
    }
    throw err;
  }
}

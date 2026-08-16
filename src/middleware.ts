import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';

/**
 * Route protection. The unlisted /tg-admin path is a convenience, NOT access
 * control — an unguessable path leaks through referrers, browser history,
 * proxy logs and screenshots. The real controls are the role check here, the
 * noindex header in next.config.mjs, and (in deployment) a separate origin,
 * mandatory MFA and an IP allowlist.
 */
export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await auth();
  const role = session?.user?.role;
  const active = session?.user?.status === 'ACTIVE';

  if (pathname.startsWith('/tg-admin')) {
    if (pathname === '/tg-admin/login') return NextResponse.next();
    if (!session || !active || role !== 'ADMIN') {
      // 404 rather than 403: do not confirm the path exists to a prober.
      return NextResponse.rewrite(new URL('/404', req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/merchant')) {
    if (pathname === '/merchant/login') return NextResponse.next();
    if (!session || !active) {
      return NextResponse.redirect(new URL('/merchant/login', req.url));
    }
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/register?intent=sell', req.url));
    }
  }

  if (pathname.startsWith('/archive') && (!session || !active)) {
    return NextResponse.redirect(new URL('/register', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/tg-admin/:path*', '/merchant/:path*', '/archive/:path*'],
};

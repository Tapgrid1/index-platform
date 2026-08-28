import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authConfig } from '@/auth.config';

/**
 * Route protection. The unlisted /tg-admin path is a convenience, NOT access
 * control — an unguessable path leaks through referrers, browser history,
 * proxy logs and screenshots. The real controls are the role check here, the
 * noindex header in next.config.mjs, and (in deployment) a separate origin,
 * mandatory MFA and an IP allowlist.
 *
 * The session is read through the edge-safe config, NOT through '@/auth'.
 * Importing the full instance pulled the Prisma adapter into the edge runtime,
 * where it cannot run: every auth() call threw, every check below saw "no
 * session", and the portal and admin console were unreachable for everyone.
 * See src/auth.config.ts.
 */
const { auth } = NextAuth(authConfig);
const MERCHANT_PUBLIC = new Set(['/merchant/login', '/merchant/forgot', '/merchant/reset']);

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
    // Reaching these REQUIRES being signed out — a merchant who has forgotten
    // their password by definition cannot get past the guard below to fix it.
    if (MERCHANT_PUBLIC.has(pathname)) return NextResponse.next();
    if (!session || !active) {
      return NextResponse.redirect(new URL('/merchant/login', req.url));
    }
    // Deliberately no role check here, unlike /tg-admin above.
    //
    // Owning a store, not holding a role, is what the portal actually gates on,
    // and that is resolved per-request by ownStoreOrOnboard(): no store sends
    // you to /merchant/new, and having one sends you back out of it. A role
    // check in middleware cannot do the same job, because the role it reads is
    // the one stamped into the JWT at sign-in — createStore promotes a SHOPPER
    // to OWNER, and the token does not learn that until it rotates, so the two
    // redirects would chase each other in a loop.
    //
    // Sending a shopper who wandered in to the store form is also the right
    // answer on its own: /merchant is where "list my store" points.
  }

  if (pathname.startsWith('/archive') && (!session || !active)) {
    return NextResponse.redirect(new URL('/register', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/tg-admin/:path*', '/merchant/:path*', '/archive/:path*'],
};

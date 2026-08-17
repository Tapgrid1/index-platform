import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// NOT '@/auth' — that instance queries Prisma, which cannot run on the Edge
// runtime this file executes in. See src/auth.edge.ts for what that broke.
import { edgeAuth } from '@/auth.edge';

/**
 * Route protection and Content-Security-Policy.
 *
 * The unlisted /tg-admin path is a convenience, NOT access control — an
 * unguessable path leaks through referrers, browser history, proxy logs and
 * screenshots. The real controls are the role check here, the noindex header in
 * next.config.mjs, and (in deployment) a separate origin, mandatory MFA and an
 * IP allowlist.
 *
 * This runs on every page request, but auth() does not: session lookup costs a
 * database read, so it is scoped to the paths that actually gate on it. Public
 * pages pay for a nonce and a header, nothing more. The scan resolver and the
 * outbound hops are excluded entirely (see the matcher) — they are latency
 * critical and serve no HTML for a CSP to protect.
 */

// Sign-in is the only /merchant page a signed-out visitor may reach. There is
// no forgot/reset pair any more — authentication is OAuth only, so account
// recovery belongs to Google and Apple rather than to this app.
const MERCHANT_PUBLIC = new Set(['/merchant/login']);
const GUARDED = ['/tg-admin', '/merchant', '/archive'];

function makeNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === 'development';

  return [
    "default-src 'self'",
    // 'strict-dynamic' lets Next's own bootstrap load the chunks it needs
    // without allowlisting every path. The dev server compiles with eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${dev ? "'unsafe-eval'" : ''}`.trim(),
    // Styles stay 'unsafe-inline': Next injects inline style attributes during
    // hydration, and a style nonce breaks them for no real security gain —
    // CSS injection is not the threat this policy is defending against.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // Store logos and product shots are merchant-supplied URLs on arbitrary
    // hosts (next.config allows any https host) plus data: URIs until the
    // image pipeline lands.
    "img-src 'self' data: https:",
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const nonce = makeNonce();
  const csp = contentSecurityPolicy(nonce);

  // Next reads x-nonce off the REQUEST headers and stamps it onto its own
  // script tags; the CSP itself goes on the response.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  const pass = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('Content-Security-Policy', csp);
    return res;
  };
  const send = (res: NextResponse) => {
    res.headers.set('Content-Security-Policy', csp);
    return res;
  };

  if (!GUARDED.some((prefix) => pathname.startsWith(prefix))) return pass();

  const session = await edgeAuth();
  const role = session?.user?.role;
  const active = session?.user?.status === 'ACTIVE';

  if (pathname.startsWith('/tg-admin')) {
    // There is no /tg-admin/login: admins sign in through the same OAuth entry
    // point as everyone else and are recognised by the ADMIN_EMAILS allowlist.
    // A dedicated admin login page would be a page that confirms the console
    // exists, which is exactly what the 404 below refuses to do.
    if (!session || !active || role !== 'ADMIN') {
      // 404 rather than 403: do not confirm the path exists to a prober.
      return send(NextResponse.rewrite(new URL('/404', req.url)));
    }
    return pass();
  }

  if (pathname.startsWith('/merchant')) {
    // Reaching these REQUIRES being signed out — a merchant who has forgotten
    // their password by definition cannot get past the guard below to fix it.
    if (MERCHANT_PUBLIC.has(pathname)) return pass();
    if (!session || !active) {
      return send(NextResponse.redirect(new URL('/merchant/login', req.url)));
    }
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return send(NextResponse.redirect(new URL('/register?intent=sell', req.url)));
    }
  }

  if (pathname.startsWith('/archive') && (!session || !active)) {
    return send(NextResponse.redirect(new URL('/register', req.url)));
  }

  return pass();
}

export const config = {
  matcher: [
    /*
     * Every page, so the CSP is universal — minus:
     *   _next/static, _next/image, favicon  static assets, no HTML
     *   r/          THE RESOLVER, latency critical, no HTML
     *   out/        outbound redirects, latency critical, no HTML
     *   api/        JSON; these set their own headers
     * Excluding the resolver is deliberate: a scan is a person standing in a
     * physical place with no retry, and middleware is overhead on that path.
     */
    '/((?!_next/static|_next/image|favicon.ico|r/|out/|api/).*)',
  ],
};

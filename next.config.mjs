/** @type {import('next').NextConfig} */

// Applied to every route. The Content-Security-Policy is deliberately NOT here
// — it carries a per-request nonce and is set in src/middleware.ts, because a
// statically configured CSP can only use 'unsafe-inline' for scripts, which
// gives away most of what a CSP is for.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Redundant with frame-ancestors in the CSP, kept for older browsers.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Referrers are how an unlisted admin path leaks in the first place.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    // Two years, subdomains included. Only meaningful over https, ignored by
    // browsers on http, so it is safe to send in development too.
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
];

const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '8mb' } },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },

  // A stack trace in a response body tells an attacker about the code.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // The admin console must never be indexed. Obfuscation is not access
        // control (see docs/DECISIONS.md), but it should not be crawlable either.
        source: '/tg-admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        // Outbound hops and the scan resolver are redirects, not content.
        // Indexing them wastes crawl budget and leaks placement codes.
        source: '/out/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/r/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        // One person's entire record. Never cached by a proxy.
        source: '/api/account/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, private' }],
      },
    ];
  },
};

export default nextConfig;

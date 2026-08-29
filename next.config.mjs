/** @type {import('next').NextConfig} */
const nextConfig = {
  // 4mb, not 8: a serverless function request body is capped at 4.5 MB by the
  // host, and no config here raises a platform limit. Set above it, an oversized
  // product image returns an opaque 413 from the edge instead of the app's own
  // error — and images are stored as data URIs, which inflate by about a third.
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  async headers() {
    return [
      {
        // BETA ONLY — narrow this back to '/tg-admin/:path*' at launch.
        //
        // robots.txt is a request; this header is the instruction a crawler has
        // to follow, and it is what actually keeps the seeded fictional stores
        // out of search results while the beta runs.
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        // The admin console must never be indexed, beta or not. Obfuscation is
        // not access control (see docs/DECISIONS.md), but it should not be
        // crawlable either. Kept separate so the rule above can be deleted
        // without taking this one with it.
        source: '/tg-admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};
export default nextConfig;

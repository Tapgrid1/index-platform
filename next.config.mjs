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
        // The admin console must never be indexed. Obfuscation is not access
        // control (see docs/DECISIONS.md), but it should not be crawlable either.
        source: '/tg-admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};
export default nextConfig;

/**
 * The canonical public origin.
 *
 * Sitemaps and emails both need absolute URLs, and getting this wrong is quiet
 * — a sitemap full of localhost links is accepted by the crawler and simply
 * indexes nothing. AUTH_URL already has to be correct for OAuth callbacks to
 * work at all, which makes it the most reliable value in the environment.
 */
export function siteUrl() {
  const raw =
    process.env.SITE_URL ??
    process.env.AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000');

  return raw.replace(/\/+$/, '');
}

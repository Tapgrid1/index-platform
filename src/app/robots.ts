import type { MetadataRoute } from 'next';

/**
 * BETA ONLY — delete this file at launch.
 *
 * The directory is currently populated with fictional seed stores. Letting a
 * crawler index them means a real store that later takes one of those slugs
 * inherits a cached placeholder, and it puts invented merchants in search
 * results under a real domain in the meantime.
 *
 * Paired with the site-wide X-Robots-Tag in next.config.mjs, which is what a
 * crawler that ignores robots.txt actually has to obey.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}

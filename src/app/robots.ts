import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * The directory is the front door and wants to be indexed. Everything that is
 * not a browsable page does not.
 *
 * /tg-admin is listed here as defence in depth, not as concealment — naming it
 * in a public file obviously does not hide it, and it was never hidden: the
 * access control is the role check in middleware. What this prevents is the
 * console turning up in search results, which is a separate and real problem.
 */
// Same reasoning as the sitemap: siteUrl() reads the environment, and a value
// baked in at build time is the build's environment, not the deployment's.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/tg-admin',
          '/merchant', // portal, behind auth
          '/archive', // one shopper's saved stores
          '/api/',
          '/out/', // outbound hops; crawling them inflates click counts
          '/r/', // placement codes are not for crawlers
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { siteUrl } from '@/lib/site';

/**
 * Cold start is the risk the code cannot solve (docs/DECISIONS.md), and organic
 * discovery is one of the few levers that touches it at all.
 *
 * Note what is NOT here: individual store pages. There is no /s/:slug route,
 * and that is by design rather than by omission — the no-profile-intermediary
 * model sends a shopper straight from the card to the merchant's own storefront
 * (ARCHITECTURE.md §8), so a per-store page on this domain would be a second
 * destination competing with the one the merchant is paying for. Store.slug
 * exists in the schema but routes to nothing.
 *
 * The consequence is worth stating plainly: the entire indexable surface of
 * this product is the directory, the community, and the curated collections.
 * If organic search is meant to carry any of the cold-start load, that is a
 * product decision to take deliberately, not something a sitemap can fix.
 */
/**
 * Generated per request, not at build.
 *
 * The obvious setting here is `revalidate`, and it is wrong: Next prerenders an
 * ISR route during `next build`, which on most hosts runs with no reachable
 * database. The sitemap then ships containing whatever the build could see —
 * nothing — and serves that for the full revalidation window. This was not
 * hypothetical; it is what the first build of this file actually produced.
 *
 * Two small indexed queries per crawl is the correct price for a sitemap that
 * reflects the database rather than the build environment.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const collections = await db.collection.findMany({
    where: { isActive: true, kind: 'PILL' },
    select: { slug: true },
    orderBy: { sortOrder: 'asc' },
  });

  // The directory's freshness is the freshest thing on the site: it changes
  // whenever any listed store edits its card.
  const newest = await db.store.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { lastEditedAt: 'desc' },
    select: { lastEditedAt: true },
  });

  return [
    {
      url: `${base}/`,
      lastModified: newest?.lastEditedAt ?? new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    { url: `${base}/community`, changeFrequency: 'daily', priority: 0.8 },
    ...collections.map((c) => ({
      url: `${base}/collections/${c.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}

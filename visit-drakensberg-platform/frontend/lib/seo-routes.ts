/**
 * The site's static indexable routes, in one place.
 *
 * Two consumers read this: `app/sitemap.ts`, which emits them, and
 * `app/admin/seo/sitemap/page.tsx` (Tool 12), which reports on them. They used
 * to be a hardcoded array in the sitemap plus a hand-copied
 * `STATIC_ROUTE_COUNT = 19` in the admin tool — and the copy had already
 * drifted: 22 routes were being emitted while the console reported 19. The
 * count is now derived, so the class of bug is gone rather than the instance.
 *
 * A path belongs here only if the page is actually indexable — nothing that
 * sets `robots: { index: false }` in its own page/layout metadata. Advertising
 * a noindex URL in a sitemap spends crawl budget asking Google to fetch a page
 * it is then told to drop, and Search Console reports it back as
 * "Excluded by 'noindex' tag" against a URL we submitted. That is why /search
 * is absent (noindex, see app/search/layout.tsx) even though it is a
 * prominent, linked page.
 */
export type StaticRoute = {
  path: string
  priority: number
}

export const STATIC_ROUTES: StaticRoute[] = [
  { path: '', priority: 1.0 },
  { path: '/stays', priority: 0.9 },
  { path: '/hikes', priority: 0.9 },
  { path: '/activities', priority: 0.9 },
  { path: '/tours', priority: 0.8 },
  { path: '/regions', priority: 0.8 },
  { path: '/nature-reserves', priority: 0.7 },
  { path: '/towns', priority: 0.7 },
  { path: '/packages', priority: 0.7 },
  { path: '/events', priority: 0.7 },
  { path: '/transport', priority: 0.6 },
  { path: '/shuttles', priority: 0.6 },
  { path: '/guides', priority: 0.6 },
  { path: '/plan', priority: 0.6 },
  { path: '/mydrakensberg', priority: 0.6 },
  { path: '/field-guide', priority: 0.5 },
  { path: '/about', priority: 0.4 },
  { path: '/list-with-us', priority: 0.4 },
  // The supplier documents an operator is asked to accept, and the concern
  // channel the Code of Conduct points people at. Indexed on purpose: a
  // business deciding whether to list should be able to read the terms
  // before starting the form, and find the concern channel without one.
  // (Neither is blocked by robots.ts — the /supplier/ disallow carries a
  // trailing slash, so it does not match /supplier-terms.)
  { path: '/supplier-terms', priority: 0.3 },
  { path: '/supplier-code-of-conduct', priority: 0.3 },
  { path: '/report-a-concern', priority: 0.3 },
  { path: '/privacy', priority: 0.2 },
  { path: '/terms', priority: 0.2 },
]

/**
 * Editorial articles that are still compiled into
 * `app/mydrakensberg/[slug]/page.tsx` as the `ARTICLES` record, rather than
 * living in the `blog_posts` table.
 *
 * The sitemap emits these *plus* every published row from `blog_posts`,
 * deduplicated by slug — a CMS post written at the same slug takes over the
 * URL, and the entry is emitted once either way.
 */
export const EDITORIAL_FALLBACK_SLUGS = [
  'san-bushmen-rock-art-giants-castle',
  'tugela-falls-chain-ladder-guide',
  'bearded-vulture-lammergeier',
  'zulu-cuisine-foothills',
  'battle-of-isandlwana-history',
  'conservation-umdoni-wetlands',
]

import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// Public, indexable routes. Detail pages backed by live Supabase data are
// intentionally omitted here — add them once listing slugs are stable.
const STATIC_ROUTES = [
  { path: '', priority: 1.0 },
  { path: '/stays', priority: 0.9 },
  { path: '/hikes', priority: 0.9 },
  { path: '/activities', priority: 0.9 },
  { path: '/search', priority: 0.8 },
  { path: '/regions', priority: 0.8 },
  { path: '/nature-reserves', priority: 0.7 },
  { path: '/packages', priority: 0.7 },
  { path: '/events', priority: 0.7 },
  { path: '/shuttles', priority: 0.6 },
  { path: '/guides', priority: 0.6 },
  { path: '/plan', priority: 0.6 },
  { path: '/mydrakensberg', priority: 0.6 },
  { path: '/about', priority: 0.4 },
  { path: '/list-your-property', priority: 0.4 },
  { path: '/privacy', priority: 0.2 },
  { path: '/terms', priority: 0.2 },
]

// Editorial article slugs defined in app/mydrakensberg/[slug]/page.tsx
const STORY_SLUGS = [
  'san-bushmen-rock-art-giants-castle',
  'tugela-falls-chain-ladder-guide',
  'bearded-vulture-lammergeier',
  'zulu-cuisine-foothills',
  'battle-of-isandlwana-history',
  'conservation-umdoni-wetlands',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    ...STATIC_ROUTES.map(r => ({
      url: `${SITE_URL}${r.path}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: r.priority,
    })),
    ...STORY_SLUGS.map(slug => ({
      url: `${SITE_URL}/mydrakensberg/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ]
}

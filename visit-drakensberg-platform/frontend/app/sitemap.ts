import type { MetadataRoute } from 'next'
import { getRegions, DEFAULT_REGIONS } from '@/lib/regions'
import { getReserves, DEFAULT_RESERVES } from '@/lib/reserves'
import { getTowns, DEFAULT_TOWNS } from '@/lib/towns'
import { publicSupabase } from '@/lib/supabase-public'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// Public, indexable routes. Detail pages backed by live Supabase data are
// added incrementally as each entity type gets a real generateMetadata pass
// (see docs/destination-graph/PHASE_B.md) — regions, reserves and towns are
// done. Adding the rest (trails, properties, activities, ...) is Phase B
// follow-up work, not done here yet.
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Session-less client (see lib/supabase-public.ts) — this runs at build/
  // request time outside any user's request context. Falls back to the same
  // DEFAULT_* content the live pages themselves fall back to on a read
  // failure, so the sitemap never silently drops URLs that the site is
  // still actually serving.
  const [regions, reserves, towns] = await Promise.all([
    getRegions(publicSupabase).catch(() => DEFAULT_REGIONS),
    getReserves(publicSupabase).catch(() => DEFAULT_RESERVES),
    getTowns(publicSupabase).catch(() => DEFAULT_TOWNS),
  ])

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
    ...regions.map(r => ({
      url: `${SITE_URL}/regions/${r.slug}`,
      lastModified: r.updatedAt ? new Date(r.updatedAt) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...reserves.map(r => ({
      url: `${SITE_URL}/nature-reserves/${r.slug}`,
      lastModified: r.updatedAt ? new Date(r.updatedAt) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...towns.map(t => ({
      url: `${SITE_URL}/towns/${t.slug}`,
      lastModified: t.updatedAt ? new Date(t.updatedAt) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ]
}

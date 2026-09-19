import type { MetadataRoute } from 'next'
import { getRegions, DEFAULT_REGIONS } from '@/lib/regions'
import { getReserves, DEFAULT_RESERVES } from '@/lib/reserves'
import { getTowns, DEFAULT_TOWNS } from '@/lib/towns'
import { getTrails, DEFAULT_TRAILS } from '@/lib/trails'
import { getProperties } from '@/lib/properties'
import { getActivities } from '@/lib/activities'
import { getPackages } from '@/lib/packages'
import { getTours } from '@/lib/tours'
import { getRoutes, routeSlug } from '@/lib/transport-routes'
import { getPublishedPosts } from '@/lib/blog-posts'
import { getFieldGuideIndex } from '@/lib/field-guide'
import { STATIC_ROUTES, EDITORIAL_FALLBACK_SLUGS } from '@/lib/seo-routes'
import { publicSupabase } from '@/lib/supabase-public'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// Regenerate hourly rather than only at build. Without this the sitemap is
// prerendered once per deploy, so a lodge a supplier published on Tuesday
// stays out of it until something else triggers a Vercel build — on a
// platform where operators add listings themselves, that is the difference
// between a page being discoverable the same afternoon and weeks later. The
// same interval the CMS-backed public routes use.
export const revalidate = 3600

// Public, indexable routes. Detail pages backed by live Supabase data are
// added incrementally as each entity type gets a real generateMetadata pass
// (see docs/destination-graph/PHASE_B.md) — every converted entity type is
// now included below. Guides/operators (directory-style, lower search
// volume) and experiences (dated departures — see the noindex-when-past
// logic in app/experiences/[id]/page.tsx) are intentionally left out of the
// sitemap; a crawler reaches them via the trail/tour pages that link to them
// instead.
//
// The static route list itself lives in lib/seo-routes.ts, because the admin
// Sitemap Control tool reports on the same set and used to keep its own copy.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Session-less client (see lib/supabase-public.ts) — this runs at build/
  // request time outside any user's request context. Falls back to the same
  // DEFAULT_* content the live pages themselves fall back to on a read
  // failure, so the sitemap never silently drops URLs that the site is
  // still actually serving.
  const [
    regions, reserves, towns, trails, properties, activities, packages, tours, routes, posts, fieldGuides,
  ] = await Promise.all([
    getRegions(publicSupabase).catch(() => DEFAULT_REGIONS),
    getReserves(publicSupabase).catch(() => DEFAULT_RESERVES),
    getTowns(publicSupabase).catch(() => DEFAULT_TOWNS),
    getTrails(publicSupabase).catch(() => DEFAULT_TRAILS),
    getProperties(publicSupabase).catch(() => []),
    getActivities(publicSupabase).catch(() => []),
    getPackages(publicSupabase).catch(() => []),
    getTours(publicSupabase).catch(() => []),
    getRoutes(publicSupabase).catch(() => []),
    getPublishedPosts(publicSupabase).catch(() => []),
    getFieldGuideIndex(publicSupabase).catch(() => []),
  ])

  // Editorial articles come from two places while the journal finishes moving
  // into the CMS: published `blog_posts` rows, and the articles still compiled
  // into app/mydrakensberg/[slug]/page.tsx. Both are served at the same URL
  // shape, and the route prefers the CMS row, so a slug present in both is one
  // URL — emit it once.
  const storySlugs = [
    ...posts.map(post => post.slug).filter(Boolean),
    ...EDITORIAL_FALLBACK_SLUGS.filter(slug => !posts.some(post => post.slug === slug)),
  ]
  const storyLastModified = new Map(
    posts.map(post => [post.slug, new Date(post.updated_at || post.published_at || post.created_at)]),
  )

  return [
    ...STATIC_ROUTES.map(r => ({
      // `|| '/'` for the homepage: the root layout's canonical resolves to
      // https://visitdrakensberg.com/ (metadataBase + '/'), and a sitemap
      // entry without the slash is a different URL string to Search Console,
      // which reports it as submitted-but-canonicalised-elsewhere.
      url: `${SITE_URL}${r.path || '/'}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: r.priority,
    })),
    ...storySlugs.map(slug => ({
      url: `${SITE_URL}/mydrakensberg/${slug}`,
      lastModified: storyLastModified.get(slug) ?? now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    // Published field guides. The index rows are what /field-guide itself
    // renders, so anything listed there is live and has a detail page.
    ...fieldGuides.map(guide => ({
      url: `${SITE_URL}/field-guide/${guide.slug}`,
      lastModified: guide.publishedAt ? new Date(guide.publishedAt) : now,
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
    // Trail/property/activity/package URLs use `slug || id` — the same
    // resolution every converted detail route reads for its own canonical
    // tag, so this never advertises a non-canonical form. Most don't have a
    // slug populated yet, so the URL here is the same prop-<uuid>-style id
    // form the live page currently serves at — exactly right, not a gap.
    ...trails
      .filter(t => t.status === 'published' && t.robotsIndex !== false)
      .map(t => ({
        url: `${SITE_URL}/hikes/${t.slug || t.id}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })),
    ...properties
      .filter(p => p.status === 'active' && p.robotsIndex !== false)
      .map(p => ({
        url: `${SITE_URL}/stays/${p.slug || p.id}`,
        lastModified: new Date(p.createdAt),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ...activities
      .filter(a => a.status === 'active' && a.robotsIndex !== false)
      .map(a => ({
        url: `${SITE_URL}/activities/${a.slug || a.id}`,
        lastModified: new Date(a.createdAt),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ...packages
      .filter(p => p.packageStatus === 'published' && p.robotsIndex !== false)
      .map(p => ({
        url: `${SITE_URL}/packages/${p.slug || p.id}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(p.createdAt),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ...tours
      .filter(t => t.status === 'active' && t.robotsIndex !== false)
      .map(t => ({
        url: `${SITE_URL}/tours/${t.slug || t.id}`,
        lastModified: new Date(t.createdAt),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ...routes
      .filter(r => r.status === 'active' && r.robotsIndex !== false)
      .map(r => ({
        url: `${SITE_URL}/transport/${routeSlug(r)}`,
        lastModified: r.updatedAt ? new Date(r.updatedAt) : new Date(r.createdAt),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
  ]
}

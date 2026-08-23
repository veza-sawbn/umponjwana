import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTrails, type Trail, DEFAULT_TRAILS } from '@/lib/trails'
import { getProperties, type Property } from '@/lib/properties'
import { getActivities, type Activity } from '@/lib/activities'
import { publicSupabase } from '@/lib/supabase-public'
import HikeDetail from './HikeDetail'
import TrackView from '@/components/analytics/TrackView'

// Server shell — same pattern as app/regions/[slug]/page.tsx. Trail has no
// seoTitle/seoDescription populated yet (GraphFields fields exist but
// nothing writes them for trails yet — see docs/destination-graph/PHASE_A.md),
// so title/description are built from the trail's own core fields. Once an
// SEO panel (docs/seo-audit/INTERNAL_SEO_TOOLS.md Tool 1) lets admins set
// them, GraphFields.seoTitle/seoDescription take priority automatically
// below — no further code change needed then.
//
// Previously, an unresolvable id silently fell back to `trails[0]` (the
// first trail in the list) rather than 404ing — this was a latent bug.
// Fixed here: an unknown id now correctly 404s, matching every other entity
// detail route.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// ISR — trail content (route, elevation, permits) changes infrequently,
// but more often than region/reserve/town copy. See
// docs/destination-graph/PHASE_D.md.
export const revalidate = 1800

async function resolveTrail(id: string): Promise<Trail | null> {
  const trails = await getTrails(publicSupabase).catch(() => DEFAULT_TRAILS)
  return trails.find(t => t.id === id || t.slug === id) ?? null
}

/**
 * Fetch properties to surface in "Where to Stay" on this trail's detail page.
 * Explicit links (relatedPropertyIds) take priority; falls back to
 * same-region active properties when no explicit links are set.
 */
async function resolveRelatedProperties(trail: Trail): Promise<Property[]> {
  const all = await getProperties(publicSupabase).catch(() => [] as Property[])
  const active = all.filter(p => p.status === 'active')

  if ((trail.relatedPropertyIds ?? []).length > 0) {
    const ids = new Set(trail.relatedPropertyIds!)
    return active.filter(p => ids.has(p.id)).slice(0, 4)
  }

  // Fallback: same-region properties, max 3
  return active
    .filter(p => p.region === trail.region)
    .slice(0, 3)
}

/**
 * Fetch activities for "Things to Do Nearby". Same explicit-link-then-region
 * fallback pattern as resolveRelatedProperties.
 */
async function resolveRelatedActivities(trail: Trail): Promise<Activity[]> {
  const all = await getActivities(publicSupabase).catch(() => [] as Activity[])
  const active = all.filter(a => a.status === 'active')

  if ((trail.relatedActivityIds ?? []).length > 0) {
    const ids = new Set(trail.relatedActivityIds!)
    return active.filter(a => ids.has(a.id)).slice(0, 4)
  }

  // Fallback: same-region activities, max 3
  return active
    .filter(a => a.region === trail.region)
    .slice(0, 3)
}

function buildDescription(trail: Trail): string | undefined {
  if (trail.seoDescription) return trail.seoDescription
  if (!trail.description) return undefined
  const prefix = `${trail.distance} · ${trail.difficulty} · ${trail.region}. `
  const remaining = 155 - prefix.length
  const body = trail.description.length > remaining
    ? `${trail.description.slice(0, remaining - 1).trimEnd()}…`
    : trail.description
  return `${prefix}${body}`
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const trail = await resolveTrail(params.id)
  if (!trail) return { title: 'Trail Not Found' }

  const title = trail.seoTitle || `${trail.name} — ${trail.region} | Visit Drakensberg`
  const description = buildDescription(trail)
  const canonical = `/hikes/${trail.slug || trail.id}`

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      images: trail.image ? [{ url: trail.image }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function HikePage({ params }: { params: { id: string } }) {
  const trail = await resolveTrail(params.id)
  if (!trail) notFound()

  // Fetch related content in parallel — these never block the 404 check above.
  // `trail!` because notFound() is typed as `never` but TS doesn't narrow past it.
  const [relatedProperties, relatedActivities] = await Promise.all([
    resolveRelatedProperties(trail!),
    resolveRelatedActivities(trail!),
  ])

  const canonicalUrl = `${SITE_URL}/hikes/${trail.slug || trail.id}`

  const attractionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: trail.name,
    description: trail.seoDescription || trail.description || undefined,
    url: canonicalUrl,
    image: trail.image || undefined,
    containedInPlace: trail.region ? { '@type': 'Place', name: trail.region } : undefined,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Hikes', item: `${SITE_URL}/hikes` },
      { '@type': 'ListItem', position: 3, name: trail.name, item: canonicalUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(attractionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <TrackView event="trail_view" properties={{ id: trail.id, name: trail.name, region: trail.region, difficulty: trail.difficulty }} />
      <HikeDetail
        trail={trail}
        relatedProperties={relatedProperties}
        relatedActivities={relatedActivities}
      />
    </>
  )
}

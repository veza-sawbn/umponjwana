import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTours, type Tour } from '@/lib/tours'
import { getTrails } from '@/lib/trails'
import { publicSupabase } from '@/lib/supabase-public'
import { getNearbyStays, type NearbyStayResult } from '@/lib/modules'
import TourDetail from './TourDetail'
import TrackView from '@/components/analytics/TrackView'

// Server shell — same pattern as the other converted detail routes. Tours
// have no dedicated getTourById() (no such helper existed), so this
// resolves from the full list, matching how getExperiencesByTrail() etc.
// already filter from a full fetch elsewhere in the codebase. Tour has no
// seoTitle/seoDescription populated yet, so title/description are built
// from its own core fields. See docs/destination-graph/PHASE_B.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// ISR — short interval: supplier-editable pricing/status changes more
// often than editorial content. Upcoming departures stay a client-side
// fetch regardless (see TourDetail.tsx) — this only governs freshness of
// the tour shell itself. See docs/destination-graph/PHASE_D.md.
export const revalidate = 300

async function resolveTour(id: string): Promise<Tour | null> {
  const tours = await getTours(publicSupabase)
  return tours.find(t => t.id === id || t.slug === id) ?? null
}

// Tour has no region field of its own — it's derived from the trail it
// runs on, same relationship Departure/TrekkingExperience use elsewhere.
async function resolveTourRegion(tour: Tour): Promise<string> {
  if (!tour.trailId) return ''
  const trails = await getTrails(publicSupabase)
  return trails.find(t => t.id === tour.trailId)?.region ?? ''
}

function buildDescription(tour: Tour): string | undefined {
  if (tour.seoDescription) return tour.seoDescription
  if (!tour.description) return undefined
  const prefix = `${tour.days} day${tour.days !== 1 ? 's' : ''} · ${tour.difficulty}${tour.trailName ? ` · ${tour.trailName}` : ''}. `
  const remaining = 155 - prefix.length
  const body = tour.description.length > remaining ? `${tour.description.slice(0, remaining - 1).trimEnd()}…` : tour.description
  return `${prefix}${body}`
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const tour = await resolveTour(params.id)
  if (!tour) return { title: 'Tour Not Found' }

  const title = tour.seoTitle || `${tour.name}${tour.trailName ? ` — ${tour.trailName}` : ''} | Visit Drakensberg`
  const description = buildDescription(tour)
  const canonical = `/tours/${tour.slug || tour.id}`

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: tour.status === 'active' ? undefined : { index: false, follow: false },
    openGraph: { title, description, url: `${SITE_URL}${canonical}` },
    twitter: { card: 'summary', title, description },
  }
}

export default async function TourPage({ params }: { params: { id: string } }) {
  const tour = await resolveTour(params.id)
  if (!tour) notFound()

  const regionName = await resolveTourRegion(tour)
  const nearbyStays: NearbyStayResult[] = regionName
    ? await getNearbyStays(regionName, { limit: 4 }, publicSupabase)
    : []

  const canonicalUrl = `${SITE_URL}/tours/${tour.slug || tour.id}`

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: tour.name,
    description: tour.seoDescription || tour.description || undefined,
    url: canonicalUrl,
    offers: tour.pricePerPerson ? {
      '@type': 'Offer',
      price: tour.pricePerPerson,
      priceCurrency: 'ZAR',
      availability: tour.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: canonicalUrl,
    } : undefined,
    ...(tour.rating ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: tour.rating,
        reviewCount: tour.reviewCount || 1,
      },
    } : {}),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tours', item: `${SITE_URL}/tours` },
      { '@type': 'ListItem', position: 3, name: tour.name, item: canonicalUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <TrackView event="tour_view" properties={{ id: tour.id, name: tour.name, region: regionName }} />
      <TourDetail tour={tour} nearbyStays={nearbyStays} />
    </>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPropertyById, type Property } from '@/lib/properties'
import { getRoomsByProperty, type Room } from '@/lib/rooms'
import { publicSupabase } from '@/lib/supabase-public'
import StayDetail from './StayDetail'
import TrackView from '@/components/analytics/TrackView'
import { formatMoney } from '@/lib/allocation'
import JsonLd from '@/components/seo/JsonLd'

// Server shell — same pattern as the other converted detail routes. Property
// has no seoTitle/seoDescription populated yet, so title/description are
// built from its own core fields. The room catalog (static: name, price,
// images, amenities) is fetched alongside the property here too, removing
// the initial loading spinner — only live per-date inventory checking
// (getRoomUnitsLeft) stays a client-side fetch, since it's genuinely
// dynamic. See docs/destination-graph/PHASE_B.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// ISR — short interval: supplier-editable pricing/status changes more
// often than editorial content. Live per-date room availability stays a
// client-side check regardless (see StayDetail.tsx) — this only governs
// how fresh the static shell (property + room catalog) is. See
// docs/destination-graph/PHASE_D.md.
export const revalidate = 300

async function resolveStay(id: string): Promise<{ property: Property; rooms: Room[] } | null> {
  const property = await getPropertyById(id, publicSupabase)
  if (!property) return null
  const rooms = await getRoomsByProperty(id, publicSupabase)
  return { property, rooms }
}

function buildDescription(property: Property, minPrice: number): string | undefined {
  if (property.seoDescription) return property.seoDescription
  if (!property.description) return undefined
  const priceNote = minPrice > 0 ? `From ${formatMoney(minPrice)}/night. ` : ''
  const prefix = `${property.type} in ${property.region || 'the Drakensberg'}. ${priceNote}`
  const remaining = 155 - prefix.length
  const body = property.description.length > remaining
    ? `${property.description.slice(0, remaining - 1).trimEnd()}…`
    : property.description
  return `${prefix}${body}`
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const resolved = await resolveStay(params.id)
  if (!resolved) return { title: 'Stay Not Found' }
  const { property, rooms } = resolved
  const minPrice = rooms.length > 0 ? Math.min(...rooms.map(r => r.basePrice)) : 0

  const title = property.seoTitle || `${property.name} — ${property.region || 'Drakensberg'} | Visit Drakensberg`
  const description = buildDescription(property, minPrice)
  const canonical = `/stays/${property.slug || property.id}`

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: property.status === 'active' ? undefined : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      images: property.photos?.[0] ? [{ url: property.photos[0] }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function StayPage({ params }: { params: { id: string } }) {
  const resolved = await resolveStay(params.id)
  if (!resolved) notFound()
  const { property, rooms } = resolved
  const minPrice = rooms.length > 0 ? Math.min(...rooms.map(r => r.basePrice)) : 0

  const canonicalUrl = `${SITE_URL}/stays/${property.slug || property.id}`

  const lodgingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: property.name,
    description: property.seoDescription || property.description || undefined,
    image: property.photos?.[0] || undefined,
    url: canonicalUrl,
    address: property.address ? { '@type': 'PostalAddress', streetAddress: property.address, addressRegion: property.region } : undefined,
    geo: (property.gpsLat && property.gpsLng) ? {
      '@type': 'GeoCoordinates',
      latitude: property.gpsLat,
      longitude: property.gpsLng,
    } : undefined,
    amenityFeature: property.amenities?.map(a => ({ '@type': 'LocationFeatureSpecification', name: a, value: true })),
    priceRange: minPrice > 0 ? `${formatMoney(minPrice)}+` : undefined,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Stays', item: `${SITE_URL}/stays` },
      { '@type': 'ListItem', position: 3, name: property.name, item: canonicalUrl },
    ],
  }

  return (
    <>
      <JsonLd data={lodgingJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <TrackView event="accommodation_view" properties={{ id: property.id, name: property.name, region: property.region }} />
      <StayDetail property={property} rooms={rooms} id={params.id} />
    </>
  )
}

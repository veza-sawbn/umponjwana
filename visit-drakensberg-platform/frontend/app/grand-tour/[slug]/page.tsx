import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getActivityById, type Activity } from '@/lib/activities'
import { publicSupabase } from '@/lib/supabase-public'
import { dayTourHref } from '@/lib/grand-tour'
import DayTourDetail from '@/components/grand-tour/DayTourDetail'
import TrackView from '@/components/analytics/TrackView'
import JsonLd from '@/components/seo/JsonLd'

// One Grand Tour day tour: its own page, itinerary and booking panel. The
// product is an Activity carrying a `grandTour` listing (lib/grand-tour.ts).
// Same short ISR window as the activity pages, since seats change all day.
export const revalidate = 300

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

async function resolve(slug: string): Promise<Activity | null> {
  return getActivityById(slug, publicSupabase)
}

/** Live and listed: only then does the page take bookings or get indexed. */
function isBookable(tour: Activity): boolean {
  return tour.status === 'active' && !!tour.grandTour?.enabled && (tour.timeslots?.length ?? 0) > 0
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tour = await resolve(params.slug)
  if (!tour) return { title: 'Tour Not Found' }
  const title = tour.seoTitle || `${tour.name} | Grand Tour Drakensberg`
  const from = tour.grandTour?.departsFrom ? ` Departs ${tour.grandTour.departsFrom}` : ''
  const description = tour.seoDescription
    || `${tour.name}: a Grand Tour Drakensberg day tour${tour.supplierName ? ` with ${tour.supplierName}` : ''}.${from}${tour.grandTour?.pickupPoints?.length ? ', with hotel pickups' : ''}. Book your seats online.`
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: dayTourHref(tour) },
    robots: isBookable(tour) ? undefined : { index: false, follow: false },
    openGraph: { title, description, url: `${SITE_URL}${dayTourHref(tour)}`, images: tour.photos?.[0] ? [{ url: tour.photos[0] }] : undefined },
  }
}

export default async function DayTourPage({ params }: { params: { slug: string } }) {
  const tour = await resolve(params.slug)
  if (!tour) notFound()
  const bookable = isBookable(tour)
  const url = `${SITE_URL}${dayTourHref(tour)}`

  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'TouristTrip',
        name: tour.name,
        description: tour.description || undefined,
        image: tour.photos?.[0] || undefined,
        url,
        provider: tour.supplierName ? { '@type': 'Organization', name: tour.supplierName } : undefined,
        offers: tour.pricePerPerson ? {
          '@type': 'Offer', price: tour.pricePerPerson, priceCurrency: 'ZAR', url,
          availability: bookable ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
        } : undefined,
      }} />
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Grand Tour Drakensberg', item: `${SITE_URL}/grand-tour` },
          { '@type': 'ListItem', position: 3, name: tour.name, item: url },
        ],
      }} />
      <TrackView event="grand_tour_view" properties={{ id: tour.id, name: tour.name, region: tour.region }} />
      <DayTourDetail tour={tour} bookable={bookable} />
    </>
  )
}

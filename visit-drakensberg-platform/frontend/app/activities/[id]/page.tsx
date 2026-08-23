import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getActivityById, type Activity } from '@/lib/activities'
import { publicSupabase } from '@/lib/supabase-public'
import ActivityDetail from './ActivityDetail'
import TrackView from '@/components/analytics/TrackView'

// Server shell — same pattern as app/regions/[slug]/page.tsx and
// app/hikes/[id]/page.tsx. Activity has no seoTitle/seoDescription
// populated yet, so title/description are built from its own core fields;
// GraphFields.seoTitle/seoDescription take priority automatically once an
// SEO panel writes them. See docs/destination-graph/PHASE_B.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// ISR — short interval: supplier-editable pricing/status/availability
// changes more often than editorial content. See
// docs/destination-graph/PHASE_D.md.
export const revalidate = 300

async function resolveActivity(id: string): Promise<Activity | null> {
  return getActivityById(id, publicSupabase)
}

function buildDescription(activity: Activity): string | undefined {
  if (activity.seoDescription) return activity.seoDescription
  if (!activity.description) return undefined
  const prefix = `${activity.category} in ${activity.region || 'the Drakensberg'}. `
  const remaining = 155 - prefix.length
  const body = activity.description.length > remaining
    ? `${activity.description.slice(0, remaining - 1).trimEnd()}…`
    : activity.description
  return `${prefix}${body}`
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const activity = await resolveActivity(params.id)
  if (!activity) return { title: 'Activity Not Found' }

  const title = activity.seoTitle || `${activity.name} — ${activity.region || 'Drakensberg'} | Visit Drakensberg`
  const description = buildDescription(activity)
  const canonical = `/activities/${activity.slug || activity.id}`

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    // Draft activities keep resolving (unchanged from prior behaviour — a
    // supplier previewing their own unpublished listing via a direct link
    // still needs this to work), but must never be indexed.
    robots: activity.status === 'active' ? undefined : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      images: activity.photos?.[0] ? [{ url: activity.photos[0] }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function ActivityPage({ params }: { params: { id: string } }) {
  const activity = await resolveActivity(params.id)
  if (!activity) notFound()

  const canonicalUrl = `${SITE_URL}/activities/${activity.slug || activity.id}`

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: activity.name,
    description: activity.seoDescription || activity.description || undefined,
    image: activity.photos?.[0] || undefined,
    url: canonicalUrl,
    offers: activity.pricePerPerson ? {
      '@type': 'Offer',
      price: activity.pricePerPerson,
      priceCurrency: 'ZAR',
      availability: 'https://schema.org/InStock',
      url: canonicalUrl,
    } : undefined,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Activities', item: `${SITE_URL}/activities` },
      { '@type': 'ListItem', position: 3, name: activity.name, item: canonicalUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <TrackView event="activity_view" properties={{ id: activity.id, name: activity.name, region: activity.region }} />
      <ActivityDetail activityData={activity} id={params.id} />
    </>
  )
}

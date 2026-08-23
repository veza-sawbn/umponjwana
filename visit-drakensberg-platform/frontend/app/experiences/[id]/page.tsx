import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getExperienceById, type TrekkingExperience } from '@/lib/experiences'
import { publicSupabase } from '@/lib/supabase-public'
import ExperienceDetail from './ExperienceDetail'

// Server shell — same pattern as the other converted detail routes. An
// experience is a derived/composite view (Departure + Tour + Trail +
// Operator, see lib/experiences.ts), not a single stored entity, so it has
// no seoTitle/seoDescription of its own — title/description are built from
// its own composed fields instead. Note per the audit's framing: a
// departure is temporal/operational, so this page is intentionally about
// one dated booking, not an evergreen landing page (that's the trail page
// at /hikes/[id] and, eventually, /tours/[slug]). See
// docs/destination-graph/PHASE_B.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// No `revalidate` here, deliberately — unlike every other converted route
// (see docs/destination-graph/PHASE_D.md), an experience is one dated
// departure: seats booked, sold-out state and the noindex-when-past logic
// below are all time-sensitive in a way a cached page would misreport.
// Stays fully dynamic (the Next.js default), rendered fresh per request.

async function resolveExperience(id: string): Promise<TrekkingExperience | null> {
  return getExperienceById(id, publicSupabase)
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const exp = await resolveExperience(params.id)
  if (!exp) return { title: 'Experience Not Found' }

  const title = `${exp.title} — ${formatDateShort(exp.departureDate)} | Visit Drakensberg`
  const description = `${exp.durationDays} day${exp.durationDays !== 1 ? 's' : ''} guided departure on ${exp.trailName || 'the trail'} with ${exp.operator}, departing ${formatDateShort(exp.departureDate)}. ${exp.description || ''}`.trim().slice(0, 160)
  const canonical = `/experiences/${exp.id}`
  const isPast = new Date(exp.departureDate) < new Date()

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    // A dated departure stops being a useful search result once it has
    // passed or sold out — noindex rather than delete, so direct links
    // (email confirmations, etc.) keep working.
    robots: (isPast || exp.spacesAvailable === 0) ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: `${SITE_URL}${canonical}` },
    twitter: { card: 'summary', title, description },
  }
}

export default async function ExperiencePage({ params }: { params: { id: string } }) {
  const exp = await resolveExperience(params.id)
  if (!exp) notFound()

  const canonicalUrl = `${SITE_URL}/experiences/${exp.id}`

  const eventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: exp.title,
    description: exp.description || undefined,
    startDate: exp.departureDate,
    endDate: exp.returnDate,
    url: canonicalUrl,
    location: exp.meetingPoint ? { '@type': 'Place', name: exp.meetingPoint } : undefined,
    organizer: { '@type': 'Organization', name: exp.operator },
    offers: {
      '@type': 'Offer',
      price: exp.pricePerPerson,
      priceCurrency: 'ZAR',
      availability: exp.spacesAvailable > 0 ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      url: canonicalUrl,
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Hikes', item: `${SITE_URL}/hikes` },
      ...(exp.trailName ? [{ '@type': 'ListItem', position: 3, name: exp.trailName, item: `${SITE_URL}/hikes/${exp.trailId}` }] : []),
      { '@type': 'ListItem', position: exp.trailName ? 4 : 3, name: exp.title, item: canonicalUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <ExperienceDetail exp={exp} />
    </>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getGuideById, type GuideProfile } from '@/lib/operators'
import { publicSupabase } from '@/lib/supabase-public'
import GuideDetail from './GuideDetail'

// Server shell — same pattern as the other converted detail routes. Guide
// profiles are always linked to their supplier (tour operator); the
// operator lookup itself needs the resolved guide as input, so it stays a
// client-side fetch (see GuideDetail.tsx). See docs/destination-graph/PHASE_B.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// ISR — guide profiles change infrequently. See
// docs/destination-graph/PHASE_D.md.
export const revalidate = 1800

async function resolveGuide(id: string): Promise<GuideProfile | null> {
  return getGuideById(id, publicSupabase)
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const guide = await resolveGuide(params.id)
  if (!guide) return { title: 'Guide Not Found' }

  const title = guide.seoTitle || `${guide.name} — Certified Mountain Guide | Visit Drakensberg`
  const description = guide.seoDescription || guide.bio || `${guide.name} is a certified Drakensberg mountain guide${guide.yearsExperience ? ` with ${guide.yearsExperience} years of experience` : ''}.`
  const canonical = `/guides/${guide.slug || guide.id}`

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      images: guide.portrait ? [{ url: guide.portrait }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function GuidePage({ params }: { params: { id: string } }) {
  const guide = await resolveGuide(params.id)
  if (!guide) notFound()

  const canonicalUrl = `${SITE_URL}/guides/${guide.slug || guide.id}`

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: guide.name,
    description: guide.seoDescription || guide.bio || undefined,
    image: guide.portrait || undefined,
    url: canonicalUrl,
    jobTitle: 'Mountain Guide',
    ...(guide.rating > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: guide.rating,
        reviewCount: guide.tours || 1,
      },
    } : {}),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_URL}/guides` },
      { '@type': 'ListItem', position: 3, name: guide.name, item: canonicalUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <GuideDetail guide={guide} />
    </>
  )
}

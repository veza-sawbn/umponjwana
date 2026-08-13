import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getOperatorById, type OperatorProfile } from '@/lib/operators'
import { publicSupabase } from '@/lib/supabase-public'
import OperatorDetail from './OperatorDetail'

// Server shell — same pattern as the other converted detail routes.
// See docs/destination-graph/PHASE_B.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// ISR — operator profiles change infrequently. See
// docs/destination-graph/PHASE_D.md.
export const revalidate = 1800

async function resolveOperator(id: string): Promise<OperatorProfile | null> {
  return getOperatorById(id, publicSupabase)
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const operator = await resolveOperator(params.id)
  if (!operator) return { title: 'Operator Not Found' }

  const title = operator.seoTitle || `${operator.companyName} — ${operator.location || 'Drakensberg'} Tour Operator | Visit Drakensberg`
  const description = operator.seoDescription || operator.overview || `${operator.companyName}, a verified Drakensberg tour operator${operator.yearsOperating ? ` with ${operator.yearsOperating} years operating` : ''}.`
  const canonical = `/guides/operators/${operator.slug || operator.id}`

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: operator.status === 'active' ? undefined : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      images: operator.logo ? [{ url: operator.logo }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function OperatorPage({ params }: { params: { id: string } }) {
  const operator = await resolveOperator(params.id)
  if (!operator) notFound()

  const canonicalUrl = `${SITE_URL}/guides/operators/${operator.slug || operator.id}`

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: operator.companyName,
    description: operator.seoDescription || operator.overview || undefined,
    image: operator.logo || undefined,
    url: canonicalUrl,
    address: operator.location ? { '@type': 'PostalAddress', addressLocality: operator.location } : undefined,
    ...(operator.rating ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: operator.rating,
        reviewCount: operator.reviewCount || 1,
      },
    } : {}),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_URL}/guides` },
      { '@type': 'ListItem', position: 3, name: operator.companyName, item: canonicalUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <OperatorDetail operator={operator} />
    </>
  )
}

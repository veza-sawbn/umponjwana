import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getRegions, type Region } from '@/lib/regions'
import { publicSupabase } from '@/lib/supabase-public'
import RegionDetail from './RegionDetail'

// Server shell: resolves the region server-side so generateMetadata and the
// JSON-LD below reflect this specific region — Region.seoTitle/seoDescription
// already exist and were previously captured but never read anywhere (see
// docs/seo-audit/SEO_GAPS.md G5). The existing page body moves to
// RegionDetail.tsx unchanged as a client island; only the region lookup
// itself moved server-side. See docs/destination-graph/PHASE_B.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// ISR — regions are admin-configured and change rarely; a stale hour costs
// nothing and every request no longer needs a live Supabase round-trip.
// See docs/destination-graph/PHASE_D.md.
export const revalidate = 3600

async function resolveRegion(slug: string): Promise<Region | null> {
  const regions = await getRegions(publicSupabase)
  return regions.find(r => r.slug === slug || r.id === slug) ?? null
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const region = await resolveRegion(params.slug)
  if (!region) return { title: 'Region Not Found' }

  const title = region.seoTitle || `${region.name} | Visit Drakensberg`
  const description = region.seoDescription || region.overview || region.tagline || undefined
  const canonical = `/regions/${region.slug}`

  return {
    // `title` already includes " | Visit Drakensberg" — use `absolute` so
    // the root layout's title template (`%s | Visit Drakensberg`) doesn't
    // apply on top of it and double the suffix.
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      images: region.heroImage ? [{ url: region.heroImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function RegionPage({ params }: { params: { slug: string } }) {
  const region = await resolveRegion(params.slug)
  if (!region) notFound()

  const canonicalUrl = `${SITE_URL}/regions/${region.slug}`

  const destinationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: region.name,
    description: region.seoDescription || region.overview || undefined,
    url: canonicalUrl,
    image: region.heroImage || undefined,
    containedInPlace: {
      '@type': 'Place',
      name: 'Drakensberg, KwaZulu-Natal, South Africa',
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Regions', item: `${SITE_URL}/regions` },
      { '@type': 'ListItem', position: 3, name: region.name, item: canonicalUrl },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(destinationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <RegionDetail region={region} />
    </>
  )
}

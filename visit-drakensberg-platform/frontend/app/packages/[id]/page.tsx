import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPackageById, type MarketplacePackage } from '@/lib/packages'
import { publicSupabase } from '@/lib/supabase-public'
import PackageDetail from './PackageDetail'
import JsonLd from '@/components/seo/JsonLd'

// Server shell — same pattern as the other converted detail routes. Only a
// genuinely missing package 404s server-side; an existing-but-unpublished
// package still resolves and is handled by PackageDetail's own
// "not available" branch (unchanged prior behaviour), with `robots:noindex`
// set here instead. See docs/destination-graph/PHASE_B.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// ISR — short interval: supplier-editable pricing/status changes more
// often than editorial content. See docs/destination-graph/PHASE_D.md.
export const revalidate = 300

async function resolvePackage(id: string): Promise<MarketplacePackage | null> {
  return getPackageById(id, publicSupabase)
}

function buildDescription(pkg: MarketplacePackage): string | undefined {
  if (pkg.seoDescription) return pkg.seoDescription
  const source = pkg.summary || pkg.description
  if (!source) return undefined
  const prefix = `${pkg.durationNights} night${pkg.durationNights !== 1 ? 's' : ''} · ${pkg.region || 'Drakensberg'}. `
  const remaining = 155 - prefix.length
  const body = source.length > remaining ? `${source.slice(0, remaining - 1).trimEnd()}…` : source
  return `${prefix}${body}`
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const pkg = await resolvePackage(params.id)
  if (!pkg) return { title: 'Package Not Found' }

  const title = pkg.seoTitle || `${pkg.title} — ${pkg.region || 'Drakensberg'} | Visit Drakensberg`
  const description = buildDescription(pkg)
  const canonical = `/packages/${pkg.slug || pkg.id}`

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: pkg.packageStatus === 'published' ? undefined : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      images: pkg.image ? [{ url: pkg.image }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PackagePage({ params }: { params: { id: string } }) {
  const pkg = await resolvePackage(params.id)
  if (!pkg) notFound()

  const canonicalUrl = `${SITE_URL}/packages/${pkg.slug || pkg.id}`

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: pkg.title,
    description: pkg.seoDescription || pkg.summary || pkg.description || undefined,
    image: pkg.image || undefined,
    url: canonicalUrl,
    offers: pkg.pricePerPerson ? {
      '@type': 'Offer',
      price: pkg.pricePerPerson,
      priceCurrency: 'ZAR',
      availability: pkg.packageStatus === 'published' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: canonicalUrl,
    } : undefined,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Packages', item: `${SITE_URL}/packages` },
      { '@type': 'ListItem', position: 3, name: pkg.title, item: canonicalUrl },
    ],
  }

  return (
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <PackageDetail pkg={pkg} id={params.id} />
    </>
  )
}

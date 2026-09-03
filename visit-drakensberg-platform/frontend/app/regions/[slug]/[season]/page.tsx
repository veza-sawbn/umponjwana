import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { getRegions, type Region } from '@/lib/regions'
import { getSeasonalContent } from '@/lib/modules'
import { SEASON_META, isSeason, type Season } from '@/lib/seasons'
import { publicSupabase } from '@/lib/supabase-public'
import SeasonTopicSection from '@/components/modules/SeasonTopicSection'
import JsonLd from '@/components/seo/JsonLd'

// New route — the page each tile in the region page's "When to Go" mosaic
// links to. Pure server component, same shape as every other converted
// detail route. See docs/destination-graph/PHASE_I.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// ISR — content here depends on Trail (Phase D tier: 1800s) and Activity
// (300s) data; 900s splits the difference rather than tracking the more
// volatile of the two exactly.
export const revalidate = 900

async function resolveRegion(slug: string): Promise<Region | null> {
  const regions = await getRegions(publicSupabase)
  return regions.find(r => r.slug === slug || r.id === slug) ?? null
}

const FALLBACK = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80'

export async function generateMetadata(
  { params }: { params: { slug: string; season: string } }
): Promise<Metadata> {
  if (!isSeason(params.season)) return { title: 'Season Not Found' }
  const region = await resolveRegion(params.slug)
  if (!region) return { title: 'Region Not Found' }

  const season = params.season
  const meta = SEASON_META[season]
  const title = `${region.name} in ${meta.label} | Visit Drakensberg`
  const description = `${meta.blurb} Things to do in ${region.name} during ${meta.label.toLowerCase()} (${meta.range}).`
  const canonical = `/regions/${region.slug}/${season}`

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      images: region.heroImage ? [{ url: region.heroImage }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function SeasonPage({ params }: { params: { slug: string; season: string } }) {
  if (!isSeason(params.season)) notFound()
  const season: Season = params.season

  const region = await resolveRegion(params.slug)
  if (!region) notFound()

  const groups = await getSeasonalContent(region.name, season, publicSupabase)
  const meta = SEASON_META[season]
  const heroImg = region.heroImage || FALLBACK
  const canonicalUrl = `${SITE_URL}/regions/${region.slug}/${season}`

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${region.name} in ${meta.label}`,
    description: meta.blurb,
    url: canonicalUrl,
    isPartOf: { '@type': 'TouristDestination', name: region.name, url: `${SITE_URL}/regions/${region.slug}` },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Regions', item: `${SITE_URL}/regions` },
      { '@type': 'ListItem', position: 3, name: region.name, item: `${SITE_URL}/regions/${region.slug}` },
      { '@type': 'ListItem', position: 4, name: meta.label, item: canonicalUrl },
    ],
  }

  return (
    <main className="bg-white">
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative h-[42vh] min-h-[320px] overflow-hidden">
        <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to top, rgba(${meta.tint},0.82) 0%, rgba(${meta.tint},0.28) 60%, rgba(${meta.tint},0.08) 100%)` }}
        />
        <div className="absolute inset-0 flex flex-col justify-end px-6 lg:px-12 pb-10">
          <div className="max-w-[1160px] mx-auto w-full">
            <nav className="flex items-center gap-2 font-sans text-[11px] text-white/60 mb-4">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <ChevronRight size={11} />
              <Link href="/regions" className="hover:text-white transition-colors">Regions</Link>
              <ChevronRight size={11} />
              <Link href={`/regions/${region.slug}`} className="hover:text-white transition-colors">{region.name}</Link>
              <ChevronRight size={11} />
              <span className="text-white/90">{meta.label}</span>
            </nav>
            <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-white/70 mb-2">{meta.range}</p>
            <h1 className="font-display italic text-4xl lg:text-6xl text-white leading-none mb-3">
              {region.name} in {meta.label}
            </h1>
            <p className="font-sans text-sm lg:text-base text-white/85 max-w-2xl leading-relaxed">{meta.blurb}</p>
          </div>
        </div>
      </section>

      {/* ── Topics ───────────────────────────────────────────────────────── */}
      {groups.length > 0 ? (
        <section className="max-w-[1160px] mx-auto px-6 lg:px-12 py-14 space-y-14">
          {groups.map(group => (
            <SeasonTopicSection key={group.topic} topic={group.topic} items={group.items} />
          ))}
        </section>
      ) : (
        <section className="max-w-[1160px] mx-auto px-6 lg:px-12 py-20 text-center">
          <p className="font-display italic text-2xl text-gray-300 mb-2">Nothing tagged for {meta.label.toLowerCase()} yet</p>
          <p className="font-sans text-sm text-gray-500 mb-6">
            Check back soon, or browse everything {region.name} has to offer.
          </p>
          <Link href={`/regions/${region.slug}`} className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">
            Back to {region.name}
          </Link>
        </section>
      )}

      {/* ── Other seasons ────────────────────────────────────────────────── */}
      <div className="bg-mist border-t border-gray-100 py-6">
        <div className="max-w-[1160px] mx-auto px-6 lg:px-12">
          <Link href={`/regions/${region.slug}`} className="font-sans text-sm text-gray-400 hover:text-[#2d6a4f] transition-colors">
            &larr; Back to {region.name}
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  )
}

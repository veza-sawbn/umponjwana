import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, ChevronRight, MapPin } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { getTowns, DEFAULT_TOWNS, type Town } from '@/lib/towns'
import { getRegions, DEFAULT_REGIONS } from '@/lib/regions'
import { publicSupabase } from '@/lib/supabase-public'

// New route — same rationale as app/nature-reserves/[slug]/page.tsx: Town
// already had slug + seoTitle + seoDescription with admin CRUD, but no
// detail page. Pure server component — no client-side data needed. See
// docs/seo-audit/SEO_GAPS.md G4 and docs/destination-graph/PHASE_B.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

async function resolveTown(slug: string): Promise<{ town: Town; regionName: string; regionSlug: string } | null> {
  // getTowns() throws on a Supabase query error (unlike getRegions(), which
  // catches internally) — fall back to the same DEFAULT_TOWNS the rest of
  // the site uses on a read failure, rather than 500ing or 404ing a town
  // that genuinely exists.
  const [towns, regions] = await Promise.all([
    getTowns(publicSupabase).catch(() => DEFAULT_TOWNS),
    getRegions(publicSupabase).catch(() => DEFAULT_REGIONS),
  ])
  const town = towns.find(t => t.slug === slug || t.id === slug)
  if (!town) return null
  const region = regions.find(r => r.slug === town.regionSlug)
  return { town, regionName: region?.name ?? '', regionSlug: town.regionSlug }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const resolved = await resolveTown(params.slug)
  if (!resolved) return { title: 'Town Not Found' }
  const { town } = resolved

  const title = town.seoTitle || `${town.name} | Visit Drakensberg`
  const description = town.seoDescription || town.description || town.gateway || undefined
  const canonical = `/towns/${town.slug}`

  return {
    // `title` already includes " | Visit Drakensberg" — use `absolute` so
    // the root layout's title template doesn't double the suffix (this is
    // the bug that motivated the fix — /towns has no intermediate
    // layout.tsx, which changes how Next resolves the template chain).
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      images: town.image ? [{ url: town.image }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function TownPage({ params }: { params: { slug: string } }) {
  const resolved = await resolveTown(params.slug)
  if (!resolved) notFound()
  const { town, regionName, regionSlug } = resolved

  const canonicalUrl = `${SITE_URL}/towns/${town.slug}`

  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: town.name,
    description: town.seoDescription || town.description || undefined,
    url: canonicalUrl,
    image: town.image || undefined,
    containedInPlace: regionName ? { '@type': 'Place', name: regionName } : undefined,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Towns & Villages', item: `${SITE_URL}/towns` },
      { '@type': 'ListItem', position: 3, name: town.name, item: canonicalUrl },
    ],
  }

  return (
    <main className="bg-mist min-h-screen pt-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="px-6 lg:px-12 pt-8">
        <nav className="flex items-center gap-2 font-sans text-[11px] text-forest/40 max-w-[1440px] mx-auto">
          <Link href="/" className="hover:text-forest transition-colors">Home</Link>
          <ChevronRight size={12} />
          <Link href="/towns" className="hover:text-forest transition-colors">Towns & Villages</Link>
          <ChevronRight size={12} />
          <span className="text-forest/70">{town.name}</span>
        </nav>
      </div>

      <section className="py-10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-[2fr_1fr] gap-12 items-start">
            <div>
              {town.image && (
                <div className="aspect-[16/9] overflow-hidden bg-forest/10 mb-8">
                  <img src={town.image} alt={town.name} className="w-full h-full object-cover" />
                </div>
              )}
              {town.gateway && <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-2">{town.gateway}</p>}
              <h1 className="font-display text-4xl lg:text-5xl text-forest mb-4 flex items-center gap-3">
                <MapPin className="w-8 h-8 text-forest/30" /> {town.name}
              </h1>
              {town.description && (
                <p className="font-sans text-base text-forest/70 leading-relaxed mb-8">{town.description}</p>
              )}
              {town.highlights.length > 0 && (
                <div>
                  <p className="font-sans text-xs tracking-[0.15em] uppercase text-forest/30 mb-3">Highlights</p>
                  <ul className="space-y-2">
                    {town.highlights.map(h => (
                      <li key={h} className="flex items-center gap-3 font-sans text-sm text-forest/70">
                        <span className="w-1 h-1 rounded-full bg-gold shrink-0" /> {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-5">
              {regionName && (
                <div className="bg-white p-5 border border-forest/10">
                  <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 mb-1">Region</p>
                  <Link href={`/regions/${regionSlug}`} className="font-display italic text-2xl text-forest hover:text-sage transition-colors">
                    {regionName}
                  </Link>
                </div>
              )}
              <div className="flex flex-col gap-3">
                {regionName && (
                  <Link
                    href={`/stays?region=${encodeURIComponent(regionName)}`}
                    className="font-sans text-sm px-5 py-3 bg-forest text-white hover:bg-sage transition-colors inline-flex items-center justify-center gap-2"
                  >
                    Stays near {town.name} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
                {regionName && (
                  <Link
                    href={`/hikes?region=${encodeURIComponent(regionName)}`}
                    className="font-sans text-sm px-5 py-3 border border-forest text-forest hover:bg-forest hover:text-white transition-colors text-center"
                  >
                    Nearby Hikes
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-white border-t border-gray-100 py-6">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <Link href="/towns" className="font-sans text-sm text-gray-400 hover:text-forest transition-colors">
            ← Back to all towns
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  )
}

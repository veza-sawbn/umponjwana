import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Info, Mountain, ShieldCheck, Sunrise } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { getReserves, DEFAULT_RESERVES, type Reserve } from '@/lib/reserves'
import { getRegions, DEFAULT_REGIONS } from '@/lib/regions'
import { publicSupabase } from '@/lib/supabase-public'
import { getNearbyTrails, getNearbyStays } from '@/lib/modules'
import RelatedTrailsModule from '@/components/modules/RelatedTrailsModule'
import NearbyStaysModule from '@/components/modules/NearbyStaysModule'

// New route — Reserve already had slug + seoTitle + seoDescription + rich
// content (peaks, permits, best time, facilities) with admin CRUD, but no
// detail page to render on (see docs/seo-audit/SEO_GAPS.md G4, the
// highest-value/lowest-risk gap found in the audit). Pure server component:
// every field needed is already resolved by the time this renders, so there
// is no client-side data fetch and no hydration boundary — unlike the
// region page, this doesn't need a client island. See
// docs/destination-graph/PHASE_B.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// ISR — reserve content (description, peaks, permits) is admin-edited and
// changes rarely. See docs/destination-graph/PHASE_D.md.
export const revalidate = 3600

const DIFF_COLOR: Record<string, string> = {
  accessible: '#4A7251',
  moderate: '#C9A96E',
  expert: '#c0392b',
}

async function resolveReserve(slug: string): Promise<{ reserve: Reserve; regionName: string; regionSlug: string } | null> {
  // getReserves() throws on a Supabase query error (unlike getRegions(),
  // which catches internally) — fall back to the same DEFAULT_RESERVES the
  // rest of the site uses on a read failure, rather than 500ing or 404ing a
  // reserve that genuinely exists.
  const [reserves, regions] = await Promise.all([
    getReserves(publicSupabase).catch(() => DEFAULT_RESERVES),
    getRegions(publicSupabase).catch(() => DEFAULT_REGIONS),
  ])
  const reserve = reserves.find(r => r.slug === slug || r.id === slug)
  if (!reserve) return null
  const region = regions.find(r => r.slug === reserve.regionSlug)
  return { reserve, regionName: region?.name ?? '', regionSlug: reserve.regionSlug }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const resolved = await resolveReserve(params.slug)
  if (!resolved) return { title: 'Reserve Not Found' }
  const { reserve } = resolved

  const title = reserve.seoTitle || `${reserve.name} | Visit Drakensberg`
  const description = reserve.seoDescription || reserve.description || reserve.tagline || undefined
  const canonical = `/nature-reserves/${reserve.slug}`

  return {
    // `title` already includes " | Visit Drakensberg" — use `absolute` to
    // avoid the root layout's title template doubling the suffix (observed
    // on /towns/[slug], which has no intermediate layout.tsx — see PHASE_B.md).
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      images: reserve.image ? [{ url: reserve.image }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function ReservePage({ params }: { params: { slug: string } }) {
  const resolved = await resolveReserve(params.slug)
  if (!resolved) notFound()
  const { reserve, regionName, regionSlug } = resolved

  // Automatic-mode module content (see lib/modules.ts) — region-matched,
  // server-rendered so the links are crawlable, unlike the client-only
  // SmartRecommendations sidebar on the stay booking page.
  const [nearbyTrails, nearbyStays] = regionName
    ? await Promise.all([
        getNearbyTrails(regionName, { limit: 4 }, publicSupabase),
        getNearbyStays(regionName, { limit: 4 }, publicSupabase),
      ])
    : [[], []]

  const canonicalUrl = `${SITE_URL}/nature-reserves/${reserve.slug}`

  const attractionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: reserve.name,
    description: reserve.seoDescription || reserve.description || undefined,
    url: canonicalUrl,
    image: reserve.image || undefined,
    containedInPlace: regionName ? { '@type': 'Place', name: regionName } : undefined,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Nature Reserves', item: `${SITE_URL}/nature-reserves` },
      { '@type': 'ListItem', position: 3, name: reserve.name, item: canonicalUrl },
    ],
  }

  return (
    <main className="bg-mist">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(attractionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative h-[60vh] min-h-[420px] overflow-hidden">
        {reserve.image ? (
          <img src={reserve.image} alt={reserve.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-forest/20 flex items-center justify-center">
            <Mountain className="w-16 h-16 text-forest/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />

        <div className="absolute top-20 left-0 right-0 px-6 lg:px-12">
          <nav className="flex items-center gap-2 font-sans text-[11px] text-white/50 max-w-[1440px] mx-auto">
            <Link href="/" className="hover:text-white/80 transition-colors">Home</Link>
            <ChevronRight size={12} />
            <Link href="/nature-reserves" className="hover:text-white/80 transition-colors">Nature Reserves</Link>
            <ChevronRight size={12} />
            <span className="text-white/80">{reserve.name}</span>
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-6 lg:px-12 pb-12 max-w-[1440px] mx-auto">
          <p className="font-sans text-[11px] tracking-[0.22em] uppercase text-[#C9A96E] mb-3">Nature Reserve</p>
          <h1 className="font-display italic text-5xl lg:text-7xl text-white leading-none mb-3">{reserve.name}</h1>
          {reserve.tagline && <p className="font-sans text-base text-white/60 max-w-lg">{reserve.tagline}</p>}
        </div>
      </section>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <section className="bg-white py-14">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-[2fr_1fr] gap-12 items-start">
            <div>
              {reserve.description && (
                <p className="font-sans text-base text-forest/70 leading-relaxed mb-10">{reserve.description}</p>
              )}

              {reserve.peaks.length > 0 && (
                <div className="mb-10">
                  <p className="font-sans text-xs tracking-[0.2em] uppercase text-[#C9A96E] mb-3">Key Peaks</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {reserve.peaks.map(peak => (
                      <div key={peak.id} className="border border-forest/10 px-3 py-2.5 bg-mist/50">
                        <p className="font-sans text-sm font-medium text-forest leading-tight">{peak.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-sans text-xs text-gold">{peak.elevation.toLocaleString()} m</span>
                          <span className="font-sans text-[10px] uppercase tracking-wide" style={{ color: DIFF_COLOR[peak.difficulty] }}>
                            {peak.difficulty}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {reserve.bestTime && (
                  <div className="flex gap-3">
                    <Sunrise className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                    <div>
                      <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/30 mb-0.5">Best Time to Visit</p>
                      <p className="font-sans text-sm text-forest/70 leading-relaxed">{reserve.bestTime}</p>
                    </div>
                  </div>
                )}
                {reserve.permits && (
                  <div className="flex gap-3">
                    <ShieldCheck className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                    <div>
                      <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/30 mb-0.5">Permits & Fees</p>
                      <p className="font-sans text-sm text-forest/70 leading-relaxed">{reserve.permits}</p>
                    </div>
                  </div>
                )}
                {reserve.facilities.length > 0 && (
                  <div className="flex gap-3">
                    <Info className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                    <div>
                      <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/30 mb-1.5">Facilities</p>
                      <div className="flex flex-wrap gap-2">
                        {reserve.facilities.map(f => (
                          <span key={f} className="font-sans text-xs text-forest/70 border border-forest/10 px-2.5 py-1 bg-mist/50">{f}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick facts + CTAs */}
            <div className="space-y-5">
              {regionName && (
                <div className="bg-mist p-5">
                  <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 mb-1">Region</p>
                  <Link href={`/regions/${regionSlug}`} className="font-display italic text-2xl text-forest hover:text-sage transition-colors">
                    {regionName}
                  </Link>
                </div>
              )}
              {reserve.viewpointName && (
                <div className="bg-mist p-5">
                  <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 mb-1">Signature Viewpoint</p>
                  <p className="font-sans text-sm text-forest/70">{reserve.viewpointName}</p>
                </div>
              )}
              <div className="flex flex-col gap-3">
                {regionName && (
                  <Link
                    href={`/hikes?region=${encodeURIComponent(regionName)}`}
                    className="font-sans text-sm px-5 py-3 bg-forest text-white hover:bg-sage transition-colors inline-flex items-center justify-center gap-2"
                  >
                    View Hikes <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
                {regionName && (
                  <Link
                    href={`/stays?region=${encodeURIComponent(regionName)}`}
                    className="font-sans text-sm px-5 py-3 border border-forest text-forest hover:bg-forest hover:text-white transition-colors text-center"
                  >
                    Browse Stays Nearby
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {(nearbyTrails.length > 0 || nearbyStays.length > 0) && (
        <section className="bg-mist py-14">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-12 space-y-12">
            <RelatedTrailsModule trails={nearbyTrails} viewAllHref={`/hikes?region=${encodeURIComponent(regionName)}`} />
            <NearbyStaysModule stays={nearbyStays} viewAllHref={`/stays?region=${encodeURIComponent(regionName)}`} />
          </div>
        </section>
      )}

      <div className="bg-white border-t border-gray-100 py-6">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <Link href="/nature-reserves" className="font-sans text-sm text-gray-400 hover:text-forest transition-colors">
            ← Back to all nature reserves
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  )
}

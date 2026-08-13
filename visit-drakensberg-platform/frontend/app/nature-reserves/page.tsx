'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Info, ShieldCheck, Sunrise, Mountain } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import EditablePageHeader from '@/components/editor/EditablePageHeader'
import { getReserves, DEFAULT_RESERVES, type Reserve } from '@/lib/reserves'
import { getRegions, DEFAULT_REGIONS, type Region } from '@/lib/regions'

const DIFF_COLOR: Record<string, string> = {
  accessible: '#4A7251',
  moderate: '#C9A96E',
  expert: '#c0392b',
}

export default function NatureReservesPage() {
  const [reserves, setReserves] = useState<Reserve[]>(DEFAULT_RESERVES)
  const [regions, setRegions] = useState<Region[]>(DEFAULT_REGIONS)
  const [activeRegion, setActiveRegion] = useState<string>('all')

  useEffect(() => {
    getReserves().then(setReserves).catch(() => {})
    getRegions().then(setRegions).catch(() => {})
  }, [])

  const regionName = (slug: string) => regions.find(r => r.slug === slug)?.name ?? ''

  // Only regions that actually have reserves get a filter tab.
  const regionsWithReserves = useMemo(() => {
    const slugs = new Set(reserves.map(r => r.regionSlug).filter(Boolean))
    return regions.filter(r => slugs.has(r.slug))
  }, [reserves, regions])

  const visible = activeRegion === 'all' ? reserves : reserves.filter(r => r.regionSlug === activeRegion)

  return (
    <main className="bg-mist min-h-screen pt-16">

      {/* Hero */}
      <EditablePageHeader section="reserves_page" subClassName="max-w-2xl" />

      {/* Region filter */}
      <div className="sticky top-16 z-40 bg-white border-b border-black/8">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="flex gap-1 overflow-x-auto py-2">
            <button
              onClick={() => setActiveRegion('all')}
              className={`shrink-0 font-sans text-sm px-5 py-2.5 transition-colors whitespace-nowrap ${activeRegion === 'all' ? 'bg-forest text-white' : 'text-forest/60 hover:text-forest hover:bg-forest/5'}`}
            >
              All Reserves
            </button>
            {regionsWithReserves.map(r => (
              <button
                key={r.slug}
                onClick={() => setActiveRegion(r.slug)}
                className={`shrink-0 font-sans text-sm px-5 py-2.5 transition-colors whitespace-nowrap ${activeRegion === r.slug ? 'bg-forest text-white' : 'text-forest/60 hover:text-forest hover:bg-forest/5'}`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reserves */}
      {visible.length === 0 ? (
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-24 text-center">
          <p className="font-sans text-sm text-forest/40">No reserves in this region yet.</p>
        </div>
      ) : (
        visible.map((reserve, i) => (
          <section key={reserve.id} id={reserve.slug} className={`py-20 ${i % 2 === 0 ? 'bg-white' : 'bg-mist'}`}>
            <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
              <div className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${i % 2 === 1 ? 'lg:[direction:rtl]' : ''}`}>
                {/* Image */}
                <div className="relative [direction:ltr]">
                  <div className="aspect-[4/3] overflow-hidden bg-forest/10">
                    {reserve.image
                      ? <img src={reserve.image} alt={reserve.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Mountain className="w-10 h-10 text-forest/20" /></div>}
                  </div>
                </div>

                {/* Content */}
                <div className="[direction:ltr]">
                  {reserve.regionSlug && (
                    <Link href={`/regions#${reserve.regionSlug}`} className="inline-block font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-3 hover:text-forest transition-colors">
                      {regionName(reserve.regionSlug) || 'Drakensberg'}
                    </Link>
                  )}
                  <Link href={`/nature-reserves/${reserve.slug}`} className="group/title">
                    <h2 className="font-display text-4xl lg:text-5xl text-forest mb-2 group-hover/title:text-sage transition-colors">{reserve.name}</h2>
                  </Link>
                  {reserve.tagline && <p className="font-sans text-sm text-forest/50 mb-6">{reserve.tagline}</p>}
                  {reserve.description && <p className="font-sans text-base text-forest/60 leading-relaxed mb-8">{reserve.description}</p>}

                  {/* Peaks */}
                  {reserve.peaks.length > 0 && (
                    <div className="mb-8">
                      <p className="font-sans text-xs tracking-[0.15em] uppercase text-forest/30 mb-3">Key Peaks</p>
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

                  {/* Info: best time / permits / facilities */}
                  <div className="space-y-3 mb-8">
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

                  {/* CTAs — stay bound to live data by region */}
                  <div className="flex flex-wrap gap-4">
                    <Link href={`/nature-reserves/${reserve.slug}`} className="font-sans text-sm px-5 py-2.5 bg-gold text-forest hover:bg-[#b8935e] transition-colors inline-flex items-center gap-2">
                      Full Reserve Guide <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    {reserve.regionSlug && (
                      <Link href={`/hikes?region=${encodeURIComponent(regionName(reserve.regionSlug))}`} className="font-sans text-sm px-5 py-2.5 bg-forest text-white hover:bg-sage transition-colors inline-flex items-center gap-2">
                        View Hikes <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                    {reserve.regionSlug && (
                      <Link href={`/stays?region=${encodeURIComponent(regionName(reserve.regionSlug))}`} className="font-sans text-sm px-5 py-2.5 border border-forest text-forest hover:bg-forest hover:text-white transition-colors">
                        Browse Stays
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))
      )}

      <Footer />
    </main>
  )
}

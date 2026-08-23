'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import EditablePageHeader from '@/components/editor/EditablePageHeader'
import { getTowns, DEFAULT_TOWNS, type Town } from '@/lib/towns'
import { getRegions, DEFAULT_REGIONS, type Region } from '@/lib/regions'

export default function TownsPage() {
  const [towns, setTowns] = useState<Town[]>(DEFAULT_TOWNS)
  const [regions, setRegions] = useState<Region[]>(DEFAULT_REGIONS)

  useEffect(() => {
    getTowns().then(setTowns).catch(() => {})
    getRegions().then(setRegions).catch(() => {})
  }, [])

  const regionName = (slug: string) => regions.find(r => r.slug === slug)?.name ?? ''

  // Group towns by region, in region order, with any unassigned towns last.
  const grouped = useMemo(() => {
    const groups: { slug: string; name: string; towns: Town[] }[] = []
    for (const region of regions) {
      const inRegion = towns.filter(t => t.regionSlug === region.slug)
      if (inRegion.length) groups.push({ slug: region.slug, name: region.name, towns: inRegion })
    }
    const unassigned = towns.filter(t => !t.regionSlug || !regions.some(r => r.slug === t.regionSlug))
    if (unassigned.length) groups.push({ slug: '', name: 'Elsewhere in the Berg', towns: unassigned })
    return groups
  }, [towns, regions])

  return (
    <main className="bg-mist min-h-screen pt-16">
      <EditablePageHeader section="towns_page" subClassName="max-w-2xl" />

      {grouped.length === 0 ? (
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-24 text-center">
          <p className="font-sans text-sm text-forest/40">No towns listed yet.</p>
        </div>
      ) : (
        grouped.map((group, gi) => (
          <section key={group.slug || 'unassigned'} className={`py-16 ${gi % 2 === 0 ? 'bg-white' : 'bg-mist'}`}>
            <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-2">Region</p>
                  <h2 className="font-display text-3xl lg:text-4xl text-forest">{group.name}</h2>
                </div>
                {group.slug && (
                  <Link href={`/regions#${group.slug}`} className="hidden sm:inline-flex items-center gap-2 font-sans text-sm text-forest/50 hover:text-forest transition-colors">
                    Explore region <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.towns.map(town => (
                  <div key={town.id} className="group border border-forest/10 bg-mist/40 hover:border-gold/40 transition-colors overflow-hidden">
                    <Link href={`/towns/${town.slug}`}>
                      {town.image && (
                        <div className="aspect-[16/9] overflow-hidden bg-forest/10">
                          <img src={town.image} alt={town.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        </div>
                      )}
                    </Link>
                    <div className="p-5">
                      {town.gateway && <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-2">{town.gateway}</p>}
                      <Link href={`/towns/${town.slug}`}>
                        <h3 className="font-display text-xl text-forest mb-2 flex items-center gap-2 group-hover:text-sage transition-colors">
                          <MapPin className="w-4 h-4 text-forest/30" /> {town.name}
                        </h3>
                      </Link>
                      {town.description && <p className="font-sans text-sm text-forest/55 leading-relaxed">{town.description}</p>}
                      {town.highlights.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {town.highlights.map(h => (
                            <li key={h} className="flex items-center gap-2 font-sans text-xs text-forest/60">
                              <span className="w-1 h-1 rounded-full bg-gold shrink-0" /> {h}
                            </li>
                          ))}
                        </ul>
                      )}
                      {town.regionSlug && (
                        <Link href={`/stays?region=${encodeURIComponent(regionName(town.regionSlug))}`} className="inline-flex items-center gap-1.5 mt-4 font-sans text-xs text-forest hover:text-gold transition-colors">
                          Stays near {town.name} <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))
      )}

      <Footer />
    </main>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import Editable from '@/components/editor/Editable'
import { useSiteSection } from '@/lib/use-site-section'
import { DEFAULT_REGIONS, getRegions, type Region } from '@/lib/regions'

const TOWNS = [
  { name: 'Bergville', region: 'North Berg gateway', desc: 'Main service town for the Northern Berg. Close to Royal Natal National Park and the Amphitheatre.' },
  { name: 'Winterton', region: 'Central Berg gateway', desc: 'Gateway to Cathedral Peak and the Drakensberg resort strip. Home to the Drakensberg Boys Choir.' },
  { name: 'Estcourt', region: 'Central Berg', desc: 'Larger regional centre with good access to Giants Castle Game Reserve.' },
  { name: 'Underberg', region: 'South Berg gateway', desc: 'The main town for southern Drakensberg, sitting at the foot of Sani Pass. Practical and unpretentious.' },
  { name: 'Himeville', region: 'South Berg — boutique', desc: 'A charming village with a restored fort, trout streams and boutique accommodation. A hidden gem.' },
  { name: 'Nottingham Road', region: 'Midlands', desc: 'Boutique village on the Midlands Meander. Known for craft beer, cheese, art studios and farm stays on the way to the Berg.' },
  { name: 'Champagne Valley', region: 'Central Berg', desc: 'A scenic valley resort corridor with a dense cluster of lodges, spas and adventure operators.' },
]

function regionImage(region: Region, index: number) {
  return region.heroImage || DEFAULT_REGIONS[index % DEFAULT_REGIONS.length]?.heroImage || DEFAULT_REGIONS[0].heroImage
}

export default function RegionsPage() {
  const [regions, setRegions] = useState<Region[]>(DEFAULT_REGIONS)
  const c = useSiteSection('regions_page')

  useEffect(() => {
    getRegions().then(setRegions)
  }, [])

  return (
    <main className="bg-mist pt-16">
      <section className="bg-forest text-white py-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <Editable section="regions_page" fieldKey="eyebrow" value={c.eyebrow} label="Eyebrow" type="text">
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-4">{c.eyebrow}</p>
          </Editable>
          <Editable section="regions_page" fieldKey="heading" value={c.heading} label="Heading" type="text">
            <h1 className="font-display text-5xl lg:text-7xl text-white leading-none mb-6">{c.heading}</h1>
          </Editable>
          <Editable section="regions_page" fieldKey="subheading" value={c.subheading} label="Subheading" type="textarea">
            <p className="font-sans text-base text-white/50 max-w-xl leading-relaxed">{c.subheading}</p>
          </Editable>
        </div>
      </section>

      {regions.map((r, i) => (
        <section key={r.id} id={r.slug} className={`py-20 ${i % 2 === 0 ? 'bg-white' : 'bg-mist'}`}>
          <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
            <div className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${i % 2 === 1 ? 'lg:[direction:rtl]' : ''}`}>
              <div className="relative [direction:ltr]">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={regionImage(r, i)} alt={r.name} className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="[direction:ltr]">
                <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-3">{r.tagline || 'Drakensberg region'}</p>
                <h2 className="font-display text-4xl lg:text-5xl text-forest mb-6">{r.name}</h2>
                <p className="font-sans text-base text-forest/60 leading-relaxed mb-8">{r.overview || r.seoDescription}</p>
                {r.highlights.length > 0 && <div className="mb-8"><p className="font-sans text-xs tracking-[0.15em] uppercase text-forest/30 mb-3">Highlights</p><ul className="space-y-2">{r.highlights.map((h) => <li key={h} className="flex items-center gap-3 font-sans text-sm text-forest/70"><span className="w-1 h-1 rounded-full bg-gold" />{h}</li>)}</ul></div>}
                {r.subregions && r.subregions.length > 0 && <div className="mb-8"><p className="font-sans text-xs tracking-[0.15em] uppercase text-forest/30 mb-3">Subregions</p><div className="grid grid-cols-2 gap-2">{r.subregions.map(s => <div key={s.id} className="border border-forest/10 px-4 py-3 bg-mist/50"><p className="font-sans text-sm font-medium text-forest">{s.name}</p>{s.description && <p className="font-sans text-xs text-forest/50 mt-0.5 leading-relaxed">{s.description}</p>}</div>)}</div></div>}
                <div className="flex gap-4">
                  <Link href={`/stays?region=${encodeURIComponent(r.name)}`} className="font-sans text-sm px-5 py-2.5 bg-forest text-white hover:bg-sage transition-colors">Browse Stays</Link>
                  <Link href={`/hikes?region=${encodeURIComponent(r.name)}`} className="font-sans text-sm px-5 py-2.5 border border-forest text-forest hover:bg-forest hover:text-white transition-colors inline-flex items-center gap-2">View Hikes <ArrowRight className="w-3.5 h-3.5" /></Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      <section className="bg-forest py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="mb-10">
            <Editable section="regions_page" fieldKey="towns_eyebrow" value={c.towns_eyebrow} label="Towns Eyebrow" type="text">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-3">{c.towns_eyebrow}</p>
            </Editable>
            <Editable section="regions_page" fieldKey="towns_heading" value={c.towns_heading} label="Towns Heading" type="text">
              <h2 className="font-display text-4xl text-white">{c.towns_heading}</h2>
            </Editable>
            <Editable section="regions_page" fieldKey="towns_subheading" value={c.towns_subheading} label="Towns Subheading" type="textarea">
              <p className="font-sans text-sm text-white/50 mt-3 max-w-xl">{c.towns_subheading}</p>
            </Editable>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{TOWNS.map(t => <div key={t.name} className="border border-white/10 p-5 hover:border-gold/40 transition-colors"><p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-2">{t.region}</p><h3 className="font-display text-xl text-white mb-2">{t.name}</h3><p className="font-sans text-sm text-white/50 leading-relaxed">{t.desc}</p></div>)}</div>
        </div>
      </section>
      <Footer />
    </main>
  )
}

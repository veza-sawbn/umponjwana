'use client'
import Link from 'next/link'
import { ArrowRight, Sun, Cloud, Snowflake, Leaf } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import Editable from '@/components/editor/Editable'
import { useSiteSection } from '@/lib/use-site-section'

const SEASONS = [
  {
    name: 'Summer',
    months: 'Nov — Feb',
    icon: Sun,
    temp: '18–28°C',
    summary: 'Peak season. Lush green landscapes, wildflowers, and afternoon thunderstorms. Waterfalls at their fullest.',
    pros: ['Wildflowers', 'Full waterfalls', 'Long days'],
    cons: ['Afternoon storms', 'Busiest period', 'Higher rates'],
    color: '#C9A96E',
  },
  {
    name: 'Autumn',
    months: 'Mar — May',
    icon: Leaf,
    temp: '10–22°C',
    summary: 'Ideal hiking weather. Clear skies, golden grass, and quieter trails. The best time to visit.',
    pros: ['Best weather', 'Fewer crowds', 'Clear views'],
    cons: ['Shorter days', 'Evenings cool quickly'],
    color: '#4A7251',
    recommended: true,
  },
  {
    name: 'Winter',
    months: 'Jun — Aug',
    icon: Snowflake,
    temp: '-5–18°C',
    summary: 'Dry, crystal clear and cold. Snow on the high peaks. Fantastic photography conditions.',
    pros: ['Snow & ice', 'Crystal clarity', 'Cheapest rates'],
    cons: ['Freezing nights', 'Some passes closed', 'Short days'],
    color: '#4A90D9',
  },
  {
    name: 'Spring',
    months: 'Sep — Oct',
    icon: Cloud,
    temp: '12–24°C',
    summary: 'Grasses green up after winter burns. Newborn lambs and foals. Excellent game viewing.',
    pros: ['Game viewing', 'Greening landscape', 'Shoulder rates'],
    cons: ['Some trail burns', 'Variable weather'],
    color: '#5fa37a',
  },
]

const TRIP_TYPES = [
  {
    title: '3-Day Weekend',
    label: 'Quick escape',
    desc: 'A long weekend is enough for a single region — stay at Champagne Valley, do the Monk\'s Cowl trail, and see rock art at Injasuti.',
    itinerary: ['Day 1: Arrive, settle in, afternoon walk', 'Day 2: Full day hike — Monk\'s Cowl or Cathedral Ridge', 'Day 3: Rock art & leisurely return'],
    href: '/stays?duration=3',
  },
  {
    title: '7-Day Classic',
    label: 'Full experience',
    desc: 'A week lets you cover two regions and include a Sani Pass day-trip. The standard Drakensberg holiday.',
    itinerary: ['Day 1–3: Northern Berg — Amphitheatre, Tugela Falls', 'Day 4: Transfer to Central Berg', 'Day 5–6: Cathedral Peak, Giants Castle', 'Day 7: Sani Pass day trip, depart'],
    href: '/packages?duration=7',
  },
  {
    title: '14-Day Deep Dive',
    label: 'Grand traverse',
    desc: 'For serious hikers: cover the full escarpment from north to south, including the 5-day Grand Traverse route.',
    itinerary: ['Day 1–2: Acclimatise, Royal Natal', 'Day 3–7: Grand Traverse (Sentinel to Garden Castle)', 'Day 8–10: Central Berg & rock art', 'Day 11–14: Southern Berg, Sani Pass, rest'],
    href: '/packages?duration=14',
  },
]

export default function PlanContent() {
  const c = useSiteSection('plan_page') as unknown as Record<string, string>
  const essentials = [1, 2, 3, 4].map(i => ({
    titleKey: `essential_${i}_title`,
    bodyKey: `essential_${i}_body`,
    title: c[`essential_${i}_title`],
    body: c[`essential_${i}_body`],
  }))

  return (
    <main className="bg-mist pt-16">
      {/* Header */}
      <section className="bg-forest text-white py-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto grid lg:grid-cols-2 gap-10 items-end">
          <div>
            <Editable section="plan_page" fieldKey="eyebrow" value={c.eyebrow} label="Eyebrow" type="text">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-4">{c.eyebrow}</p>
            </Editable>
            <Editable section="plan_page" fieldKey="heading" value={c.heading} label="Heading" type="textarea">
              <h1 className="font-display text-5xl lg:text-7xl text-white leading-none" style={{ whiteSpace: 'pre-line' }}>
                {c.heading}
              </h1>
            </Editable>
          </div>
          <Editable section="plan_page" fieldKey="subheading" value={c.subheading} label="Subheading" type="textarea">
            <p className="font-sans text-base text-white/50 leading-relaxed">
              {c.subheading}
            </p>
          </Editable>
        </div>
      </section>

      {/* Seasons */}
      <section className="py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="mb-10">
            <Editable section="plan_page" fieldKey="seasons_eyebrow" value={c.seasons_eyebrow} label="Seasons Eyebrow" type="text">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">{c.seasons_eyebrow}</p>
            </Editable>
            <Editable section="plan_page" fieldKey="seasons_heading" value={c.seasons_heading} label="Seasons Heading" type="text">
              <h2 className="font-display text-4xl text-forest">{c.seasons_heading}</h2>
            </Editable>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SEASONS.map((s) => {
              const Icon = s.icon
              return (
                <div
                  key={s.name}
                  className={`bg-white p-7 relative ${s.recommended ? 'ring-1 ring-gold' : ''}`}
                >
                  {s.recommended && (
                    <span className="absolute -top-3 left-6 font-sans text-[10px] tracking-[0.15em] uppercase bg-gold text-forest px-3 py-1">
                      Recommended
                    </span>
                  )}
                  <Icon className="w-5 h-5 mb-4" style={{ color: s.color }} />
                  <p className="font-display text-xl text-forest mb-1">{s.name}</p>
                  <p className="font-sans text-xs text-forest/35 mb-1">{s.months}</p>
                  <p className="font-sans text-xs text-forest/35 mb-4">{s.temp}</p>
                  <p className="font-sans text-sm text-forest/60 leading-relaxed mb-5">{s.summary}</p>
                  <div className="space-y-1.5">
                    {s.pros.map((p) => (
                      <p key={p} className="font-sans text-xs text-sage flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-sage" />{p}
                      </p>
                    ))}
                    {s.cons.map((con) => (
                      <p key={con} className="font-sans text-xs text-forest/35 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-forest/20" />{con}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Trip types */}
      <section className="bg-white py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="mb-10">
            <Editable section="plan_page" fieldKey="itineraries_eyebrow" value={c.itineraries_eyebrow} label="Itineraries Eyebrow" type="text">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">{c.itineraries_eyebrow}</p>
            </Editable>
            <Editable section="plan_page" fieldKey="itineraries_heading" value={c.itineraries_heading} label="Itineraries Heading" type="text">
              <h2 className="font-display text-4xl text-forest">{c.itineraries_heading}</h2>
            </Editable>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {TRIP_TYPES.map((t) => (
              <div key={t.title} className="border border-black/8 p-8">
                <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-2">{t.label}</p>
                <h3 className="font-display text-2xl text-forest mb-4">{t.title}</h3>
                <p className="font-sans text-sm text-forest/55 leading-relaxed mb-6">{t.desc}</p>
                <div className="h-px bg-black/6 mb-6" />
                <ul className="space-y-3 mb-8">
                  {t.itinerary.map((item, i) => (
                    <li key={i} className="flex gap-3 font-sans text-xs text-forest/60">
                      <span className="text-gold shrink-0 mt-0.5">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={t.href} className="font-sans text-sm text-forest inline-flex items-center gap-2 hover:text-gold transition-colors">
                  Browse options <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Essentials */}
      <section className="py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="mb-10">
            <Editable section="plan_page" fieldKey="essentials_eyebrow" value={c.essentials_eyebrow} label="Essentials Eyebrow" type="text">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">{c.essentials_eyebrow}</p>
            </Editable>
            <Editable section="plan_page" fieldKey="essentials_heading" value={c.essentials_heading} label="Essentials Heading" type="text">
              <h2 className="font-display text-4xl text-forest">{c.essentials_heading}</h2>
            </Editable>
          </div>

          <div className="grid sm:grid-cols-2 gap-0 border border-black/8">
            {essentials.map((e, i) => (
              <div key={e.titleKey} className={`p-8 ${i < 2 ? 'border-b border-black/8' : ''} ${i % 2 === 0 ? 'sm:border-r sm:border-black/8' : ''}`}>
                <Editable section="plan_page" fieldKey={e.titleKey} value={e.title} label={`Essential ${i + 1} Title`} type="text">
                  <h3 className="font-display text-xl text-forest mb-3">{e.title}</h3>
                </Editable>
                <Editable section="plan_page" fieldKey={e.bodyKey} value={e.body} label={`Essential ${i + 1} Body`} type="textarea">
                  <p className="font-sans text-sm text-forest/55 leading-relaxed">{e.body}</p>
                </Editable>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

'use client'
import { useId } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import SafeImage from '@/components/ui/SafeImage'
import { DESTINATION_GRAPH_NAV } from '@/lib/destination-ia'
import type { HomeCard } from '@/lib/site-content'

/* ─── Top destinations ──────────────────────────────────────────────────────
   Exactly the three Drakensberg regions, in north → south order.

   - Image, subtitle and description come from the CMS region cards
     (site_content.home_cards.regions) — the same admin-approved content the
     homepage "Choose your Berg" section renders.
   - The link is the region's canonical page from the primary navigation
     (lib/destination-ia.ts, e.g. /regions/northern-drakensberg). The CMS
     cards' own href points at a /regions#fragment that matches no anchor on
     that page, so it is used only if the nav entry is ever missing.
   - A region with no CMS card is skipped rather than filled with made-up copy. */

const TOP_DESTINATIONS = ['Northern Drakensberg', 'Central Drakensberg', 'Southern Drakensberg'] as const

const regionNavHref = (name: string) =>
  DESTINATION_GRAPH_NAV.find(n => n.href === '/regions')
    ?.children?.find(c => c.label === name && c.status === 'live')?.href

export default function TopDestinations({ regionCards }: { regionCards: HomeCard[] }) {
  const headingId = useId()

  const destinations = TOP_DESTINATIONS.flatMap(name => {
    const card = regionCards.find(c => c.name === name)
    if (!card) return []
    return [{
      id: card.id,
      name,
      href: regionNavHref(name) || String(card.href || '/regions'),
      img: String(card.img || ''),
      subtitle: String(card.subtitle || ''),
      desc: String(card.desc || ''),
    }]
  })

  if (destinations.length === 0) return null

  return (
    <section aria-labelledby={headingId} className="bg-mist">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">Where to go</p>
            <h2 id={headingId} className="font-display text-4xl text-forest">Top destinations</h2>
          </div>
          <Link
            href="/regions"
            className="hidden sm:flex items-center gap-2 font-sans text-sm text-forest/50 hover:text-forest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            All regions <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Mobile: horizontally scrollable, snapping row. md+: three columns. */}
        <ul className="flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-6 px-6 pb-2 scroll-px-6 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:mx-0 md:px-0 md:pb-0">
          {destinations.map(d => (
            <li key={d.id} className="w-[82%] shrink-0 snap-start md:w-auto">
              <Link
                href={d.href}
                className="group block h-full bg-white border border-black/8 hover:border-forest/30 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <div className="relative overflow-hidden aspect-[4/3] bg-forest/5">
                  {d.img && (
                    <SafeImage
                      src={d.img}
                      alt=""
                      fill
                      loading="lazy"
                      sizes="(max-width: 768px) 82vw, 31vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105 group-focus-visible:scale-105"
                      style={{ willChange: 'transform' }}
                    />
                  )}
                </div>
                <div className="p-5">
                  {d.subtitle && (
                    <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{d.subtitle}</p>
                  )}
                  <h3 className="font-display text-2xl text-forest mb-2 group-hover:text-sage transition-colors">{d.name}</h3>
                  {d.desc && <p className="font-sans text-sm text-forest/55 leading-relaxed">{d.desc}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

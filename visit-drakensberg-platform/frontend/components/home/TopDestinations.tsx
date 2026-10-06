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
    // Continues the trip-planning panel above (same bg-forest), as in the
    // homepage reference: heading, "Explore all", then the three cards.
    <section aria-labelledby={headingId} className="bg-forest">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-[69px] pt-14 lg:pt-20 pb-16 lg:pb-20">
        <h2 id={headingId} className="font-sans font-bold text-[34px] lg:text-[52px] leading-[1.1] tracking-[-0.02em] text-white">
          Top Destinations
        </h2>
        <Link
          href="/regions"
          className="mt-3 lg:mt-4 inline-flex items-center gap-3 font-sans text-base lg:text-xl text-gold hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Explore all <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5" aria-hidden="true" />
        </Link>

        {/* Mobile: horizontally scrollable, snapping row. md+: three columns. */}
        <ul className="mt-7 lg:mt-9 flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 pb-2 scroll-px-4 sm:scroll-px-6 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:mx-0 md:px-0 md:pb-0">
          {destinations.map(d => (
            <li key={d.id} className="w-[82%] shrink-0 snap-start md:w-auto">
              <Link
                href={d.href}
                className="group block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              >
                <div className="relative overflow-hidden rounded-2xl aspect-[4/3] bg-white/10">
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
                <div className="pt-5">
                  {d.subtitle && (
                    <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{d.subtitle}</p>
                  )}
                  <h3 className="font-sans font-semibold text-xl lg:text-2xl text-white mb-2 group-hover:text-gold transition-colors">{d.name}</h3>
                  {d.desc && <p className="font-sans text-sm text-white/60 leading-relaxed">{d.desc}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

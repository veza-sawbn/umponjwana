'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Mountain, Plane, Route } from 'lucide-react'
import { useAutoScrollCarousel } from '@/lib/carousel-autoplay'
import { SUPPLIER_CATEGORIES, type SupplierCategory } from '@/lib/transport'

// Illustration per operator category — the picture carries the distinction
// (city → mountains, around the region, inside one valley) before the words do.
const CATEGORY_ART: Record<SupplierCategory, { icon: typeof Plane; art: string; scale: string }> = {
  gateway: { icon: Plane, art: 'City & airport', scale: 'Long haul' },
  regional: { icon: Route, art: 'Across the region', scale: 'Mid range' },
  local: { icon: Mountain, art: 'Inside the valley', scale: 'Short hops' },
}

const CATEGORIES = Object.entries(SUPPLIER_CATEGORIES) as [
  SupplierCategory,
  typeof SUPPLIER_CATEGORIES[SupplierCategory],
][]

/**
 * "Who drives you" as a slider: one operator type at a time on a narrow
 * screen, swipeable, with arrows and dots for pointer users. The track is a
 * plain scroll-snap list, so keyboard scrolling and swipe both work without
 * any of it being simulated in JavaScript — the arrows just scroll it.
 *
 * It cycles through the three operator types on its own (see
 * lib/carousel-autoplay.ts) so a visitor who never swipes still learns that
 * there is more than one kind of operator. Because the auto-advance moves
 * the real scroll position, the arrows and dots below stay in step with it
 * for free — `syncActive` reads them all back off the same scroll. On `lg`,
 * where all three cards already fit side by side, nothing advances.
 */
export function OperatorTypeCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useAutoScrollCarousel(trackRef, { itemCount: CATEGORIES.length })

  // Which card is centred, read back from the scroll position so swipe,
  // arrows and dots never disagree about where the visitor is.
  const syncActive = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const cards = Array.from(el.children) as HTMLElement[]
    const centre = el.scrollLeft + el.clientWidth / 2
    let nearest = 0
    let best = Infinity
    cards.forEach((card, i) => {
      const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - centre)
      if (distance < best) { best = distance; nearest = i }
    })
    setActive(nearest)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    el.addEventListener('scroll', syncActive, { passive: true })
    window.addEventListener('resize', syncActive)
    syncActive()
    return () => {
      el.removeEventListener('scroll', syncActive)
      window.removeEventListener('resize', syncActive)
    }
  }, [syncActive])

  const goTo = useCallback((index: number) => {
    const el = trackRef.current
    if (!el) return
    const card = el.children[Math.max(0, Math.min(CATEGORIES.length - 1, index))] as HTMLElement | undefined
    if (card) el.scrollTo({ left: card.offsetLeft, behavior: 'smooth' })
  }, [])

  return (
    <section className="bg-black">
      <div className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12 py-12 md:py-16">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-3">Who drives you</p>
            <h2 className="font-display text-3xl sm:text-4xl text-white mb-3">Three kinds of operator</h2>
            <p className="font-sans text-sm text-white/45 max-w-2xl">
              The Drakensberg is served by very different transport businesses. Which ones you see depends on the
              trip you asked for. A long haul from the airport calls for a different operator than a drop at a
              trailhead ten minutes up the valley.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              aria-label="Previous operator type"
              className="flex h-10 w-10 items-center justify-center border border-white/20 text-white/60 hover:border-gold hover:text-gold transition-colors disabled:opacity-25 disabled:hover:border-white/20 disabled:hover:text-white/60"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              disabled={active === CATEGORIES.length - 1}
              aria-label="Next operator type"
              className="flex h-10 w-10 items-center justify-center border border-white/20 text-white/60 hover:border-gold hover:text-gold transition-colors disabled:opacity-25 disabled:hover:border-white/20 disabled:hover:text-white/60"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        {/* The track bleeds to the screen edge on a phone so the next card
            peeks past it, but scroll-padding keeps the snap position on the
            section's gutter — without it snapping swallows the padding and
            the first card sits flush against the edge, out of line with the
            heading above it. */}
        <div
          ref={trackRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-5 px-5 scroll-pl-5 sm:mx-0 sm:px-0 sm:scroll-pl-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {CATEGORIES.map(([key, cat]) => {
            const { icon: Icon, art, scale } = CATEGORY_ART[key]
            return (
              <article
                key={key}
                className="snap-start shrink-0 w-[86%] sm:w-[60%] lg:w-[calc((100%-2rem)/3)] flex flex-col bg-white"
              >
                {/* The illustration band: the shape of the journey at a
                    glance — a plane leaving the city, a road across the
                    region, a peak inside one valley. */}
                <div className="relative bg-forest/[0.04] px-4 py-5 flex items-center gap-3 overflow-hidden">
                  <span className="absolute -right-4 -bottom-5 text-forest/[0.06]" aria-hidden="true">
                    <Icon size={92} strokeWidth={1} />
                  </span>
                  <span className="absolute right-3 top-3 font-sans text-[9px] tracking-[0.12em] uppercase text-forest/30 border border-forest/10 px-1.5 py-0.5">
                    {scale}
                  </span>
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white border border-gold/40">
                    <Icon size={19} className="text-gold" strokeWidth={1.6} />
                  </span>
                  <span className="relative min-w-0">
                    <span className="block font-display text-base text-forest leading-tight">{cat.label}s</span>
                    <span className="block font-sans text-[10px] tracking-[0.14em] uppercase text-forest/35 mt-0.5">{art}</span>
                  </span>
                </div>
                <div className="p-4 space-y-3 flex-1">
                  <p className="font-sans text-xs text-forest/50 leading-relaxed">{cat.description}</p>
                  <div>
                    <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-forest/25 mb-1.5">Typical trips</p>
                    <ul className="space-y-1">
                      {cat.typicalWork.map(work => (
                        <li key={work} className="font-sans text-xs text-forest/60 flex items-start gap-1.5">
                          <Check size={11} className="text-gold shrink-0 mt-[3px]" /> {work}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {cat.exampleBases.map(base => (
                      <span key={base} className="font-sans text-[10px] text-forest/45 border border-gray-100 bg-mist px-2 py-0.5">{base}</span>
                    ))}
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div className="flex justify-center gap-2 mt-5 lg:hidden">
          {CATEGORIES.map(([key], i) => (
            <button
              key={key}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show ${SUPPLIER_CATEGORIES[key].label}s`}
              aria-current={i === active}
              className={`h-1.5 transition-all ${i === active ? 'w-6 bg-gold' : 'w-1.5 bg-white/25'}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

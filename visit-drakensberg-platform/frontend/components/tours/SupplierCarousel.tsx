'use client'
import { useRef } from 'react'
import Link from 'next/link'
import { Building2, MapPin, Star } from 'lucide-react'
import { useAutoScrollCarousel } from '@/lib/carousel-autoplay'
import type { OperatorProfile } from '@/lib/operators'

function SupplierCard({ o }: { o: OperatorProfile }) {
  return (
    <Link
      href={`/guides/operators/${o.id}`}
      className="group block bg-white border border-black/8 hover:border-forest transition-colors shrink-0 w-[240px] snap-start"
    >
      <div className="relative aspect-[4/3] bg-forest/10 overflow-hidden">
        {o.logo ? (
          <img
            src={o.logo}
            alt={o.companyName}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-8 h-8 text-forest/25" />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display text-lg text-forest leading-snug mb-1 group-hover:text-sage transition-colors truncate">
          {o.companyName}
        </h3>
        <p className="font-sans text-xs text-forest/40 flex items-center gap-1 mb-2 truncate">
          <MapPin size={11} className="text-gold shrink-0" /> {o.location || 'Drakensberg'}
        </p>
        <div className="flex items-center gap-3 font-sans text-xs text-forest/50">
          <span>{o.yearsOperating} yr{o.yearsOperating !== 1 ? 's' : ''} operating</span>
          {o.rating !== null && (
            <span className="flex items-center gap-1 text-gold">
              <Star size={11} className="fill-gold" /> {o.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

/**
 * "Explore by Supplier" — a glimpse of each tour operator's profile.
 * On the mobile shell (below `lg`) this renders as a self-advancing
 * carousel; at `lg` and above every supplier already fits in a static grid,
 * so there is nothing left to advance through. Opening a card takes the
 * visitor to that supplier's full profile at /guides/operators/[id].
 *
 * The self-advancing half is the shared one (lib/carousel-autoplay.ts), so
 * this reel keeps the same cadence as every other carousel on the site and
 * inherits the same rules about holding still — while it is being touched,
 * while it is off-screen, and for visitors who asked for reduced motion.
 */
export default function SupplierCarousel({ operators }: { operators: OperatorProfile[] }) {
  const trackRef = useRef<HTMLDivElement>(null)

  useAutoScrollCarousel(trackRef, { itemCount: operators.length })

  if (operators.length === 0) return null

  return (
    <div>
      {/* Mobile shell: auto-advancing carousel. The track bleeds to the screen
          edge so the next card peeks past it, but scroll-padding keeps the
          snap position on the page gutter — without it, snapping swallows
          the padding and the first card sits flush against the edge, out
          of line with the heading above it. */}
      <div
        ref={trackRef}
        className="lg:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1 -mx-6 px-6 scroll-pl-6"
      >
        {operators.map(o => <SupplierCard key={o.id} o={o} />)}
      </div>
      {/* Desktop: static grid, nothing to advance through */}
      <div className="hidden lg:grid grid-cols-4 gap-6">
        {operators.map(o => <SupplierCard key={o.id} o={o} />)}
      </div>
    </div>
  )
}

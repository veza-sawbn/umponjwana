'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Building2, MapPin, Star } from 'lucide-react'
import type { OperatorProfile } from '@/lib/operators'

const AUTO_SLIDE_MS = 3500
const RESUME_AFTER_TOUCH_MS = 4000

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
 * carousel that pauses while the visitor is actually touching it; at `lg`
 * and above it renders as a plain static grid instead, since auto-sliding
 * only makes sense on the narrow mobile viewport. Opening a card takes the
 * visitor to that supplier's full profile at /guides/operators/[id].
 */
export default function SupplierCarousel({ operators }: { operators: OperatorProfile[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    const el = trackRef.current
    if (!el || operators.length < 2) return

    const pause = () => { pausedRef.current = true }
    let resumeTimer: ReturnType<typeof setTimeout>
    const scheduleResume = () => {
      clearTimeout(resumeTimer)
      resumeTimer = setTimeout(() => { pausedRef.current = false }, RESUME_AFTER_TOUCH_MS)
    }
    el.addEventListener('touchstart', pause, { passive: true })
    el.addEventListener('touchend', scheduleResume, { passive: true })

    const id = setInterval(() => {
      if (pausedRef.current) return
      const firstCard = el.firstElementChild as HTMLElement | null
      const step = firstCard ? firstCard.offsetWidth + 16 : 256
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: 'smooth' })
    }, AUTO_SLIDE_MS)

    return () => {
      clearInterval(id)
      clearTimeout(resumeTimer)
      el.removeEventListener('touchstart', pause)
      el.removeEventListener('touchend', scheduleResume)
    }
  }, [operators.length])

  if (operators.length === 0) return null

  return (
    <div>
      {/* Mobile shell: auto-sliding carousel */}
      <div
        ref={trackRef}
        className="lg:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1 -mx-6 px-6"
      >
        {operators.map(o => <SupplierCard key={o.id} o={o} />)}
      </div>
      {/* Desktop: static grid, no auto-slide */}
      <div className="hidden lg:grid grid-cols-4 gap-6">
        {operators.map(o => <SupplierCard key={o.id} o={o} />)}
      </div>
    </div>
  )
}

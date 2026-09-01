'use client'
import { useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMoney } from '@/lib/allocation'

export type StayCard = {
  id: string
  title: string
  location: string
  price: number
  rating?: number
  reviews?: number
  img?: string
  category: string
  amenities: string[]
  guests?: number
  discount?: number
  featured?: boolean
}

/**
 * Horizontal, arrow-scrollable row of stays — used to list each accommodation
 * type's matches (app/stays/page.tsx) without every category stacking the
 * page tall enough that finding one means a lot of vertical scrolling.
 * Native touch/trackpad scrolling works on any device; the arrow buttons are
 * a pointer-only convenience layered on top.
 */
export default function StayCarousel({ stays }: { stays: StayCard[] }) {
  const trackRef = useRef<HTMLDivElement>(null)

  function scrollByPage(direction: 1 | -1) {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: el.clientWidth * 0.9 * direction, behavior: 'smooth' })
  }

  return (
    <div className="relative group/carousel">
      <div
        ref={trackRef}
        className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-none pb-2 -mx-6 px-6 lg:-mx-12 lg:px-12"
      >
        {stays.map((stay) => <StayTile key={stay.id} stay={stay} />)}
      </div>
      {stays.length > 3 && (
        <>
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            aria-label="Scroll left"
            className="hidden sm:flex absolute -left-4 top-[35%] -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-black/10 items-center justify-center shadow-md hover:border-forest transition-colors opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100"
          >
            <ChevronLeft className="w-4 h-4 text-forest" />
          </button>
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            aria-label="Scroll right"
            className="hidden sm:flex absolute -right-4 top-[35%] -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-black/10 items-center justify-center shadow-md hover:border-forest transition-colors opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100"
          >
            <ChevronRight className="w-4 h-4 text-forest" />
          </button>
        </>
      )}
    </div>
  )
}

function StayTile({ stay }: { stay: StayCard }) {
  const discountedPrice = stay.discount ? Math.round(stay.price * (1 - stay.discount / 100)) : null
  return (
    <Link
      href={`/stays/${stay.id}`}
      className="group block shrink-0 snap-start w-[260px] sm:w-[280px]"
    >
      <div className="relative overflow-hidden aspect-[4/3] mb-4 bg-[#2d6a4f]/10">
        {stay.img ? (
          <img src={stay.img} alt={stay.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#C9A96E]/10">
            <span className="font-display italic text-2xl text-[#C9A96E]/40">{stay.category}</span>
          </div>
        )}
        {stay.featured && (
          <span className="absolute top-3 left-3 font-sans text-[10px] tracking-[0.15em] uppercase bg-gold text-forest px-2.5 py-1">
            Featured
          </span>
        )}
        {stay.discount && (
          <span className="absolute top-3 right-3 font-sans text-[10px] tracking-[0.1em] bg-forest text-white px-2 py-1">
            -{stay.discount}%
          </span>
        )}
      </div>
      <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{stay.category} · {stay.location}</p>
      <h3 className="font-display text-xl text-forest leading-snug mb-2 group-hover:text-sage transition-colors">{stay.title}</h3>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {stay.rating ? (
            <>
              <span className="text-gold text-sm">★</span>
              <span className="font-sans text-sm text-forest/70">{stay.rating}</span>
              {stay.reviews && <span className="font-sans text-xs text-forest/35">({stay.reviews})</span>}
            </>
          ) : (
            <span className="font-sans text-xs text-forest/35">New listing</span>
          )}
        </div>
        <div className="text-right">
          {stay.price > 0 ? (
            discountedPrice ? (
              <div>
                <span className="font-sans text-xs text-forest/35 line-through mr-1">{formatMoney(stay.price)}</span>
                <span className="font-display text-lg text-forest">{formatMoney(discountedPrice)}</span>
                <span className="font-sans text-xs text-forest/40"> /night</span>
              </div>
            ) : (
              <span>
                <span className="font-display text-lg text-forest">{formatMoney(stay.price)}</span>
                <span className="font-sans text-xs text-forest/40"> /night</span>
              </span>
            )
          ) : (
            <span className="font-sans text-xs text-forest/40">Contact for rates</span>
          )}
        </div>
      </div>
    </Link>
  )
}

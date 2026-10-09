'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay } from 'swiper/modules'
import type { Swiper as SwiperInstance } from 'swiper'
import 'swiper/css'
import SafeImage from '@/components/ui/SafeImage'
import { useSwiperAutoplay, CAROUSEL_SPEED_MS } from '@/lib/carousel-autoplay'
import { useEditMode } from '@/lib/edit-mode-context'
import { homeTone, homeType } from '@/components/home/home-style'

const light = homeTone.light

/**
 * One card in the homepage "Featured Experiences" reel. Hikes, events and
 * activities are all mapped onto this shape in HomePage.tsx, so the reel
 * stays a single design regardless of where a listing comes from.
 */
export type FeaturedExperience = {
  id: string
  href: string
  title: string
  region: string
  /** "Extreme experience, 5 days" — the line under the title. */
  meta: string
  /** ISO date of the next departure / start. No badge when absent. */
  date?: string
  /** Lowest per-person price in ZAR. No price row when absent or 0. */
  price?: number
  /** Short detail revealed by the (i) button. */
  info?: string
  img?: string
  /** Shown under the photo, and in place of one that's missing or broken. */
  fallbackColor: string
}

function dateParts(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return { day: d.getDate(), month: d.toLocaleDateString('en-ZA', { month: 'short' }) }
}

/** Whole rands, "R12 500" — a teaser price, so no cents. Grouped by hand:
 *  toLocaleString('en-ZA') differs between Node and browsers (space vs
 *  comma), which would break hydration. */
function formatFromPrice(amount: number) {
  return `R${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}`
}

function ExperienceCard({ item }: { item: FeaturedExperience }) {
  const [infoOpen, setInfoOpen] = useState(false)
  const departure = dateParts(item.date)

  return (
    <article className="group h-full">
      <Link href={item.href} className={`${homeType.cardLink} ${light.focus}`}>
        <div className={`${homeType.media} bg-mist`}>
          <div className="absolute inset-0" style={{ background: item.fallbackColor }} />
          <SafeImage src={item.img} alt={item.title} fill loading="lazy"
            sizes="(max-width: 640px) 88vw, (max-width: 1024px) 45vw, 30vw"
            className={homeType.image}
            style={{ willChange: 'transform' }} />
          {departure && (
            <div className="absolute left-4 bottom-4 bg-white rounded-xl shadow-card px-4 py-2 min-w-[4.5rem] text-center">
              <span className="block font-sans text-[10px] tracking-[0.15em] uppercase text-forest/60">From</span>
              <strong className="block font-sans text-2xl font-bold text-forest leading-tight">{departure.day}</strong>
              <span className="block font-sans text-sm text-forest">{departure.month}</span>
            </div>
          )}
        </div>
      </Link>

      <div className="pt-5">
        <span className={`block ${homeType.eyebrow} ${light.eyebrow} mb-1`}>{item.region}</span>
        <Link href={item.href}>
          <h3 className={`${homeType.cardTitle} ${light.title} line-clamp-2`}>{item.title}</h3>
        </Link>
        {item.meta && <p className={`${homeType.cardBody} ${light.body} mt-2`}>{item.meta}</p>}

        {item.price ? (
          <div className="flex items-center gap-4 mt-3">
            <span className="font-sans text-lg font-semibold text-forest">from {formatFromPrice(item.price)}</span>
            {item.info && (
              <button
                type="button"
                onClick={() => setInfoOpen(o => !o)}
                aria-expanded={infoOpen}
                aria-label={`More information about ${item.title}`}
                className="w-7 h-7 rounded-full border border-forest/30 font-sans text-xs text-forest/70 hover:border-forest hover:text-forest transition-colors"
              >
                i
              </button>
            )}
          </div>
        ) : null}
        {/* In-flow rather than a floating popover: the Swiper track clips
            anything that overflows the slide. */}
        {infoOpen && item.info && (
          <p role="note" className="mt-3 font-sans text-xs text-forest/60 leading-relaxed">{item.info}</p>
        )}
      </div>
    </article>
  )
}

/**
 * The reel itself: the cards on a Swiper with the shared house autoplay
 * (paused on touch/drag, off-screen, and in the visual editor), plus the
 * round prev/next buttons that the section header renders.
 */
export function FeaturedExperiencesCarousel({ items, onSwiper }: {
  items: FeaturedExperience[]
  onSwiper: (swiper: SwiperInstance) => void
}) {
  const inEditor = Boolean(useEditMode())
  const autoplay = useSwiperAutoplay({ slideCount: items.length, enabled: !inEditor })

  return (
    <Swiper
      modules={[Autoplay]}
      loop={items.length > 3}
      speed={CAROUSEL_SPEED_MS}
      {...autoplay}
      onSwiper={onSwiper}
      spaceBetween={32}
      grabCursor
      slidesPerView={1.15}
      breakpoints={{
        640: { slidesPerView: 2.15 },
        1024: { slidesPerView: 3 },
      }}
      className="!pb-1"
    >
      {items.map(item => (
        <SwiperSlide key={item.id} className="h-auto self-stretch">
          <ExperienceCard item={item} />
        </SwiperSlide>
      ))}
    </Swiper>
  )
}

export function CarouselNav({ swiper, count }: { swiper: SwiperInstance | null; count: number }) {
  if (count <= 1) return null
  const btn = 'w-12 h-12 rounded-full border border-black/15 bg-white flex items-center justify-center text-forest hover:border-forest transition-colors'
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={btn} onClick={() => swiper?.slidePrev()} aria-label="Previous experiences">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button type="button" className={btn} onClick={() => swiper?.slideNext()} aria-label="Next experiences">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

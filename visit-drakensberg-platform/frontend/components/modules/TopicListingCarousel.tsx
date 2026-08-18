'use client'

import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import type { SeasonCard } from '@/lib/season-cards'
import SeasonListingCard from './SeasonListingCard'

/**
 * Mobile-only presentation of a topic's listings — an infinite, swipeable
 * carousel (Swiper, already an installed dependency, previously unused
 * anywhere in the app). The desktop/tablet grid (SeasonTopicSection) stays
 * a static grid; this is swapped in below the `sm` breakpoint. See
 * docs/destination-graph/PHASE_I.md.
 *
 * Looping needs enough slides to feel like a loop rather than glitch —
 * below 3 cards there's nothing meaningful to loop, so it falls back to a
 * plain (still swipeable) row.
 */
export default function TopicListingCarousel({ cards }: { cards: SeasonCard[] }) {
  const canLoop = cards.length > 2

  return (
    <Swiper
      loop={canLoop}
      slidesPerView={1.15}
      spaceBetween={12}
      grabCursor
      className="!pb-1 !overflow-visible"
    >
      {cards.map(card => (
        <SwiperSlide key={card.id} className="h-auto self-stretch">
          <SeasonListingCard card={card} />
        </SwiperSlide>
      ))}
    </Swiper>
  )
}

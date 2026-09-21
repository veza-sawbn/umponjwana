'use client'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import TrailExperiences from '@/components/experiences/TrailExperiences'
import { useSwiperAutoplay, CAROUSEL_AUTOPLAY_SLOW_MS, CAROUSEL_SPEED_MS } from '@/lib/carousel-autoplay'
import type { Trail } from '@/lib/trails'
import type { TrekkingExperience } from '@/lib/experiences'

/**
 * Swipeable presentation of the "What's on" marketplace groups on /hikes —
 * replaces the old vertically-stacked list (one full TrailExperiences block
 * per trail). Each slide is still a *whole* trail's block of departures
 * (title, compare-picker, every departure row) — this only changes how you
 * move between trails, not what's inside each one — so slidesPerView stays
 * at 1 and the slide height follows its own content (auto-height) rather
 * than clipping or stretching to match its neighbours. Pagination dots
 * stand in for the peek affordance a fractional slidesPerView normally
 * gives, since a full-width slide doesn't show a sliver of the next one.
 *
 * It moves through the trails on its own, but on the slow cadence rather
 * than the house one: a slide here is a whole block of departures to read,
 * not a single card to glance at, so it gets noticeably longer on screen
 * before the next trail comes round.
 */
export default function TrailExperiencesCarousel({
  groups,
}: {
  groups: { trail: Trail; exps: TrekkingExperience[] }[]
}) {
  const autoplay = useSwiperAutoplay({ slideCount: groups.length, delayMs: CAROUSEL_AUTOPLAY_SLOW_MS })

  return (
    <Swiper
      modules={[Autoplay, Pagination]}
      speed={CAROUSEL_SPEED_MS}
      {...autoplay}
      slidesPerView={1}
      spaceBetween={32}
      autoHeight
      grabCursor
      pagination={{ clickable: true }}
      className="!pb-10"
      style={{ '--swiper-pagination-color': '#2d6a4f', '--swiper-pagination-bullet-inactive-color': '#00000022' } as React.CSSProperties}
    >
      {groups.map(({ trail, exps }) => (
        <SwiperSlide key={trail.id}>
          <TrailExperiences
            trailId={trail.id}
            experiences={exps}
            title={trail.name}
            subtitle={`${trail.region} · ${trail.distance} · ${trail.difficulty}`}
            titleHref={`/hikes/${trail.id}`}
          />
        </SwiperSlide>
      ))}
    </Swiper>
  )
}

'use client'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import TrailExperiences from '@/components/experiences/TrailExperiences'
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
 */
export default function TrailExperiencesCarousel({
  groups,
}: {
  groups: { trail: Trail; exps: TrekkingExperience[] }[]
}) {
  return (
    <Swiper
      modules={[Pagination]}
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

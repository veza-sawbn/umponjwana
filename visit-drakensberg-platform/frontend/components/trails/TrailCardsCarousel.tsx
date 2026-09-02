'use client'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import ExploreCard from '@/components/trails/ExploreCard'
import { trailStartPoint, trailCategory } from '@/lib/trails'
import { StayDistance } from '@/lib/stay-distance'
import type { Trail } from '@/lib/trails'

/**
 * Swipeable presentation of the /hikes results — replaces the old static
 * grid in the same slot. Unlike the homepage's marketing carousels this one
 * browses a genuine (and potentially long) filtered result set, so it never
 * loops or autoplays: swiping to the end should feel like reaching the end
 * of the list, not looping back to the start.
 */
export default function TrailCardsCarousel({
  trails, difficultyColor,
}: {
  trails: Trail[]
  difficultyColor: Record<string, string>
}) {
  return (
    <Swiper
      spaceBetween={24}
      slidesPerView={1.15}
      breakpoints={{
        640: { slidesPerView: 2.15 },
        1024: { slidesPerView: 3.2 },
      }}
      grabCursor
      className="!pb-1"
    >
      {trails.map(t => {
        const start = trailStartPoint(t)
        return (
          <SwiperSlide key={t.id} className="h-auto self-stretch">
            <ExploreCard
              href={`/hikes/${t.id}`}
              image={t.image}
              imageAlt={t.name}
              eyebrow={t.region}
              title={t.name}
              difficultyLabel={t.difficulty}
              difficultyColor={difficultyColor[t.difficulty]}
              bottomRightBadge={trailCategory(t) === 'speciality_walk' ? t.speciality_type : undefined}
              routeArtworkTrail={t}
              meta={
                <>
                  <p className="font-sans text-xs text-forest/40">{t.distance} · {t.elevation} · {t.duration}</p>
                  <StayDistance lat={start?.lat} lng={start?.lng} className="mt-1" />
                </>
              }
            />
          </SwiperSlide>
        )
      })}
    </Swiper>
  )
}

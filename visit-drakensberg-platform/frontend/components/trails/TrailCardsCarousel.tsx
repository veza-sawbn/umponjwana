'use client'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay } from 'swiper/modules'
import 'swiper/css'
import ExploreCard from '@/components/trails/ExploreCard'
import { useSwiperAutoplay, CAROUSEL_SPEED_MS } from '@/lib/carousel-autoplay'
import { trailStartPoint, trailCategory } from '@/lib/trails'
import { StayDistance } from '@/lib/stay-distance'
import type { Trail } from '@/lib/trails'

/**
 * Swipeable presentation of the /hikes results — replaces the old static
 * grid in the same slot. It drifts through the results on its own so a
 * filtered set shows more than its first three trails at a glance, and
 * holds still as soon as the visitor takes over.
 *
 * Unlike the homepage's marketing reels, though, this one browses a genuine
 * (and potentially long) result set, so it neither loops nor wraps: it
 * advances to the last trail and stops there, because reaching the end
 * should feel like reaching the end of the list rather than being carried
 * back to the start.
 */
export default function TrailCardsCarousel({
  trails, difficultyColor,
}: {
  trails: Trail[]
  difficultyColor: Record<string, string>
}) {
  const autoplay = useSwiperAutoplay({ slideCount: trails.length, stopOnLastSlide: true })

  return (
    <Swiper
      modules={[Autoplay]}
      speed={CAROUSEL_SPEED_MS}
      {...autoplay}
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
              saveListing={{
                id: t.id,
                type: 'hike',
                title: t.name,
                location: t.region,
                image: t.image,
              }}
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

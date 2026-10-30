'use client'
import ExploreCard from '@/components/trails/ExploreCard'
import { trailStartPoint, trailCategory } from '@/lib/trails'
import { StayDistance } from '@/lib/stay-distance'
import type { Trail } from '@/lib/trails'

/**
 * Grid presentation of the /hikes results. Replaces the old self-advancing
 * carousel, which only ever showed ~3 trails at once and cropped a fourth at
 * the edge — a result set is something visitors scan and compare, so every
 * trail is laid out at once (the page pages it with "Show more").
 */
export default function TrailCardsGrid({
  trails, difficultyColor,
}: {
  trails: Trail[]
  difficultyColor: Record<string, string>
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
      {trails.map(t => {
        const start = trailStartPoint(t)
        return (
          <ExploreCard
            key={t.id}
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
        )
      })}
    </div>
  )
}

import Link from 'next/link'
import { Mountain, Navigation } from 'lucide-react'
import type { NearbyTrailResult } from '@/lib/modules'

const FALLBACK = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80'

/**
 * Reusable "related trails" module — pure server component, no client JS,
 * so its links are crawlable in the initial HTML (unlike
 * components/booking/SmartRecommendations.tsx, which is client-rendered).
 * Automatic-mode renderer for the 'related_trails' ModuleType — see
 * lib/modules.ts and lib/page-composition.ts.
 */
export default function RelatedTrailsModule({
  trails, title = 'Trails Nearby', viewAllHref,
}: {
  trails: NearbyTrailResult[]
  title?: string
  viewAllHref?: string
}) {
  if (trails.length === 0) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display italic text-2xl text-[#000000] flex items-center gap-2">
          <Mountain size={20} className="text-[#C9A96E]" /> {title}
        </h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="font-sans text-sm text-[#2d6a4f] hover:underline shrink-0">
            View all →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trails.map(t => (
          <Link key={t.id} href={`/hikes/${t.slug || t.id}`} className="group bg-white border border-gray-200 overflow-hidden hover:border-[#2d6a4f] transition-colors flex gap-0">
            <div className="relative w-28 shrink-0 overflow-hidden">
              <img src={t.image || FALLBACK} alt={t.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-4 flex flex-col justify-between flex-1 min-w-0">
              <div>
                <h3 className="font-display italic text-lg text-[#000000] leading-tight group-hover:text-[#2d6a4f] transition-colors truncate">{t.name}</h3>
                <p className="font-sans text-xs text-gray-400 mt-0.5">{t.distance} · {t.difficulty}</p>
              </div>
              {t.distanceKm !== undefined && (
                <p className="font-sans text-[10px] text-gray-400 flex items-center gap-1 mt-2">
                  <Navigation size={9} /> {t.distanceKm} km away
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

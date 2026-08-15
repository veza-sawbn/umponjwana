import Link from 'next/link'
import { Bus, ArrowRight, Clock } from 'lucide-react'
import { routeDurationLabel, routePrice, routeSlug, type Route } from '@/lib/transport-routes'

/**
 * Reusable "shuttle routes touching this region" module — pure server
 * component, same shape as RelatedTrailsModule/NearbyStaysModule. Renders
 * nothing when there are no real matching routes (no empty-state clutter —
 * most regions won't have any yet). Automatic-mode renderer, resolved by
 * lib/modules.ts's getNearbyRoutes(). See docs/destination-graph/PHASE_H.md.
 */
export default function ShuttleRoutesModule({
  routes, title = 'Shuttle Routes to this Region',
}: {
  routes: Route[]
  title?: string
}) {
  if (routes.length === 0) return null
  return (
    <section>
      <h2 className="font-display italic text-2xl text-[#000000] flex items-center gap-2 mb-4">
        <Bus size={20} className="text-[#C9A96E]" /> {title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {routes.map(r => (
          <Link
            key={r.id}
            href={`/transport/${routeSlug(r)}`}
            className="group bg-white border border-gray-200 p-4 hover:border-[#2d6a4f] transition-colors flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-sans text-sm font-medium text-[#000000] truncate">
                <span className="truncate">{r.from}</span>
                <ArrowRight size={13} className="text-[#C9A96E] shrink-0" />
                <span className="truncate">{r.to}</span>
              </div>
              <p className="font-sans text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                <Clock size={10} /> {routeDurationLabel(r)}
              </p>
            </div>
            <p className="font-display italic text-lg text-[#2d6a4f] shrink-0">
              R {routePrice(r).toLocaleString()}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}

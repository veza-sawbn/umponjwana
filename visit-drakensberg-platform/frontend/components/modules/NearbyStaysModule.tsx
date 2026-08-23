import Link from 'next/link'
import { Home, Navigation } from 'lucide-react'
import type { NearbyStayResult } from '@/lib/modules'

const FALLBACK = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80'

/**
 * Reusable "nearby accommodation" module — pure server component. See
 * RelatedTrailsModule.tsx for the rationale (crawlable, not client-rendered).
 * Automatic-mode renderer for the 'nearby_accommodation' ModuleType — see
 * lib/modules.ts and lib/page-composition.ts.
 */
export default function NearbyStaysModule({
  stays, title = 'Places to Stay Nearby', viewAllHref,
}: {
  stays: NearbyStayResult[]
  title?: string
  viewAllHref?: string
}) {
  if (stays.length === 0) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display italic text-2xl text-[#000000] flex items-center gap-2">
          <Home size={20} className="text-[#C9A96E]" /> {title}
        </h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="font-sans text-sm text-[#2d6a4f] hover:underline shrink-0">
            View all →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stays.map(p => (
          <Link key={p.id} href={`/stays/${p.slug || p.id}`} className="group bg-white border border-gray-200 overflow-hidden hover:border-[#2d6a4f] transition-colors flex flex-col">
            <div className="relative aspect-[4/3] overflow-hidden bg-[#2d6a4f]/10">
              <img src={p.photos[0] || FALLBACK} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-3 flex flex-col flex-1">
              <p className="font-sans text-[9px] tracking-[0.12em] uppercase text-[#C9A96E] mb-1">{p.type}</p>
              <h3 className="font-display italic text-base text-[#000000] leading-tight group-hover:text-[#2d6a4f] transition-colors truncate">{p.name}</h3>
              {p.distanceKm !== undefined && (
                <p className="font-sans text-[10px] text-gray-400 flex items-center gap-1 mt-1.5">
                  <Navigation size={9} /> {p.distanceKm} km away
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

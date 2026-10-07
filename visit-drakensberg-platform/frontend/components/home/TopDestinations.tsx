'use client'
import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import SafeImage from '@/components/ui/SafeImage'
import { DEFAULT_REGIONS, getRegions, regionsMatch, type Region } from '@/lib/regions'
import { publicSupabase } from '@/lib/supabase-public'
import { objectPositionStyle } from '@/lib/image-position'

/* ─── Top destinations ──────────────────────────────────────────────────────
   Exactly the three Drakensberg regions, north → south, built from the live
   region records (Admin → Regions, site_content.admin_regions): each card
   links to that region's own page (/regions/<slug>) and shows its stored
   name, tagline, overview and hero photo (with its focal point).

   Records come from the server (app/page.tsx) when available, otherwise
   from a client read. getRegions()' built-in DEFAULT_REGIONS fallback is
   never shown as live content: until real records arrive the cards are
   neutral placeholders, and a missing region is simply left out. */

const TOP_DESTINATIONS = ['Northern Drakensberg', 'Central Drakensberg', 'Southern Drakensberg'] as const

// Region pages keep their slug when an admin renames a region (see
// updateRegion), so cards are matched by slug first — the live slugs, then
// the original north-berg/central-berg/south-berg ids — and only then by a
// tolerant name match. The card always shows the record's stored name.
const DESTINATION_SLUGS: Record<(typeof TOP_DESTINATIONS)[number], string[]> = {
  'Northern Drakensberg': ['northern-drakensberg', 'north-berg'],
  'Central Drakensberg': ['central-drakensberg', 'central-berg'],
  'Southern Drakensberg': ['southern-drakensberg', 'south-berg'],
}

function findDestination(regions: Region[], name: (typeof TOP_DESTINATIONS)[number]): Region | undefined {
  const slugs = DESTINATION_SLUGS[name]
  return regions.find(r => slugs.includes(r.slug) || slugs.includes(r.id))
    ?? regions.find(r => regionsMatch(r.name, name))
}

export default function TopDestinations({ initialRegions }: { initialRegions?: Region[] }) {
  const headingId = useId()
  const [regions, setRegions] = useState<Region[] | null>(initialRegions ?? null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (initialRegions) return
    let cancelled = false
    getRegions(publicSupabase)
      .then(all => {
        if (cancelled) return
        if (all === DEFAULT_REGIONS) setFailed(true)
        else setRegions(all)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [initialRegions])

  const destinations = regions
    ? TOP_DESTINATIONS.flatMap(name => { const r = findDestination(regions, name); return r ? [r] : [] })
    : []

  // Nothing real to show (read failed, or no matching records): omit the
  // section rather than render built-in copy.
  if (failed || (regions && destinations.length === 0)) return null

  return (
    // Continues the trip-planning panel above (same bg-forest), as in the
    // homepage reference: heading, "Explore all", then the three cards.
    <section aria-labelledby={headingId} className="bg-forest">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-[69px] pt-14 lg:pt-20 pb-16 lg:pb-20">
        <h2 id={headingId} className="font-sans font-bold text-[34px] lg:text-[52px] leading-[1.1] tracking-[-0.02em] text-white">
          Top Destinations
        </h2>
        <Link
          href="/regions"
          className="mt-3 lg:mt-4 inline-flex items-center gap-3 font-sans text-base lg:text-xl text-gold hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Explore all <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5" aria-hidden="true" />
        </Link>

        {/* Mobile: horizontally scrollable, snapping row. md+: three columns. */}
        <ul
          aria-busy={regions ? undefined : true}
          className="mt-7 lg:mt-9 flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 pb-2 scroll-px-4 sm:scroll-px-6 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:mx-0 md:px-0 md:pb-0"
        >
          {regions
            ? destinations.map(r => (
              <li key={r.id} className="w-[82%] shrink-0 snap-start md:w-auto">
                <Link
                  href={`/regions/${r.slug}`}
                  className="group block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
                >
                  <div className="relative overflow-hidden rounded-2xl aspect-[4/3] bg-white/10">
                    {r.heroImage && (
                      <SafeImage
                        src={r.heroImage}
                        alt=""
                        fill
                        loading="lazy"
                        sizes="(max-width: 768px) 82vw, 31vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105 group-focus-visible:scale-105"
                        style={{ ...objectPositionStyle(r.heroImagePosition), willChange: 'transform' }}
                      />
                    )}
                  </div>
                  <div className="pt-5">
                    {r.tagline && (
                      <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{r.tagline}</p>
                    )}
                    <h3 className="font-sans font-semibold text-xl lg:text-2xl text-white mb-2 group-hover:text-gold transition-colors">{r.name}</h3>
                    {r.overview && <p className="font-sans text-sm text-white/60 leading-relaxed line-clamp-3">{r.overview}</p>}
                  </div>
                </Link>
              </li>
            ))
            : TOP_DESTINATIONS.map(name => (
              // Placeholder blocks only — no stand-in text or photos.
              <li key={name} aria-hidden="true" className="w-[82%] shrink-0 snap-start md:w-auto">
                <div className="rounded-2xl aspect-[4/3] bg-white/10 animate-skeleton" />
                <div className="pt-5 space-y-2">
                  <div className="h-2.5 w-1/2 bg-white/10 animate-skeleton" />
                  <div className="h-5 w-2/3 bg-white/10 animate-skeleton" />
                  <div className="h-3 w-full bg-white/10 animate-skeleton" />
                </div>
              </li>
            ))}
        </ul>
      </div>
    </section>
  )
}

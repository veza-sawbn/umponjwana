'use client'
import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { publicSupabase } from '@/lib/supabase-public'
import { getTrailSummaries, type Trail } from '@/lib/trails'
import { getActivities, type Activity } from '@/lib/activities'
import { regionsMatch } from '@/lib/regions'
import { DESTINATION_GRAPH_NAV } from '@/lib/destination-ia'
import { SEASON_META } from '@/lib/seasons'
import { useSiteSection } from '@/lib/use-site-section'
import { activeSeason, normalizePicks, seasonCopy, selectSeasonalItems } from '@/lib/seasonal-picks'
import { toSeasonCard, type SeasonCard } from '@/lib/season-cards'
import SeasonListingCard from '@/components/modules/SeasonListingCard'
import TopicListingCarousel from '@/components/modules/TopicListingCarousel'
import { homeContainer, homeTone, homeType } from '@/components/home/home-style'

/* ─── Recommended this season ───────────────────────────────────────────────
   Hand-picked and season-tagged trails and activities (the same `seasons`
   facet behind the /regions/[slug]/[season] pages), rendered with that
   page's own card. What shows — season, copy, pinned/excluded listings,
   card count — is controlled from Admin → Website (`seasonal_picks`; the
   selection itself lives in lib/seasonal-picks.ts).
   Renders nothing until loaded, and nothing at all when the admin has
   switched it off or nothing qualifies — no placeholders, prices or counts
   are invented. */

// Region pages from the primary nav — the season pages hang off these.
const REGION_LINKS = (DESTINATION_GRAPH_NAV.find(n => n.href === '/regions')?.children ?? [])
  .filter(c => c.type === 'entity' && c.status === 'live' && c.href.startsWith('/regions/'))

type Loaded = { trails: Trail[]; activities: Activity[]; now: Date }

export default function RecommendedThisSeason() {
  const headingId = useId()
  const config = normalizePicks(useSiteSection('seasonal_picks'))
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let cancelled = false
    // publicSupabase (session-less) — public catalogue only; see lib/supabase-public.ts.
    Promise.all([
      getTrailSummaries(publicSupabase).catch(() => [] as Trail[]),
      getActivities(publicSupabase).catch(() => [] as Activity[]),
    ]).then(([trails, activities]) => {
      // The date is taken on the client so server and client render agree
      // (nothing renders until this runs).
      if (!cancelled) setLoaded({ trails, activities, now: new Date() })
    })
    return () => { cancelled = true }
  }, [])

  if (!loaded || !config.enabled) return null
  const season = activeSeason(config, loaded.now)
  const data = { season, items: selectSeasonalItems(config, season, loaded.trails, loaded.activities) }
  if (data.items.length === 0) return null

  const copy = seasonCopy(config, data.season)
  const meta = SEASON_META[data.season]
  // toSeasonCard() substitutes a stock photo when a listing has none; here a
  // listing without its own photo shows the card's plain background instead.
  const cards: SeasonCard[] = data.items.map(entry => {
    const card = toSeasonCard(entry)
    const ownImage = entry.kind === 'trail' ? entry.item.image : entry.item.photos?.[0]
    return ownImage ? card : { ...card, image: '' }
  })
  // Only link a region's season page when that region has tagged content.
  const regionLinks = REGION_LINKS.filter(r =>
    data.items.some(entry => regionsMatch(entry.item.region, r.label)),
  )

  return (
    <section aria-labelledby={headingId} className="bg-white">
      <div className={homeContainer}>
        <div className="mb-7 lg:mb-9 max-w-3xl">
          <p className={`font-sans text-xs tracking-[0.2em] uppercase ${homeTone.light.eyebrow} mb-3`}>
            {copy.eyebrow}
          </p>
          <h2 id={headingId} className={`${homeType.heading} ${homeTone.light.heading}`}>{copy.heading}</h2>
          <p className={`font-sans text-base ${homeTone.light.subheading} mt-4 max-w-xl leading-relaxed`}>{copy.blurb}</p>
        </div>

        {/* Desktop/tablet: static grid */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {cards.map(card => <SeasonListingCard key={`${card.kind}:${card.id}`} card={card} variant="home" />)}
        </div>

        {/* Mobile: swipeable carousel (same as the season pages) */}
        <div className="sm:hidden">
          <TopicListingCarousel cards={cards} variant="home" />
        </div>

        {config.show_region_links && regionLinks.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-3 mt-8">
            {regionLinks.map(r => (
              <Link
                key={r.href}
                href={`${r.href}/${data.season}`}
                className="inline-flex items-center gap-2 font-sans text-sm text-brown-700 hover:text-forest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                {r.label} in {meta.label.toLowerCase()} <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

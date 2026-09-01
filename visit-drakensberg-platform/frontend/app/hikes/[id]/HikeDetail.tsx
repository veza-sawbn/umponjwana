'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Mountain, Clock, TrendingUp, Users, Star, CheckCircle, ChevronRight, X, Bed, Zap } from 'lucide-react'
import { getTrails, Trail, trailCategory } from '@/lib/trails'
import UpcomingDepartures from '@/components/tours/UpcomingDepartures'
import TrailExperiences from '@/components/experiences/TrailExperiences'
import { getDepartures } from '@/lib/departures'
import { getTours } from '@/lib/tours'
import { getExperiencesByTrail, type TrekkingExperience } from '@/lib/experiences'
import type { TourDate } from '@/components/tours/UpcomingDepartures'
import { CalendarPlus } from 'lucide-react'
import RouteArtwork from '@/components/trails/RouteArtwork'
import RouteProfileChart from '@/components/trails/RouteProfileChart'
import RouteStats from '@/components/trails/RouteStats'
import type { Property } from '@/lib/properties'
import type { Activity } from '@/lib/activities'
import { formatMoney } from '@/lib/allocation'
import ReadMoreText from '@/components/ui/ReadMoreText'

const DIFF_COLOR: Record<string, string> = { Easy: '#4A7251', Moderate: '#C9A96E', Hard: '#c0392b', Strenuous: '#c0392b', Extreme: '#7f1d1d' }
const DIFF_BG: Record<string, string> = { Easy: '#4A725122', Moderate: '#C9A96E22', Hard: '#c0392b22', Strenuous: '#c0392b22', Extreme: '#7f1d1d22' }

const CATEGORY_LABEL: Record<string, string> = {
  day_hike: 'Day Hike',
  multi_day_hike: 'Multi-Day Hike',
  speciality_walk: 'Speciality Walk',
}

const TRAIL_COLOR: Record<string, string> = {
  Easy: 'bg-[#4A7251]',
  Moderate: 'bg-[#2d6a4f]',
  Strenuous: 'bg-[#1a1a2e]',
  Hard: 'bg-[#1a1a2e]',
  Extreme: 'bg-[#1a1a2e]',
}

/**
 * Client island rendered inside the server shell (page.tsx), which already
 * resolved `trail` for generateMetadata/JSON-LD and 404s server-side if the
 * id doesn't exist. This component keeps its own client-side fetch for
 * related trails, upcoming departures and marketplace experiences — those
 * are either time-sensitive booking data or a secondary "other trails" list,
 * neither of which needs to block the server response. See
 * docs/destination-graph/PHASE_B.md.
 */
export default function HikeDetail({
  trail,
  relatedProperties = [],
  relatedActivities = [],
}: {
  trail: Trail
  relatedProperties?: Property[]
  relatedActivities?: Activity[]
}) {
  const [allTrails, setAllTrails] = useState<Trail[]>([])
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const [departures, setDepartures] = useState<TourDate[]>([])
  const [experiences, setExperiences] = useState<TrekkingExperience[]>([])

  useEffect(() => {
    getTrails().then(setAllTrails)
    Promise.all([getDepartures(), getTours()]).then(([all, tours]) => {
      const activeTourIds = new Set(tours.filter(t => t.status === 'active').map(t => t.id))
      const today = new Date().toISOString().slice(0, 10)
      const tourDates: TourDate[] = all
        .filter(d => d.trailId === trail.id && d.date >= today && d.status !== 'full' && activeTourIds.has(d.tourId))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({
          id: d.id,
          date: d.date,
          type: 'guide' as const,
          operator: d.supplierName || d.tour,
          tourName: d.tour,
          guide: d.guide || undefined,
          supplierId: d.supplierId,
          spots_total: d.maxSeats,
          spots_remaining: d.maxSeats - d.bookedSeats,
          price_per_person: d.pricePerPerson,
          duration: `${d.tourDays ?? 1} day${(d.tourDays ?? 1) > 1 ? 's' : ''}`,
          tourDays: d.tourDays ?? 1,
        }))
      setDepartures(tourDates)
    })
    getExperiencesByTrail(trail.id).then(setExperiences)
  }, [trail.id])

  const diff = trail.difficulty
  const headerBg = TRAIL_COLOR[diff] || 'bg-[#2d6a4f]'

  // Honour admin-curated relatedTrailIds when present; otherwise fall back to
  // any two other published trails (cheapest automatic related-content signal).
  const related = (() => {
    const published = allTrails.filter(t => t.status === 'published')
    if ((trail.relatedTrailIds ?? []).length > 0) {
      const ids = new Set(trail.relatedTrailIds!)
      return published.filter(t => ids.has(t.id)).slice(0, 2)
    }
    return published.filter(t => t.id !== trail.id).slice(0, 2)
  })()

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      {/* Hero header */}
      <section className={`${headerBg} text-white py-20 px-6 lg:px-12 mt-16 relative overflow-hidden`}>
        {trail.image && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${trail.image})` }}
          />
        )}
        <div className="max-w-[1440px] mx-auto relative">
          <Link href="/hikes" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={16} /> All Trails
          </Link>
          {trail.analytics?.routeArtworkSvg && (
            <div className="pointer-events-none absolute right-0 top-1/2 hidden h-52 w-[42%] -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 p-8 md:flex">
              <RouteArtwork trail={trail} tone="light" className="h-full w-full opacity-90" />
            </div>
          )}
          <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">
                {trail.region}
                {' · '}{trailCategory(trail) === 'speciality_walk' && trail.speciality_type ? trail.speciality_type : CATEGORY_LABEL[trailCategory(trail)]}
              </p>
              <h1 className="font-display italic text-5xl lg:text-6xl mb-4">{trail.name}</h1>
              <p className="font-sans text-sm text-white/60">Starting point: {trail.trailhead}</p>
            </div>
            <span className="font-sans text-sm px-4 py-2 mt-2" style={{ color: DIFF_COLOR[diff], background: DIFF_BG[diff] }}>
              {diff}
            </span>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Mountain, label: 'Distance', value: trail.distance },
            { icon: TrendingUp, label: 'Elevation Gain', value: trail.elevation },
            { icon: Clock, label: 'Duration', value: trail.duration },
            { icon: Users, label: 'Difficulty', value: trail.difficulty },
          ].map(stat => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="flex items-center gap-3">
                <Icon size={20} className="text-[#C9A96E]" />
                <div>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{stat.label}</p>
                  <p className="font-display italic text-xl">{stat.value}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">

            {/* Description */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">About this Trail</h2>
              <ReadMoreText text={trail.description} />
            </div>

            {/* Trail highlights */}
            {(trail.highlights?.length ?? 0) > 0 && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Trail Highlights</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {trail.highlights!.map(item => (
                    <div key={item} className="flex items-start gap-2.5 bg-white border border-gray-200 px-4 py-3">
                      <Star size={14} className="text-[#C9A96E] mt-0.5 shrink-0" />
                      <span className="font-sans text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Route Profile — replaces the old "Interactive Route Planner".
                Renders for any trail with GPX track data (day hike,
                multi-day, or speciality walk alike), not just day hikes. */}
            {trail.analytics?.points.length ? (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Route Profile</h2>
                <RouteProfileChart trail={trail} />
                <div className="mt-6">
                  <RouteStats trail={trail} />
                </div>
              </div>
            ) : null}

            {/* Upcoming departures */}
            <UpcomingDepartures
              dates={departures}
              context="Guided departures and experiences on this trail"
              trailRegion={trail.region}
              customDatesHref={`/experiences/request?trail=${encodeURIComponent(trail.id)}`}
            />

            {/* Marketplace: upcoming trekking experiences on this trail */}
            <TrailExperiences trailId={trail.id} experiences={experiences} />

            {/* Multi-day breakdown */}
            {trail.is_multi_day && trail.days.length > 0 && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Daily Breakdown</h2>
                <div className="space-y-3">
                  {trail.days.map((day, i) => (
                    <div key={i} className="bg-white border border-gray-200 p-5">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-[#C9A96E] mb-1">Day {i + 1}</p>
                          <h3 className="font-display italic text-lg">{day.label}</h3>
                        </div>
                        <span className="font-sans text-xs px-3 py-1 shrink-0 mt-1" style={{ color: DIFF_COLOR[day.difficulty], background: DIFF_BG[day.difficulty] }}>
                          {day.difficulty}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-6 mb-3">
                        <div>
                          <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Distance</p>
                          <p className="font-display italic text-base">{day.distance || '—'}</p>
                        </div>
                        <div>
                          <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Elevation Gain</p>
                          <p className="font-display italic text-base">{day.elevation || '—'}</p>
                        </div>
                      </div>
                      {day.notes && (
                        <div className="font-sans text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3 whitespace-pre-line">{day.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gallery */}
            {(trail.gallery.length > 0 || trail.image) && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Gallery</h2>
                <div className="grid grid-cols-3 gap-2">
                  {/* Hero image as first gallery cell if no dedicated gallery */}
                  {trail.gallery.length === 0 && trail.image && (
                    <div
                      className="aspect-[4/3] bg-cover bg-center cursor-pointer col-span-3"
                      style={{ backgroundImage: `url(${trail.image})` }}
                      onClick={() => setLightboxImg(trail.image)}
                    />
                  )}
                  {trail.gallery.map((url, i) => (
                    <div
                      key={i}
                      className={`aspect-[4/3] bg-cover bg-center cursor-pointer hover:opacity-90 transition-opacity ${i === 0 && trail.gallery.length >= 3 ? 'col-span-2 row-span-2' : ''}`}
                      style={{ backgroundImage: `url(${url})` }}
                      onClick={() => setLightboxImg(url)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* What to bring */}
            {trail.what_to_bring.length > 0 && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">What to Bring</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {trail.what_to_bring.map((item: string) => (
                    <div key={item} className="flex items-start gap-2.5 bg-white border border-gray-200 px-4 py-3">
                      <CheckCircle size={14} className="text-[#2d6a4f] mt-0.5 shrink-0" />
                      <span className="font-sans text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Where to Stay */}
            {relatedProperties.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Bed size={18} className="text-[#C9A96E]" />
                  <h2 className="font-display italic text-2xl text-[#000000]">Where to Stay</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {relatedProperties.map(p => (
                    <Link
                      key={p.id}
                      href={`/stay/${p.slug || p.id}`}
                      className="block bg-white border border-gray-200 hover:border-[#C9A96E] transition-colors group overflow-hidden"
                    >
                      {p.photos?.[0] && (
                        <div
                          className="h-32 bg-cover bg-center"
                          style={{ backgroundImage: `url(${p.photos[0]})` }}
                        />
                      )}
                      <div className="p-4">
                        <p className="font-display italic text-lg text-[#000000] group-hover:text-[#2d6a4f] transition-colors mb-0.5">
                          {p.name}
                        </p>
                        <p className="font-sans text-xs text-gray-500">
                          {p.type}
                          {p.region ? ` · ${p.region}` : ''}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Things to Do Nearby */}
            {relatedActivities.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={18} className="text-[#C9A96E]" />
                  <h2 className="font-display italic text-2xl text-[#000000]">Things to Do Nearby</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {relatedActivities.map(a => (
                    <Link
                      key={a.id}
                      href={`/activities/${a.slug || a.id}`}
                      className="block bg-white border border-gray-200 hover:border-[#C9A96E] transition-colors group p-4"
                    >
                      <p className="font-display italic text-lg text-[#000000] group-hover:text-[#2d6a4f] transition-colors mb-0.5">
                        {a.name}
                      </p>
                      <p className="font-sans text-xs text-gray-500">
                        {a.category}
                        {a.durationH ? ` · ${a.durationH}h` : ''}
                        {a.region ? ` · ${a.region}` : ''}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Guides CTA */}
            <div className="bg-white border border-gray-200 p-6 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-display italic text-xl text-[#000000] mb-1">Looking for a guide?</h2>
                <p className="font-sans text-sm text-gray-500">Browse certified local guides who lead experiences on this trail.</p>
              </div>
              <Link href="/guides" className="shrink-0 border border-[#2d6a4f] text-[#2d6a4f] px-5 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
                Find a Guide →
              </Link>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-[#2d6a4f] text-white p-6">
              <h3 className="font-display italic text-xl mb-3">Book a Guided Experience</h3>
              <p className="font-sans text-sm text-white/70 mb-5">A certified guide transforms this trail. Includes permit, safety equipment and deep local knowledge.</p>
              <Link href="/guides" className="block text-center bg-[#C9A96E] text-[#2d2d2d] py-3 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors">
                Find a Guide →
              </Link>
              <Link
                href={`/experiences/request?trail=${encodeURIComponent(trail.id)}`}
                className="mt-3 flex items-center justify-center gap-2 border border-white/30 text-white py-3 font-sans text-sm hover:bg-white/10 transition-colors"
              >
                <CalendarPlus size={14} /> Book on Custom Dates
              </Link>
              <p className="font-sans text-[11px] text-white/50 mt-2 text-center">Request a private trip instead of joining a scheduled departure</p>
            </div>

            <div className="bg-white border border-gray-200 p-5">
              <h3 className="font-display italic text-xl mb-4">Trail Info</h3>
              <div className="space-y-3 font-sans text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Region</span><span className="text-right ml-4">{trail.region}</span></div>
                {trail.trail_type && (
                  <div className="flex justify-between"><span className="text-gray-400">Route type</span><span>{trail.trail_type}</span></div>
                )}
                <div className="flex justify-between"><span className="text-gray-400">Distance</span><span>{trail.distance}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Elevation</span><span>{trail.elevation}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Duration</span><span>{trail.duration}</span></div>
                {trail.is_multi_day && (
                  <div className="flex justify-between"><span className="text-gray-400">Days</span><span>{trail.days.length}</span></div>
                )}
                <div className="flex justify-between items-center"><span className="text-gray-400">Difficulty</span>
                  <span className="px-2.5 py-1 text-xs" style={{ color: DIFF_COLOR[diff], background: DIFF_BG[diff] }}>{diff}</span>
                </div>
                {trail.permit_required && (
                  <div className="flex justify-between"><span className="text-gray-400">Permit</span><span>{formatMoney(trail.permit_cost)} pp</span></div>
                )}
              </div>
            </div>

            {related.length > 0 && (
              <div>
                <h3 className="font-display italic text-xl text-[#000000] mb-4">Related Trails</h3>
                {related.map(r => (
                  <Link key={r.id} href={`/hikes/${r.id}`} className="block bg-white border border-gray-200 p-4 mb-3 hover:border-[#2d6a4f] transition-colors">
                    <p className="font-display italic text-lg mb-1">{r.name}</p>
                    <div className="flex items-center gap-3 font-sans text-xs text-gray-500">
                      <span>{r.distance}</span>
                      <span className="px-2 py-0.5" style={{ color: DIFF_COLOR[r.difficulty], background: DIFF_BG[r.difficulty] }}>{r.difficulty}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setLightboxImg(null)}>
            <X size={24} />
          </button>
          <img src={lightboxImg} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <Footer />
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import EditablePageHeader from '@/components/editor/EditablePageHeader'
import { X } from 'lucide-react'
import { getTrails, trailStartPoint, trailCategory, type Trail, type TrailCategory } from '@/lib/trails'
import { regionsMatch } from '@/lib/regions'
import { getReserves, type Reserve } from '@/lib/reserves'
import TrailExperiences from '@/components/experiences/TrailExperiences'
import { getUpcomingExperiences, type TrekkingExperience } from '@/lib/experiences'
import ExploreCard from '@/components/trails/ExploreCard'
import NewsletterSignup from '@/components/marketing/NewsletterSignup'
import { StayDistance } from '@/lib/stay-distance'
import { ROUTE_TYPES } from '@/lib/gpx'

const DIFF_COLOR: Record<string, string> = { Easy: '#4A7251', Moderate: '#C9A96E', Strenuous: '#c0392b', Extreme: '#7f1d1d' }
const DIFF_OPTS = ['All', 'Easy', 'Moderate', 'Strenuous', 'Extreme']
const TYPE_OPTS = ['All', ...ROUTE_TYPES]

const CATEGORY_TABS: { value: 'All' | TrailCategory; label: string }[] = [
  { value: 'All', label: 'All Hikes' },
  { value: 'day_hike', label: 'Day Hikes' },
  { value: 'multi_day_hike', label: 'Multi-Day Hikes' },
  { value: 'speciality_walk', label: 'Speciality Walks' },
]

function parseKm(distance: string): number {
  const m = distance.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : 0
}

export default function HikesPage() {
  const [trails, setTrails] = useState<Trail[]>([])
  const [experiences, setExperiences] = useState<TrekkingExperience[]>([])
  const [diff, setDiff] = useState('All')
  const [region, setRegion] = useState('All')
  const [routeType, setRouteType] = useState('All')
  const [maxDist, setMaxDist] = useState(250)
  const [category, setCategory] = useState<'All' | TrailCategory>('All')
  const [specialityType, setSpecialityType] = useState('All')
  // Set only via ?nature-reserves=<Reserve.id> (from a reserve's "View
  // Hikes" button) — a separate axis from the region dropdown above, since
  // a reserve can span, or be narrower than, a region.
  const [reserveId, setReserveId] = useState<string | null>(null)
  const [reserve, setReserve] = useState<Reserve | null>(null)

  useEffect(() => {
    getTrails().then(all => setTrails(all.filter(t => t.status === 'published')))
    getUpcomingExperiences().then(setExperiences)
    const params = new URLSearchParams(window.location.search)
    const regionParam = params.get('region')
    if (regionParam) setRegion(regionParam)
    // Pre-filters the category tabs from a nav link (e.g. Hikes ▸ Day Hikes
    // → /hikes?category=day_hike) — only a recognised CATEGORY_TABS value
    // is honoured, so a stray/old param can't land on a blank tab state.
    const categoryParam = params.get('category')
    if (CATEGORY_TABS.some(c => c.value === categoryParam)) setCategory(categoryParam as TrailCategory)
    const reserveParam = params.get('nature-reserves')
    if (reserveParam) {
      setReserveId(reserveParam)
      getReserves().then(all => setReserve(all.find(r => r.id === reserveParam) ?? null))
    }
  }, [])

  const regionOpts = ['All', ...Array.from(new Set(trails.map(t => t.region))).sort()]
  if (region !== 'All' && !regionOpts.includes(region)) regionOpts.push(region)

  const specialityWalks = trails.filter(t => trailCategory(t) === 'speciality_walk')
  const specialityTypeOpts = ['All', ...Array.from(new Set(specialityWalks.map(t => t.speciality_type).filter(Boolean))).sort() as string[]]

  const filtered = trails.filter(t =>
    (category === 'All' || trailCategory(t) === category) &&
    (category !== 'speciality_walk' || specialityType === 'All' || t.speciality_type === specialityType) &&
    (diff === 'All' || t.difficulty === diff) &&
    (region === 'All' || regionsMatch(t.region, region)) &&
    (routeType === 'All' || (t.trail_type || '') === routeType) &&
    (!reserveId || t.reserveId === reserveId) &&
    parseKm(t.distance) <= maxDist
  )

  // Marketplace departures grouped per trail, following the active filters.
  // Comparison stays scoped to one Trail ID, so each trail gets its own block.
  const experienceGroups = filtered
    .map(t => ({ trail: t, exps: experiences.filter(e => e.trailId === t.id) }))
    .filter(g => g.exps.length > 0)
    .sort((a, b) => a.exps[0].departureDate.localeCompare(b.exps[0].departureDate))

  const allKms = trails.map(t => parseKm(t.distance))
  const sliderMax = allKms.length ? Math.max(...allKms) : 250

  // Hero headline figure, straight off the published catalogue so it keeps
  // itself honest as trails are added. Rounded down to the nearest ten and
  // shown as "160+" once there are enough to round; below that the exact
  // count reads better than "0+".
  const trailCount = trails.length
  const trailCountLabel = trailCount >= 10 ? `${Math.floor(trailCount / 10) * 10}+` : String(trailCount)

  return (
    <main className="bg-mist min-h-screen pt-16">
      {/* Header */}
      <EditablePageHeader section="hikes_page">
        {trailCount > 0 && (
          <div className="mt-8 pt-8 border-t border-white/10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div>
              <p className="font-display text-4xl text-gold leading-none mb-2">{trailCountLabel}</p>
              <p className="font-sans text-sm text-white/50 max-w-md">
                recorded hikes across the Drakensberg — every one of them plannable and bookable through us.
              </p>
            </div>
            <div className="lg:text-right">
              <p className="font-sans text-sm text-white/70 mb-3">
                New trails are added all the time. Join the mailing list and we’ll email you as they land.
              </p>
              <NewsletterSignup
                source="hikes_hero"
                inputId="hikes-notify-email"
                label="Email address for new trail alerts"
                buttonLabel="Notify me"
                successMessage="You’re on the list — we’ll email you as new trails are added."
                tone="dark"
                className="lg:ml-auto"
              />
            </div>
          </div>
        )}
      </EditablePageHeader>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        {reserveId && (
          <div className="flex items-center justify-between gap-3 mb-5 bg-forest/5 border border-forest/15 px-4 py-2.5">
            <p className="font-sans text-sm text-forest/70">
              Filtered to trails in <span className="font-medium text-forest">{reserve?.name || 'this nature reserve'}</span>
            </p>
            <button
              onClick={() => { setReserveId(null); setReserve(null) }}
              className="inline-flex items-center gap-1 font-sans text-xs text-forest/50 hover:text-forest transition-colors"
            >
              <X size={12} /> Clear
            </button>
          </div>
        )}
        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-4 border-b border-black/8">
          {CATEGORY_TABS.map((c) => (
            <button
              key={c.value}
              onClick={() => { setCategory(c.value); setSpecialityType('All') }}
              className={`font-sans text-sm px-4 py-3 -mb-px border-b-2 transition-colors ${
                category === c.value ? 'border-forest text-forest' : 'border-transparent text-forest/40 hover:text-forest'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {category === 'speciality_walk' && specialityTypeOpts.length > 2 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {specialityTypeOpts.map((s) => (
              <button key={s} onClick={() => setSpecialityType(s)}
                className={`font-sans text-xs px-3 py-1.5 border transition-colors ${specialityType === s ? 'bg-gold border-gold text-forest' : 'bg-white border-black/15 text-forest/50 hover:border-gold'}`}>
                {s === 'All' ? 'All types' : s}
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex gap-2 flex-wrap">
            {DIFF_OPTS.map((d) => (
              <button key={d} onClick={() => setDiff(d)}
                className={`font-sans text-xs px-4 py-2 border transition-colors ${diff === d ? 'bg-forest border-forest text-white' : 'bg-white border-black/15 text-forest/60 hover:border-forest'}`}>
                {d}
              </button>
            ))}
          </div>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="font-sans text-xs border border-black/15 bg-white px-3 py-2 text-forest/70 focus:outline-none hover:border-forest transition-colors"
            aria-label="Filter by region"
          >
            {regionOpts.map((r) => <option key={r} value={r}>{r === 'All' ? 'All regions' : r}</option>)}
          </select>
          <select
            value={routeType}
            onChange={(e) => setRouteType(e.target.value)}
            className="font-sans text-xs border border-black/15 bg-white px-3 py-2 text-forest/70 focus:outline-none hover:border-forest transition-colors"
            aria-label="Filter by route type"
          >
            {TYPE_OPTS.map((t) => <option key={t} value={t}>{t === 'All' ? 'All route types' : t}</option>)}
          </select>
          <div className="flex items-center gap-3 ml-auto">
            <span className="font-sans text-xs text-forest/40">Max {maxDist} km</span>
            <input type="range" min={1} max={sliderMax} step={1} value={maxDist}
              onChange={(e) => setMaxDist(Number(e.target.value))}
              className="w-28 accent-forest" />
          </div>
          <p className="font-sans text-sm text-forest/50">
            <span className="text-forest font-medium">{filtered.length}</span> trails
          </p>
        </div>

        {trails.length === 0 ? (
          <div className="py-20 text-center font-sans text-sm text-forest/30">Loading trails…</div>
        ) : (
          <>
            {/* Table-style list */}
            <div className="bg-white border border-black/8 divide-y divide-black/6 mb-10">
              {filtered.map((t) => {
                const start = trailStartPoint(t)
                return (
                <Link key={t.id} href={`/hikes/${t.id}`}
                  className="group flex items-center gap-6 px-6 py-5 hover:bg-mist transition-colors">
                  <div className="w-20 h-14 shrink-0 overflow-hidden hidden sm:block">
                    <img src={t.image} alt={t.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg text-forest group-hover:text-sage transition-colors">{t.name}</h3>
                    <p className="font-sans text-xs text-forest/40 mt-0.5">
                      {t.region}{t.trail_type ? ` · ${t.trail_type}` : ''}
                      {trailCategory(t) === 'speciality_walk' && t.speciality_type ? ` · ${t.speciality_type}` : ''}
                      {trailCategory(t) === 'multi_day_hike' ? ' · Multi-day' : ''}
                    </p>
                    <StayDistance lat={start?.lat} lng={start?.lng} className="mt-0.5" />
                  </div>
                  <div className="hidden md:flex items-center gap-8 shrink-0">
                    <div className="text-center">
                      <p className="font-display text-base text-forest">{t.distance}</p>
                      <p className="font-sans text-[10px] text-forest/35 uppercase tracking-wide">Distance</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display text-base text-forest">{t.elevation}</p>
                      <p className="font-sans text-[10px] text-forest/35 uppercase tracking-wide">Elevation</p>
                    </div>
                    <div className="text-center">
                      <p className="font-sans text-xs font-medium" style={{ color: DIFF_COLOR[t.difficulty] }}>{t.difficulty}</p>
                      <p className="font-sans text-[10px] text-forest/35 uppercase tracking-wide">{t.duration}</p>
                    </div>
                    {t.permit_required && (
                      <span className="font-sans text-[10px] border border-gold text-gold px-2 py-0.5 uppercase tracking-wide">Permit</span>
                    )}
                  </div>
                  <span className="text-forest/20 group-hover:text-gold transition-colors shrink-0">→</span>
                </Link>
                )
              })}
              {filtered.length === 0 && (
                <div className="px-6 py-12 text-center font-sans text-sm text-forest/30">No trails match your filters</div>
              )}
            </div>

            {/* Card grid */}
            <div className="h-px bg-black/8 mb-10" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
              {filtered.map((t) => {
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
                  difficultyColor={DIFF_COLOR[t.difficulty]}
                  bottomRightBadge={trailCategory(t) === 'speciality_walk' ? t.speciality_type : undefined}
                  routeArtworkTrail={t}
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

            {/* Marketplace: upcoming trekking experiences across these trails */}
            {experienceGroups.length > 0 && (
              <>
                <div className="h-px bg-black/8 mt-12 mb-10" />
                <div className="mb-8">
                  <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-2">Marketplace</p>
                  <h2 className="font-display text-3xl text-forest leading-none mb-2">Upcoming Trekking Experiences</h2>
                  <p className="font-sans text-sm text-forest/50">
                    Commercial departures offered by marketplace suppliers on these trails — compare and book, or open a trail for the full route details
                  </p>
                </div>
                <div className="space-y-12">
                  {experienceGroups.map(({ trail, exps }) => (
                    <TrailExperiences
                      key={trail.id}
                      trailId={trail.id}
                      experiences={exps}
                      title={trail.name}
                      subtitle={`${trail.region} · ${trail.distance} · ${trail.difficulty}`}
                      titleHref={`/hikes/${trail.id}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
      <Footer />
    </main>
  )
}

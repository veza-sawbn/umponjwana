'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import { Calendar, Users, MapPin, ArrowRight, Search, SlidersHorizontal, X, Check, Bed, ChevronDown } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import { fuzzyFilter } from '@/lib/fuzzy'
import { getRegionNames, DEFAULT_REGIONS, regionsMatch } from '@/lib/regions'
import { getProperties, type Property } from '@/lib/properties'
import { getRoomsByProperty } from '@/lib/rooms'
import { getActivities, type Activity } from '@/lib/activities'
import { getTrails, trailStartPoint, type Trail } from '@/lib/trails'
import { getSupplierEntities } from '@/lib/supplier-entities'
import { StayDistance, useStayCoords, haversineKm } from '@/lib/stay-distance'
import { trackEvent, AnalyticsEvent } from '@/lib/analytics'
import { formatMoney } from '@/lib/allocation'

type LiveStay = {
  id: string
  title: string
  region: string
  price: number
  rating?: number
  reviews?: number
  img?: string
  available: boolean
  address?: string
  lat?: string
  lng?: string
}

type LiveActivity = {
  id: string
  title: string
  region: string
  price: number
  category: string
  img?: string
  gpsLat?: string
  gpsLng?: string
}

type LiveHike = {
  id: string
  title: string
  region: string
  distance: string
  difficulty: string
  duration: string
  img?: string
  lat?: string
  lng?: string
}

type LiveEvent = {
  id: string
  supplierId: string
  title: string
  location: string
  starts_at: string
  event_type: 'event' | 'special'
  ticket_price: number
  is_published: boolean
}

function propertyToLiveStay(p: Property, minPrice: number): LiveStay {
  return {
    id: p.id,
    title: p.name,
    region: p.region || '',
    price: minPrice,
    img: p.photos?.[0] || undefined,
    available: true,
    address: p.address || p.region || '',
    lat: p.gpsLat || undefined,
    lng: p.gpsLng || undefined,
  }
}

// Activities created before the region/photos fields existed won't have them set in Supabase.
function activityToLiveActivity(a: Activity): LiveActivity {
  return {
    id: a.id,
    title: a.name,
    region: a.region || '',
    price: a.pricePerPerson,
    category: a.category,
    img: a.photos?.[0] || undefined,
    gpsLat: a.gpsLat || undefined,
    gpsLng: a.gpsLng || undefined,
  }
}

function trailToLiveHike(t: Trail): LiveHike {
  const start = trailStartPoint(t)
  return {
    id: t.id,
    title: t.name,
    region: t.region,
    distance: t.distance,
    difficulty: t.difficulty,
    duration: t.duration,
    img: t.image || undefined,
    lat: start ? String(start.lat) : undefined,
    lng: start ? String(start.lng) : undefined,
  }
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

const DIFF_COLOR: Record<string, string> = { Easy: '#4A7251', Moderate: '#C9A96E', Strenuous: '#c0392b', Extreme: '#7f1d1d' }

function nights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return null
  const diff = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  return diff > 0 ? diff : null
}

function fmt(date: string) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

// Nearest-first once there's a real reference point (the selected stay);
// items without coordinates sink to the end rather than disappearing.
// Takes a coordinate extractor since categories name their lat/lng fields
// differently (LiveHike.lat/lng vs LiveActivity.gpsLat/gpsLng).
function sortByProximity<T>(
  items: T[],
  origin: { lat: number; lng: number } | null,
  coords: (item: T) => [string | undefined, string | undefined],
): T[] {
  if (!origin) return items
  return [...items].sort((a, b) => {
    const [aLat, aLng] = coords(a)
    const [bLat, bLng] = coords(b)
    const dA = aLat && aLng ? haversineKm(origin.lat, origin.lng, parseFloat(aLat), parseFloat(aLng)) : Infinity
    const dB = bLat && bLng ? haversineKm(origin.lat, origin.lng, parseFloat(bLat), parseFloat(bLng)) : Infinity
    return dA - dB
  })
}

// How many cards show per category before "View more" is needed.
const PREVIEW_COUNT = 3

/* ── Section wrappers ─────────────────────────────────────────────────────── */

function SectionHeader({ label, heading, count, href }: { label: string; heading: string; count: number; href?: string }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#C9A96E] mb-1">{label}</p>
        <h2 className="font-display italic text-2xl text-[#000000]">{heading}</h2>
      </div>
      {href ? (
        <Link href={href} className="font-sans text-xs text-[#2d6a4f] hover:underline hidden sm:block">
          See all ({count}) →
        </Link>
      ) : (
        <span className="font-sans text-xs text-gray-400 hidden sm:block">{count} in this area</span>
      )}
    </div>
  )
}

// Reveals the rest of a category's (already proximity-sorted) results —
// each section previews only its PREVIEW_COUNT closest items by default.
function ViewMoreButton({ total, expanded, onToggle }: { total: number; expanded: boolean; onToggle: () => void }) {
  if (total <= PREVIEW_COUNT) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-6 mx-auto flex items-center gap-1.5 font-sans text-sm font-medium text-[#2d6a4f] hover:text-[#C9A96E] transition-colors"
    >
      {expanded ? 'Show fewer' : `View all ${total}`}
      <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
    </button>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

function SearchResults() {
  const params = useSearchParams()
  const router = useRouter()
  const booking = useBooking()

  const regionParam = params.get('region') || booking.region || ''
  const checkInParam = params.get('check_in') || booking.checkIn || ''
  const checkOutParam = params.get('check_out') || booking.checkOut || ''
  const guestsParam = parseInt(params.get('guests') || String(booking.guests) || '2')
  const queryParam = params.get('q') || ''

  const [query, setQuery] = useState(queryParam)
  const [region, setRegion] = useState(regionParam)
  const [checkIn, setCheckIn] = useState(checkInParam)
  const [checkOut, setCheckOut] = useState(checkOutParam)
  const [guests, setGuests] = useState(guestsParam)
  const [showFilters, setShowFilters] = useState(false)
  const [regionOptions, setRegionOptions] = useState(DEFAULT_REGIONS.map(r => r.name))
  const [availableOnly, setAvailableOnly] = useState(false)
  const [liveStays, setLiveStays] = useState<LiveStay[]>([])
  const [liveActivities, setLiveActivities] = useState<LiveActivity[]>([])
  const [liveHikes, setLiveHikes] = useState<LiveHike[]>([])
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    getRegionNames().then(setRegionOptions)
  }, [])

  // Seed the shared booking context from the URL on first load, so the booking bar / shuttle
  // suggestions have the right dates even if the visitor lands here directly without clicking "Update".
  useEffect(() => {
    if (regionParam || checkInParam || checkOutParam) {
      booking.setSearch(regionParam, checkInParam, checkOutParam, guestsParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    getProperties().then(async props => {
      const active = props.filter(p => p.status === 'active')
      const cards = await Promise.all(active.map(async p => {
        const rooms = await getRoomsByProperty(p.id)
        const minPrice = rooms.length > 0 ? Math.min(...rooms.map(r => r.basePrice)) : 0
        return propertyToLiveStay(p, minPrice)
      }))
      setLiveStays(cards)
    })
    getActivities().then(items => {
      setLiveActivities(items.filter(a => a.status === 'active').map(activityToLiveActivity))
    })
    getTrails().then(trails => {
      setLiveHikes(trails.filter(t => t.status === 'published').map(trailToLiveHike))
    })
    getSupplierEntities<any>('events').then((all: LiveEvent[]) => {
      const now = new Date().toISOString()
      // RLS already hides drafts from the public; filtering defensively in
      // case a signed-in supplier is browsing and sees their own drafts too.
      setLiveEvents(all.filter(e => e.is_published && e.starts_at >= now))
    }).catch(() => setLiveEvents([]))
  }, [])

  const numNights = nights(checkIn, checkOut)

  function refine() {
    booking.setSearch(region, checkIn, checkOut, guests)
    const p = new URLSearchParams()
    if (query.trim()) p.set('q', query.trim())
    if (region) p.set('region', region)
    if (checkIn) p.set('check_in', checkIn)
    if (checkOut) p.set('check_out', checkOut)
    p.set('guests', String(guests))
    router.push(`/search?${p.toString()}`)
    trackEvent(AnalyticsEvent.SEARCH_PERFORMED, {
      query: query.trim() || null, region: region || null,
      check_in: checkIn || null, check_out: checkOut || null, guests,
    })
  }

  // Once a stay is selected, every suggestion below is scoped to ITS region
  // (not whatever is still typed into the region field) — that's the region
  // the visitor is actually going to be in.
  const effectiveRegion = booking.stay?.region || region

  function matchRegion(r: string) {
    if (!effectiveRegion) return true
    return regionsMatch(r, effectiveRegion)
  }

  // Region narrows first; the free-text query then fuzzy-matches (typo- and
  // partial-match tolerant) across titles, regions and categories.
  const q = query.trim()
  // A stay is already selected: this is no longer an accommodation search,
  // so don't suggest alternatives — show only the one the visitor picked.
  const stays = booking.stay
    ? liveStays.filter(s => s.id === booking.stay!.id)
    : fuzzyFilter(liveStays.filter(s => matchRegion(s.region) && (!availableOnly || s.available)), q, s => `${s.title} ${s.region}`)
  const hikes = fuzzyFilter(
    liveHikes.filter(h => matchRegion(h.region)),
    q, h => `${h.title} ${h.region} ${h.difficulty} hike trail`,
  )
  const activities = fuzzyFilter(
    liveActivities.filter(a => matchRegion(a.region)),
    q, a => `${a.title} ${a.region} ${a.category}`,
  )
  const events = fuzzyFilter(
    liveEvents.filter(e => matchRegion(e.location)),
    q, e => `${e.title} ${e.location} event`,
  )

  // Once a stay is chosen, everything below it is quite literally "what's
  // closest to where you're staying" — sorted nearest-first from there.
  // Events carry no coordinates, so they keep their existing order.
  const stayOrigin = useStayCoords()
  const sortedHikes = sortByProximity(hikes, stayOrigin, h => [h.lat, h.lng])
  const sortedActivities = sortByProximity(activities, stayOrigin, a => [a.gpsLat, a.gpsLng])

  const hasResults = stays.length + hikes.length + activities.length + events.length > 0

  // Each category previews its closest PREVIEW_COUNT by default; a new
  // search (region/query change) collapses everything back down rather
  // than leaving a stale expanded section from the previous results.
  const [expandStays, setExpandStays] = useState(false)
  const [expandHikes, setExpandHikes] = useState(false)
  const [expandActivities, setExpandActivities] = useState(false)
  const [expandEvents, setExpandEvents] = useState(false)
  useEffect(() => {
    setExpandStays(false); setExpandHikes(false); setExpandActivities(false); setExpandEvents(false)
  }, [effectiveRegion, q])

  const visibleStays = expandStays ? stays : stays.slice(0, PREVIEW_COUNT)
  const visibleHikes = expandHikes ? sortedHikes : sortedHikes.slice(0, PREVIEW_COUNT)
  const visibleActivities = expandActivities ? sortedActivities : sortedActivities.slice(0, PREVIEW_COUNT)
  const visibleEvents = expandEvents ? events : events.slice(0, PREVIEW_COUNT)

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      {/* Sticky search refinement bar — once a stay is picked the page below
          becomes trip suggestions rather than a search, so on mobile (where
          screen space is tight) the search controls get out of the way;
          desktop keeps it visible so the search can still be refined. */}
      <div className={`bg-white border-b border-gray-200 mt-16 sticky top-16 z-30 ${booking.stay ? 'hidden md:block' : ''}`}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Free-text query */}
            <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 bg-[#F7F5F2] flex-1 min-w-[180px] max-w-xs">
              <Search size={12} className="text-gray-400 shrink-0" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') refine() }}
                placeholder="Lodge, hike, activity…"
                aria-label="Search by name"
                className="w-full font-sans text-sm bg-transparent focus:outline-none"
              />
            </div>

            {/* Region */}
            <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 bg-[#F7F5F2]">
              <MapPin size={12} className="text-gray-400" />
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="font-sans text-sm bg-transparent focus:outline-none"
              >
                <option value="">All Drakensberg</option>
                {regionOptions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 bg-[#F7F5F2]">
              <Calendar size={12} className="text-gray-400" />
              <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} min={today}
                className="font-sans text-sm bg-transparent focus:outline-none" />
              <span className="text-gray-300">→</span>
              <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} min={checkIn || today}
                className="font-sans text-sm bg-transparent focus:outline-none" />
            </div>

            {/* Guests */}
            <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 bg-[#F7F5F2]">
              <Users size={12} className="text-gray-400" />
              <button onClick={() => setGuests(g => Math.max(1, g - 1))} aria-label="Remove one guest" className="text-gray-400 hover:text-[#2d6a4f] font-bold w-4 text-center">−</button>
              <span className="font-sans text-sm min-w-[2ch] text-center" aria-live="polite">{guests}</span>
              <button onClick={() => setGuests(g => g + 1)} aria-label="Add one guest" className="text-gray-400 hover:text-[#2d6a4f] font-bold w-4 text-center">+</button>
              <span className="font-sans text-xs text-gray-400">guests</span>
            </div>

            <button
              onClick={refine}
              className="bg-[#2d6a4f] text-white px-5 py-2 font-sans text-sm hover:bg-[#235a3f] transition-colors flex items-center gap-1.5"
            >
              <Search size={13} /> Update
            </button>

            <button
              onClick={() => setShowFilters(v => !v)}
              className={`ml-auto flex items-center gap-1.5 px-4 py-2 border font-sans text-xs transition-colors ${showFilters ? 'border-[#2d6a4f] text-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 text-gray-600 hover:border-[#2d6a4f]'}`}
            >
              <SlidersHorizontal size={13} /> Filters
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4 items-center">
              <label className="flex items-center gap-2 font-sans text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={availableOnly} onChange={e => {
                  setAvailableOnly(e.target.checked)
                  trackEvent(AnalyticsEvent.FILTER_USED, { filter: 'available_only', value: e.target.checked })
                }} className="accent-[#2d6a4f]" />
                Available stays only
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Results summary */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 pt-10 pb-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-display italic text-3xl text-[#000000]">
            {queryParam ? `“${queryParam}”` : (effectiveRegion || 'All Drakensberg')}
          </h1>
          {queryParam && (
            <span className="font-sans text-sm text-gray-500">in {effectiveRegion || 'All Drakensberg'}</span>
          )}
          {booking.stay && (
            <span className="font-sans text-sm text-[#2d6a4f]">· suggestions for your stay at {booking.stay.title}</span>
          )}
          {(checkIn || checkOut) && (
            <span className="font-sans text-sm text-gray-500">
              {fmt(checkIn)} {checkOut && `→ ${fmt(checkOut)}`}
              {numNights && ` · ${numNights} night${numNights !== 1 ? 's' : ''}`}
            </span>
          )}
          {guests > 0 && (
            <span className="font-sans text-sm text-gray-500">· {guests} guest{guests !== 1 ? 's' : ''}</span>
          )}
        </div>
        {!hasResults && (
          <p className="font-sans text-sm text-gray-500 mt-2">No results found. Try a different region or remove filters.</p>
        )}
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-20 space-y-16">

        {/* ── Accommodation ── */}
        {stays.length > 0 && (
          <section>
            {booking.stay ? (
              <SectionHeader label="Your stay" heading="Selected Accommodation" count={stays.length} />
            ) : (
              <SectionHeader label="Where to sleep" heading="Accommodation" count={stays.length} href="/stays" />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleStays.map(stay => {
                const isSelected = booking.stay?.id === stay.id
                return (
                  <div key={stay.id} className={`group bg-white flex flex-col ${!stay.available ? 'opacity-60' : ''} border ${isSelected ? 'border-[#2d6a4f]' : 'border-transparent'}`}>
                    <Link href={`/stays/${stay.id}?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}`}>
                      <div className="aspect-[4/3] overflow-hidden relative bg-[#2d6a4f]/10">
                        {stay.img ? (
                          <img src={stay.img} alt={stay.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-display italic text-lg text-[#2d6a4f]/40">{stay.title}</span>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-3 left-3 bg-[#2d6a4f] text-white font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 flex items-center gap-1">
                            <Check size={10} /> Selected
                          </div>
                        )}
                        {!stay.available && (
                          <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                            <span className="bg-white font-sans text-xs px-3 py-1.5 border border-gray-300 text-gray-500">Unavailable for these dates</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{stay.region}</span>
                          {stay.rating ? (
                            <span className="font-sans text-xs text-[#2d6a4f]">★ {stay.rating} <span className="text-gray-400">({stay.reviews ?? 0})</span></span>
                          ) : null}
                        </div>
                        <h3 className="font-display italic text-lg mb-2">{stay.title}</h3>
                        <div className="flex items-end justify-between">
                          {stay.price > 0 ? (
                            <>
                              <span className="font-sans text-xs text-gray-400">
                                {numNights ? `${formatMoney(stay.price * numNights)} total` : 'From'}
                              </span>
                              <p className="font-display italic text-xl text-[#2d6a4f]">
                                {formatMoney(stay.price)}<span className="font-sans text-xs text-gray-400">/night</span>
                              </p>
                            </>
                          ) : (
                            <span className="font-sans text-xs text-gray-400">Contact for rates</span>
                          )}
                        </div>
                      </div>
                    </Link>
                    {stay.available && (
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => isSelected
                            ? booking.setStay(null)
                            : booking.setStay({ id: stay.id, title: stay.title, region: stay.region, price_per_night: stay.price, img: stay.img, address: (stay as LiveStay).address, lat: (stay as LiveStay).lat, lng: (stay as LiveStay).lng })
                          }
                          className={`w-full py-2.5 font-sans text-sm transition-colors flex items-center justify-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#2d6a4f] text-white hover:bg-red-600'
                              : 'border border-[#2d6a4f] text-[#2d6a4f] hover:bg-[#2d6a4f] hover:text-white'
                          }`}
                        >
                          {isSelected ? <><X size={13} /> Remove</> : <><Bed size={13} /> Select this Stay</>}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <ViewMoreButton total={stays.length} expanded={expandStays} onToggle={() => setExpandStays(v => !v)} />
            <div className="mt-4 sm:hidden">
              <Link href="/stays" className="font-sans text-sm text-[#2d6a4f]">See all accommodation →</Link>
            </div>
          </section>
        )}

        {/* ── Hikes ── */}
        {hikes.length > 0 && (
          <section>
            <SectionHeader label="On foot" heading="Hikes & Trails" count={hikes.length} href="/hikes" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleHikes.map(h => (
                <Link key={h.id} href={`/hikes/${h.id}`} className="group bg-white">
                  <div className="aspect-[4/3] overflow-hidden relative bg-[#2d6a4f]/10">
                    {h.img ? (
                      <img loading="lazy" decoding="async" src={h.img} alt={h.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-display italic text-lg text-[#2d6a4f]/40">{h.title}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h.region}</span>
                      <span className="font-sans text-xs px-2 py-0.5" style={{ color: DIFF_COLOR[h.difficulty], background: DIFF_COLOR[h.difficulty] + '20' }}>{h.difficulty}</span>
                    </div>
                    <h3 className="font-display italic text-lg mb-2">{h.title}</h3>
                    <StayDistance lat={h.lat} lng={h.lng} className="mb-1" />
                    <p className="font-sans text-xs text-gray-400">{h.distance} · {h.duration}</p>
                  </div>
                </Link>
              ))}
            </div>
            <ViewMoreButton total={hikes.length} expanded={expandHikes} onToggle={() => setExpandHikes(v => !v)} />
          </section>
        )}

        {/* ── Activities ── */}
        {activities.length > 0 && (
          <section>
            <SectionHeader label="Things to do" heading="Activities & Experiences" count={activities.length} href="/activities" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleActivities.map(a => (
                <Link key={a.id} href={`/activities/${a.id}`} className="group bg-white">
                  <div className="aspect-[4/3] overflow-hidden relative bg-[#C9A96E]/10">
                    {a.img ? (
                      <img loading="lazy" decoding="async" src={a.img} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-display italic text-lg text-[#C9A96E]/50">{a.title}</span>
                      </div>
                    )}
                    {a.category && <span className="absolute top-3 left-3 bg-black/60 text-white font-sans text-[10px] tracking-[0.12em] uppercase px-2.5 py-1">{a.category}</span>}
                  </div>
                  <div className="p-4">
                    <span className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{a.region}</span>
                    <h3 className="font-display italic text-lg mt-1 mb-2">{a.title}</h3>
                    <StayDistance lat={a.gpsLat} lng={a.gpsLng} className="mb-2" />
                    {a.price > 0 ? (
                      <p className="font-display italic text-xl text-[#2d6a4f]">{formatMoney(a.price)} <span className="font-sans text-xs text-gray-400">pp</span></p>
                    ) : (
                      <p className="font-sans text-xs text-gray-400">Contact for pricing</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <ViewMoreButton total={activities.length} expanded={expandActivities} onToggle={() => setExpandActivities(v => !v)} />
          </section>
        )}

        {/* ── Events ── */}
        {events.length > 0 && (
          <section>
            <SectionHeader label="What's on" heading="Events & Specials" count={events.length} href="/events" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {visibleEvents.map(ev => (
                <Link key={ev.id} href="/events" className="group bg-white">
                  <div className={`aspect-[3/2] overflow-hidden flex items-center justify-center ${ev.event_type === 'special' ? 'bg-[#2d6a4f]' : 'bg-[#1a1a2e]'}`}>
                    <span className="font-display italic text-lg text-white/70 px-4 text-center">{ev.title}</span>
                  </div>
                  <div className="p-4">
                    <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-[#C9A96E] mb-1">{fmt(ev.starts_at)}</p>
                    <h3 className="font-display italic text-base mb-1 group-hover:text-[#2d6a4f] transition-colors">{ev.title}</h3>
                    {ev.location && <p className="font-sans text-xs text-gray-400 mb-2">{ev.location}</p>}
                    <p className="font-display italic text-lg text-[#2d6a4f]">{formatMoney(ev.ticket_price)}</p>
                  </div>
                </Link>
              ))}
            </div>
            <ViewMoreButton total={events.length} expanded={expandEvents} onToggle={() => setExpandEvents(v => !v)} />
          </section>
        )}

      </main>
      <Footer />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  )
}

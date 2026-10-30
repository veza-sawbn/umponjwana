'use client'
import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BedDouble, BusFront, ChevronDown, Compass, Footprints, Route, type LucideIcon } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import { PROPERTY_TYPES, propertyTypeSlug } from '@/lib/properties'
import { DEFAULT_REGIONS } from '@/lib/regions'
import { ROUTE_TYPES } from '@/lib/gpx'
import { ACTIVITY_CATEGORIES } from '@/lib/activities'
import { PACKAGE_CATEGORIES, PACKAGE_CATEGORY_LABELS } from '@/lib/packages'
import { MAJOR_HUBS } from '@/lib/shuttle-service'
import { getTowns, DEFAULT_TOWNS, type Town } from '@/lib/towns'
import { publicSupabase } from '@/lib/supabase-public'
import type { Trail } from '@/lib/trails'

/* ─── Trip-planning tools ───────────────────────────────────────────────────
   A forest panel of five stacked rows; one opens at a time and reveals a
   short search form. Submitting never searches or books here — it navigates
   to the existing listing page with the query parameters that page reads:

     Stays       → /stays?type=&region=&check_in=&guests=   (+ booking context, as /plan does)
     Hikes       → /hikes?route_type=&difficulty=&region=&category=
     Activities  → /activities?category=&region=
     Transfers   → /shuttles?from=&to=&date=&passengers=   (prefills its quote form)
     Packages    → /packages?category=

   Colours are the platform's own tokens (bg-forest, gold, white tints). */

const REGION_NAMES = DEFAULT_REGIONS.map(r => r.name)
const HIKE_DIFFICULTIES: Trail['difficulty'][] = ['Easy', 'Moderate', 'Strenuous', 'Extreme']
// /hikes' duration-based category tabs.
const HIKE_DURATIONS = [
  { value: 'day_hike', label: 'Day hikes' },
  { value: 'multi_day_hike', label: 'Multi-day hikes' },
]
const GUEST_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)
// /shuttles clamps passengers to 1–20.
const PASSENGER_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1)

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function withQuery(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '')).toString()
  return qs ? `${path}?${qs}` : path
}

/* ── Field primitives ── */

type Option = { value: string; label: string }

// Sized to common form guidance: ~64px fields on mobile, ~76px on desktop,
// and 16px control text everywhere (smaller makes iOS Safari zoom on focus).
const fieldBox =
  'relative flex flex-col justify-center min-w-0 min-h-[64px] lg:min-h-[76px] border border-white/15 px-4 py-3 lg:px-5 lg:py-3.5 transition-colors focus-within:border-gold'
const fieldLabel = 'block font-sans text-[11px] lg:text-xs font-medium tracking-[0.12em] uppercase text-white/60'
const fieldControl =
  'block w-full min-h-[24px] bg-transparent border-0 p-0 font-sans text-base leading-6 text-white focus:outline-none mt-1.5'

function SelectField({
  id, label, value, onChange, options, placeholder, required,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className={fieldBox}>
      <label htmlFor={id} className={fieldLabel}>{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          required={required}
          onChange={e => onChange(e.target.value)}
          className={`${fieldControl} appearance-none pr-8 truncate cursor-pointer`}
        >
          {placeholder !== undefined && <option value="" className="text-black">{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value} className="text-black">{o.label}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-white/80" />
      </div>
    </div>
  )
}

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className={fieldBox}>
      <label htmlFor={id} className={fieldLabel}>{label}</label>
      <input
        id={id}
        type="date"
        value={value}
        min={todayIso()}
        onChange={e => onChange(e.target.value)}
        className={`${fieldControl} appearance-none [color-scheme:dark]`}
      />
    </div>
  )
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="mt-5 lg:mt-6 w-full sm:w-auto h-12 lg:h-14 px-8 lg:px-10 bg-gold hover:bg-brown-600 text-forest font-sans font-semibold text-base transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {children}
    </button>
  )
}

const fieldGrid = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4'
const regionOptions: Option[] = REGION_NAMES.map(r => ({ value: r, label: r }))

/* ── Row forms ── */

function StaysForm({ idBase }: { idBase: string }) {
  const router = useRouter()
  const booking = useBooking()
  const [type, setType] = useState('')
  const [region, setRegion] = useState(booking.region && REGION_NAMES.includes(booking.region) ? booking.region : '')
  const [checkIn, setCheckIn] = useState(booking.checkIn || '')
  const [guests, setGuests] = useState(String(booking.guests || 2))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    // Same hand-off as the /plan trip planner: dates and guests go into the
    // shared booking context the stay pages read, region/type into the URL.
    // Skipped when the trip already holds a stay — its nights (and so its
    // price) come from those dates, same rule /shuttles follows.
    if (!booking.stay) {
      const keepCheckOut = booking.checkOut && checkIn && booking.checkOut > checkIn ? booking.checkOut : ''
      booking.setSearch(region, checkIn, keepCheckOut, Number(guests))
    }
    router.push(withQuery('/stays', { type, region, check_in: checkIn, guests }))
  }

  return (
    <form onSubmit={submit}>
      <div className={fieldGrid}>
        <SelectField id={`${idBase}-type`} label="Stay type" value={type} onChange={setType} placeholder="All accommodation"
          options={PROPERTY_TYPES.map(t => ({ value: propertyTypeSlug(t), label: t }))} />
        <SelectField id={`${idBase}-region`} label="Region" value={region} onChange={setRegion} placeholder="All regions" options={regionOptions} />
        <DateField id={`${idBase}-checkin`} label="Check in" value={checkIn} onChange={setCheckIn} />
        <SelectField id={`${idBase}-guests`} label="Guests" value={guests} onChange={setGuests}
          options={GUEST_OPTIONS.map(n => ({ value: String(n), label: `${n} guest${n === 1 ? '' : 's'}` }))} />
      </div>
      <SubmitButton>Search stays</SubmitButton>
    </form>
  )
}

function HikesForm({ idBase }: { idBase: string }) {
  const router = useRouter()
  const [routeType, setRouteType] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [region, setRegion] = useState('')
  const [duration, setDuration] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    router.push(withQuery('/hikes', { route_type: routeType, difficulty, region, category: duration }))
  }

  return (
    <form onSubmit={submit}>
      <div className={fieldGrid}>
        <SelectField id={`${idBase}-type`} label="Trail type" value={routeType} onChange={setRouteType} placeholder="All trails"
          options={ROUTE_TYPES.map(t => ({ value: t, label: t }))} />
        <SelectField id={`${idBase}-difficulty`} label="Difficulty" value={difficulty} onChange={setDifficulty} placeholder="Any difficulty"
          options={HIKE_DIFFICULTIES.map(d => ({ value: d, label: d }))} />
        <SelectField id={`${idBase}-region`} label="Region" value={region} onChange={setRegion} placeholder="All regions" options={regionOptions} />
        <SelectField id={`${idBase}-duration`} label="Duration" value={duration} onChange={setDuration} placeholder="Any duration" options={HIKE_DURATIONS} />
      </div>
      <SubmitButton>Find a trail</SubmitButton>
    </form>
  )
}

function ActivitiesForm({ idBase }: { idBase: string }) {
  const router = useRouter()
  const [category, setCategory] = useState('')
  const [region, setRegion] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    router.push(withQuery('/activities', { category, region }))
  }

  return (
    <form onSubmit={submit}>
      <div className={fieldGrid}>
        <SelectField id={`${idBase}-category`} label="Experience" value={category} onChange={setCategory} placeholder="All experiences"
          options={ACTIVITY_CATEGORIES.map(c => ({ value: c, label: c }))} />
        <SelectField id={`${idBase}-region`} label="Region" value={region} onChange={setRegion} placeholder="All regions" options={regionOptions} />
      </div>
      <SubmitButton>Explore activities</SubmitButton>
    </form>
  )
}

function TransportForm({ idBase }: { idBase: string }) {
  const router = useRouter()
  const booking = useBooking()
  // Live towns only (Admin → Towns). Starts empty: getTowns()' built-in
  // DEFAULT_TOWNS fallback is never offered as if it were live data.
  const [towns, setTowns] = useState<Town[]>([])
  const [townsLoaded, setTownsLoaded] = useState(false)
  const [from, setFrom] = useState(MAJOR_HUBS[0].name)
  const [to, setTo] = useState('')
  const [date, setDate] = useState(booking.checkIn || '')
  // Start from the trip's party size (clamped to /shuttles' 1–20), as the
  // direct /shuttles flow does — the URL value takes precedence there, so a
  // hard-coded 1 would quote a multi-guest trip for one passenger.
  const [passengers, setPassengers] = useState(String(Math.min(20, Math.max(1, booking.guests || 1))))

  useEffect(() => {
    getTowns(publicSupabase)
      .then(all => { if (all !== DEFAULT_TOWNS) setTowns(all) })
      .catch(() => {})
      .finally(() => setTownsLoaded(true))
  }, [])

  const townOptions: Option[] = [...towns]
    .sort((a, b) => a.name.localeCompare(b.name))
    // The value is what /shuttles hands Google's distance lookup, so it
    // carries the country (several of these names exist abroad too).
    .map(t => ({ value: `${t.name}, South Africa`, label: t.name }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    // /shuttles prefills its quote form from these; the quote itself runs there.
    router.push(withQuery('/shuttles', { from, to, date, passengers }))
  }

  return (
    <form onSubmit={submit}>
      <div className={fieldGrid}>
        <SelectField id={`${idBase}-from`} label="From" value={from} onChange={setFrom}
          options={[...MAJOR_HUBS.map(h => ({ value: h.name, label: h.name })), ...townOptions]} />
        <SelectField id={`${idBase}-to`} label="To" value={to} onChange={setTo} placeholder={townsLoaded ? (townOptions.length ? 'Choose a town' : 'No towns available') : 'Loading towns…'} required options={townOptions} />
        <DateField id={`${idBase}-date`} label="Date" value={date} onChange={setDate} />
        <SelectField id={`${idBase}-passengers`} label="Passengers" value={passengers} onChange={setPassengers}
          options={PASSENGER_OPTIONS.map(n => ({ value: String(n), label: `${n} passenger${n === 1 ? '' : 's'}` }))} />
      </div>
      <SubmitButton>Find transport</SubmitButton>
    </form>
  )
}

function PackagesForm({ idBase }: { idBase: string }) {
  const router = useRouter()
  const [category, setCategory] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    router.push(withQuery('/packages', { category }))
  }

  return (
    <form onSubmit={submit}>
      <div className={fieldGrid}>
        <SelectField id={`${idBase}-category`} label="Package type" value={category} onChange={setCategory} placeholder="All packages"
          options={PACKAGE_CATEGORIES.map(c => ({ value: c, label: PACKAGE_CATEGORY_LABELS[c] }))} />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-x-8">
        <SubmitButton>Browse packages</SubmitButton>
        <Link
          href="/plan"
          className="mt-5 lg:mt-6 inline-flex items-center gap-2 font-sans text-base text-gold hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Build your own itinerary <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </form>
  )
}

/* ── Accordion ── */

type Row = { id: string; title: string; icon: LucideIcon; Form: (p: { idBase: string }) => JSX.Element }

const ROWS: Row[] = [
  { id: 'stays', title: 'Find a Stay', icon: BedDouble, Form: StaysForm },
  { id: 'hikes', title: 'Hikes & Trails', icon: Footprints, Form: HikesForm },
  { id: 'activities', title: 'Activities & Tours', icon: Compass, Form: ActivitiesForm },
  { id: 'transport', title: 'Transport & Transfers', icon: BusFront, Form: TransportForm },
  { id: 'packages', title: 'Packages & Itineraries', icon: Route, Form: PackagesForm },
]

export default function TripPlanningTools() {
  const baseId = useId()
  const [openId, setOpenId] = useState<string | null>(null)
  const headerRefs = useRef<(HTMLButtonElement | null)[]>([])

  // WAI-ARIA accordion pattern: arrow keys / Home / End move between headers.
  function onHeaderKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = ROWS.length - 1
    const target =
      e.key === 'ArrowDown' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowUp' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (target === null) return
    e.preventDefault()
    headerRefs.current[target]?.focus()
  }

  return (
    <section aria-labelledby={`${baseId}-heading`} className="bg-forest">
      <h2 id={`${baseId}-heading`} className="sr-only">Plan your trip</h2>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-[69px] pt-6 lg:pt-10">
        {ROWS.map((row, index) => {
          const isOpen = openId === row.id
          const headerId = `${baseId}-${row.id}-header`
          const panelId = `${baseId}-${row.id}-panel`
          const Icon = row.icon
          return (
            <div key={row.id} className={`border-b border-white/10 transition-colors ${isOpen ? 'bg-white/[0.06]' : ''}`}>
              <h3>
                <button
                  ref={el => { headerRefs.current[index] = el }}
                  id={headerId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenId(isOpen ? null : row.id)}
                  onKeyDown={e => onHeaderKeyDown(e, index)}
                  className="group w-full flex items-center min-h-[60px] lg:min-h-[80px] py-3 px-4 lg:pl-8 lg:pr-8 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold"
                >
                  <Icon aria-hidden="true" strokeWidth={1.5} className="w-5 h-5 shrink-0 text-gold" />
                  <span className="ml-4 lg:ml-6 flex-1 min-w-0 font-sans font-semibold text-lg lg:text-[22px] text-white">
                    {row.title}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`w-5 h-5 shrink-0 text-white transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </h3>
              <div id={panelId} role="region" aria-labelledby={headerId} hidden={!isOpen} className="px-4 lg:px-8 pt-1 pb-6 lg:pb-8">
                {isOpen && <row.Form idBase={`${baseId}-${row.id}`} />}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

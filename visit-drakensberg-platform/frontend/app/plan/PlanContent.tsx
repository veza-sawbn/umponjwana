'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Calendar, Users, MapPin, Compass, Loader2 } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import Editable from '@/components/editor/Editable'
import { useSiteSection } from '@/lib/use-site-section'
import { useBooking } from '@/lib/booking-context'
import { getRegionNames } from '@/lib/regions'
import { getRecommendations, type Recommendation } from '@/lib/recommendations'
import { getUser } from '@/lib/auth'
import { formatMoney } from '@/lib/allocation'

const TRIP_TYPES = [
  {
    title: '3-Day Weekend',
    label: 'Quick escape',
    desc: 'A long weekend is enough for a single region — stay at Champagne Valley, do the Monk\'s Cowl trail, and see rock art at Injasuti.',
    itinerary: ['Day 1: Arrive, settle in, afternoon walk', 'Day 2: Full day hike — Monk\'s Cowl or Cathedral Ridge', 'Day 3: Rock art & leisurely return'],
    // /stays honors region/check_in/check_out/guests — carry across whatever
    // the visitor has entered in the builder above instead of a fixed link.
    href: '/stays',
    searchable: true,
  },
  {
    title: '7-Day Classic',
    label: 'Full experience',
    desc: 'A week lets you cover two regions and include a Sani Pass day-trip. The standard Drakensberg holiday.',
    itinerary: ['Day 1–3: Northern Berg — Amphitheatre, Tugela Falls', 'Day 4: Transfer to Central Berg', 'Day 5–6: Cathedral Peak, Giants Castle', 'Day 7: Sani Pass day trip, depart'],
    href: '/packages',
    searchable: false,
  },
  {
    title: '14-Day Deep Dive',
    label: 'Grand traverse',
    desc: 'For serious hikers: cover the full escarpment from north to south, including the 5-day Grand Traverse route.',
    itinerary: ['Day 1–2: Acclimatise, Royal Natal', 'Day 3–7: Grand Traverse (Sentinel to Garden Castle)', 'Day 8–10: Central Berg & rock art', 'Day 11–14: Southern Berg, Sani Pass, rest'],
    href: '/packages',
    searchable: false,
  },
]

export default function PlanContent() {
  const c = useSiteSection('plan_page') as unknown as Record<string, string>
  const essentials = [1, 2, 3, 4].map(i => ({
    titleKey: `essential_${i}_title`,
    bodyKey: `essential_${i}_body`,
    title: c[`essential_${i}_title`],
    body: c[`essential_${i}_body`],
  }))

  const booking = useBooking()
  const router = useRouter()

  const [regions, setRegions] = useState<string[]>([])
  const [loggedIn, setLoggedIn] = useState(false)
  const [draftRegion, setDraftRegion] = useState('')
  const [draftCheckIn, setDraftCheckIn] = useState('')
  const [draftCheckOut, setDraftCheckOut] = useState('')
  const [draftGuests, setDraftGuests] = useState(2)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)

  useEffect(() => {
    getRegionNames().then(setRegions).catch(() => setRegions([]))
    getUser().then(u => setLoggedIn(!!u)).catch(() => {})
  }, [])

  // Pick up wherever the visitor's trip already stands (booking-context
  // persists across the whole site) instead of asking them to re-enter a
  // region/dates search they already ran on another page.
  useEffect(() => {
    if (!booking.hydrated) return
    if (booking.region) setDraftRegion(booking.region)
    if (booking.checkIn) setDraftCheckIn(booking.checkIn)
    if (booking.checkOut) setDraftCheckOut(booking.checkOut)
    if (booking.guests) setDraftGuests(booking.guests)
  }, [booking.hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  const itemCount = booking.addons.length + (booking.stay ? 1 : 0) + booking.shuttles.length
  const tripInProgress = booking.hydrated && itemCount > 0

  // Same engine /trip uses for "make the most of your trip" — surfaced here
  // as soon as the visitor gives us a region or dates, instead of only after
  // they've already committed to a cart item.
  useEffect(() => {
    if (!draftRegion && !draftCheckIn) { setRecommendations([]); return }
    let cancelled = false
    setLoadingRecs(true)
    getRecommendations({
      region: draftRegion,
      checkIn: draftCheckIn,
      checkOut: draftCheckOut,
      guests: draftGuests,
      excludeIds: [...booking.addons.map(a => a.id), ...(booking.stay ? [booking.stay.id] : [])],
    }, 4)
      .then(recs => { if (!cancelled) setRecommendations(recs) })
      .catch(() => { if (!cancelled) setRecommendations([]) })
      .finally(() => { if (!cancelled) setLoadingRecs(false) })
    return () => { cancelled = true }
  }, [draftRegion, draftCheckIn, draftCheckOut, draftGuests, booking.addons, booking.stay])

  function persistPlan() {
    booking.setSearch(draftRegion, draftCheckIn, draftCheckOut, draftGuests)
  }

  function goToTrails() {
    persistPlan()
    const params = new URLSearchParams()
    if (draftRegion) params.set('region', draftRegion)
    router.push(`/hikes${params.toString() ? `?${params}` : ''}`)
  }

  function goToStays() {
    persistPlan()
    router.push(`/stays${staysQuery()}`)
  }

  function staysQuery() {
    const params = new URLSearchParams()
    if (draftRegion) params.set('region', draftRegion)
    if (draftCheckIn) params.set('check_in', draftCheckIn)
    if (draftCheckOut) params.set('check_out', draftCheckOut)
    if (draftGuests) params.set('guests', String(draftGuests))
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }

  return (
    <main className="bg-mist pt-16">
      {/* Header */}
      <section className="bg-forest text-white py-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto grid lg:grid-cols-2 gap-10 items-end">
          <div>
            <Editable section="plan_page" fieldKey="eyebrow" value={c.eyebrow} label="Eyebrow" type="text">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-4">{c.eyebrow}</p>
            </Editable>
            <Editable section="plan_page" fieldKey="heading" value={c.heading} label="Heading" type="textarea">
              <h1 className="font-display text-5xl lg:text-7xl text-white leading-none" style={{ whiteSpace: 'pre-line' }}>
                {c.heading}
              </h1>
            </Editable>
          </div>
          <div>
            <Editable section="plan_page" fieldKey="subheading" value={c.subheading} label="Subheading" type="textarea">
              <p className="font-sans text-base text-white/50 leading-relaxed">
                {c.subheading}
              </p>
            </Editable>
            {tripInProgress ? (
              <Link
                href="/trip"
                className="mt-5 inline-flex items-center gap-2 font-sans text-sm bg-gold text-forest px-5 py-2.5 hover:bg-white transition-colors"
              >
                Continue your trip ({itemCount} item{itemCount === 1 ? '' : 's'}) <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : loggedIn ? (
              <p className="mt-5 font-sans text-xs text-white/40">
                Already booked? <Link href="/account/orders" className="underline hover:text-white transition-colors">View your bookings</Link>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Trip builder — the same region/dates/guests state every other page
          reads from and writes to (lib/booking-context), so starting here
          carries straight into search, cart and checkout. */}
      <section className="bg-white py-16 border-b border-black/8">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="mb-8">
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">Start here</p>
            <h2 className="font-display text-4xl text-forest">Build your trip</h2>
          </div>

          <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-end bg-mist p-6 lg:p-8">
            <div className="grid sm:grid-cols-3 gap-4">
              <label className="block">
                <span className="flex items-center gap-1.5 font-sans text-[10px] tracking-[0.12em] uppercase text-forest/50 mb-1.5">
                  <MapPin className="w-3 h-3" /> Region
                </span>
                <select
                  value={draftRegion}
                  onChange={e => setDraftRegion(e.target.value)}
                  className="w-full font-sans text-sm border border-black/10 bg-white px-3 py-2.5 outline-none focus:border-forest/40"
                >
                  <option value="">Anywhere in the Berg</option>
                  {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="flex items-center gap-1.5 font-sans text-[10px] tracking-[0.12em] uppercase text-forest/50 mb-1.5">
                  <Calendar className="w-3 h-3" /> Dates
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={draftCheckIn}
                    onChange={e => setDraftCheckIn(e.target.value)}
                    className="w-full font-sans text-sm border border-black/10 bg-white px-2.5 py-2.5 outline-none focus:border-forest/40"
                    aria-label="Check-in date"
                  />
                  <input
                    type="date"
                    value={draftCheckOut}
                    min={draftCheckIn || undefined}
                    onChange={e => setDraftCheckOut(e.target.value)}
                    className="w-full font-sans text-sm border border-black/10 bg-white px-2.5 py-2.5 outline-none focus:border-forest/40"
                    aria-label="Check-out date"
                  />
                </div>
              </label>
              <label className="block">
                <span className="flex items-center gap-1.5 font-sans text-[10px] tracking-[0.12em] uppercase text-forest/50 mb-1.5">
                  <Users className="w-3 h-3" /> Guests
                </span>
                <input
                  type="number"
                  min={1}
                  value={draftGuests}
                  onChange={e => setDraftGuests(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full font-sans text-sm border border-black/10 bg-white px-3 py-2.5 outline-none focus:border-forest/40"
                />
              </label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={goToTrails}
                className="font-sans text-sm bg-forest text-white px-5 py-2.5 hover:bg-forest/90 transition-colors whitespace-nowrap"
              >
                Browse trails
              </button>
              <button
                onClick={goToStays}
                className="font-sans text-sm border border-forest text-forest px-5 py-2.5 hover:bg-forest hover:text-white transition-colors whitespace-nowrap"
              >
                Find a stay
              </button>
            </div>
          </div>

          {/* Contextual suggestions, live from the catalog — same engine /trip
              uses once something is in the cart, offered earlier here. */}
          {(loadingRecs || recommendations.length > 0) && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <Compass className="w-4 h-4 text-gold" />
                <p className="font-sans text-sm text-forest/60">
                  {draftRegion ? `Matched to ${draftRegion}` : 'Matched to your dates'}
                </p>
              </div>
              {loadingRecs ? (
                <Loader2 className="w-5 h-5 text-forest/30 animate-spin" />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {recommendations.map(r => (
                    <Link
                      key={r.id}
                      href={r.href}
                      className="bg-white border border-black/8 p-5 hover:border-gold/60 transition-colors group"
                    >
                      <p className="font-sans text-[10px] text-gold uppercase tracking-widest mb-1.5">
                        {r.kind === 'tour-departure' ? 'Guided tour' : r.kind === 'stay' ? 'Stay' : 'Activity'}
                      </p>
                      <p className="font-sans text-sm font-medium text-forest mb-1">{r.title}</p>
                      <p className="font-sans text-xs text-forest/40 leading-relaxed">{r.reason}</p>
                      {r.price != null && (
                        <p className="font-sans text-xs font-semibold text-sage mt-2">{formatMoney(r.price)} pp</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Trip types */}
      <section className="bg-white py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="mb-10">
            <Editable section="plan_page" fieldKey="itineraries_eyebrow" value={c.itineraries_eyebrow} label="Itineraries Eyebrow" type="text">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">{c.itineraries_eyebrow}</p>
            </Editable>
            <Editable section="plan_page" fieldKey="itineraries_heading" value={c.itineraries_heading} label="Itineraries Heading" type="text">
              <h2 className="font-display text-4xl text-forest">{c.itineraries_heading}</h2>
            </Editable>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {TRIP_TYPES.map((t) => (
              <div key={t.title} className="border border-black/8 p-8">
                <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-2">{t.label}</p>
                <h3 className="font-display text-2xl text-forest mb-4">{t.title}</h3>
                <p className="font-sans text-sm text-forest/55 leading-relaxed mb-6">{t.desc}</p>
                <div className="h-px bg-black/6 mb-6" />
                <ul className="space-y-3 mb-8">
                  {t.itinerary.map((item, i) => (
                    <li key={i} className="flex gap-3 font-sans text-xs text-forest/60">
                      <span className="text-gold shrink-0 mt-0.5">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href={t.searchable ? `${t.href}${staysQuery()}` : t.href}
                  className="font-sans text-sm text-forest inline-flex items-center gap-2 hover:text-gold transition-colors"
                >
                  Browse options <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Not sure what to book — hands off to the existing private-guide
          request workflow (lib/custom-trips.ts) instead of dead-ending. */}
      <section className="bg-forest text-white py-16">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-2">Not sure what you want yet?</p>
            <h2 className="font-display text-3xl text-white mb-2">Request a custom trip on your own dates</h2>
            <p className="font-sans text-sm text-white/50 max-w-xl leading-relaxed">
              Tell us your trail, dates and group size — we'll match you with an available guide and
              tour operator, who'll confirm and send a quote before you pay anything.
            </p>
          </div>
          <Link
            href="/experiences/request"
            className="shrink-0 inline-flex items-center gap-2 font-sans text-sm bg-gold text-forest px-6 py-3 hover:bg-white transition-colors whitespace-nowrap"
          >
            Request a custom trip <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* Essentials */}
      <section className="py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="mb-10">
            <Editable section="plan_page" fieldKey="essentials_eyebrow" value={c.essentials_eyebrow} label="Essentials Eyebrow" type="text">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">{c.essentials_eyebrow}</p>
            </Editable>
            <Editable section="plan_page" fieldKey="essentials_heading" value={c.essentials_heading} label="Essentials Heading" type="text">
              <h2 className="font-display text-4xl text-forest">{c.essentials_heading}</h2>
            </Editable>
          </div>

          <div className="grid sm:grid-cols-2 gap-0 border border-black/8">
            {essentials.map((e, i) => (
              <div key={e.titleKey} className={`p-8 ${i < 2 ? 'border-b border-black/8' : ''} ${i % 2 === 0 ? 'sm:border-r sm:border-black/8' : ''}`}>
                <Editable section="plan_page" fieldKey={e.titleKey} value={e.title} label={`Essential ${i + 1} Title`} type="text">
                  <h3 className="font-display text-xl text-forest mb-3">{e.title}</h3>
                </Editable>
                <Editable section="plan_page" fieldKey={e.bodyKey} value={e.body} label={`Essential ${i + 1} Body`} type="textarea">
                  <p className="font-sans text-sm text-forest/55 leading-relaxed">{e.body}</p>
                </Editable>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

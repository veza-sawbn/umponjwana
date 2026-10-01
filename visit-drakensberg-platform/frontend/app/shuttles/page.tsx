'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Bus, Calendar, Check, Clock, MapPin, Plus, Trash2, Users } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { useBooking, type ShuttleOption } from '@/lib/booking-context'
import { useAutoDrivingDistance, type GooglePlaceSelection } from '@/components/maps/GoogleAddressField'
import { buildShuttleOption, estimateTransferPrice, type ShuttleSupplierChoice } from '@/lib/shuttle-service'
import { TransportSupplierPicker } from '@/components/booking/TransportSupplierPicker'
import { ShuttleSearchForm, type ShuttleSearchValue } from '@/components/shuttles/ShuttleSearchForm'
import { HowShuttlesWork } from '@/components/shuttles/HowShuttlesWork'
import { OperatorTypeCarousel } from '@/components/shuttles/OperatorTypeCarousel'
import { ShuttleFaq } from '@/components/shuttles/ShuttleFaq'
import { formatMoney } from '@/lib/allocation'

const EMPTY_PLACE: GooglePlaceSelection = { address: '' }

function fmtMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The journey the visitor searched for, frozen at the moment they searched —
 *  editing the form afterwards doesn't disturb the results they are working
 *  through until they search again. */
type SearchedTrip = {
  pickup: GooglePlaceSelection
  destination: GooglePlaceSelection
  date: string
  time: string
  returnDate: string
  returnTime: string
  passengers: number
  wantsReturn: boolean
}

// useSearchParams() requires a Suspense boundary around any client
// component that calls it (Next.js App Router) — the actual page body
// lives in ShuttlesPageContent below.
export default function ShuttlesPage() {
  return (
    <Suspense fallback={null}>
      <ShuttlesPageContent />
    </Suspense>
  )
}

function ShuttlesPageContent() {
  const router = useRouter()
  const booking = useBooking()
  const searchParams = useSearchParams()
  // Pre-fill support (?to=<address>) — used by /regions/[slug]'s "Get a
  // Shuttle Here" CTA to seed the destination with that region's gateway
  // town, so a visitor lands here ready to quote instead of starting from
  // a blank form. See docs/destination-graph/PHASE_H.md. Takes priority
  // over the booking-context stay prefill since it's an explicit link the
  // visitor just followed.
  const prefillTo = searchParams.get('to')

  const [search, setSearch] = useState<ShuttleSearchValue>({
    tripType: 'one-way',
    pickup: EMPTY_PLACE,
    destination: prefillTo
      ? { address: prefillTo }
      : booking.stay?.address || booking.stay?.lat
        ? { address: booking.stay.address || booking.stay.title, lat: booking.stay.lat, lng: booking.stay.lng }
        : EMPTY_PLACE,
    date: booking.checkIn || '',
    time: '',
    returnDate: booking.checkOut || '',
    returnTime: '',
    passengers: booking.guests || 2,
  })

  const [trip, setTrip] = useState<SearchedTrip | null>(null)
  const [outboundChoice, setOutboundChoice] = useState<ShuttleSupplierChoice | null>(null)
  const [returnChoice, setReturnChoice] = useState<ShuttleSupplierChoice | null>(null)
  // Availability is per leg: the return runs on its own date, so a company
  // with its only vehicle booked that day can cover one leg and not the other.
  const [eligibleCount, setEligibleCount] = useState<number | null>(null)
  const [returnEligibleCount, setReturnEligibleCount] = useState<number | null>(null)
  // Cheapest fare among each leg's listed partners — a real market price for
  // the summary rail before the visitor has picked a company, instead of the
  // generic distance formula. Null until the partner list loads, or when no
  // partner covers the leg.
  const [lowestOutbound, setLowestOutbound] = useState<number | null>(null)
  const [lowestReturn, setLowestReturn] = useState<number | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  // Cart ids for the legs this page put in the trip, so re-searching updates
  // them in place instead of stacking up duplicate transfers.
  const legIdsRef = useRef<{ outbound: string; inbound: string } | null>(null)

  function patchSearch(patch: Partial<ShuttleSearchValue>) {
    setSearch(current => ({ ...current, ...patch }))
  }

  // Live driving distance & duration straight from the Google Distance
  // Matrix — the only source of route data on this page. Measured on the
  // searched trip, so it doesn't re-run while the visitor edits the form.
  const { result, status } = useAutoDrivingDistance(
    { address: trip?.pickup.address ?? '', lat: trip?.pickup.lat, lng: trip?.pickup.lng },
    { address: trip?.destination.address ?? '', lat: trip?.destination.lat, lng: trip?.destination.lng },
  )

  // A leg prices at the chosen vehicle's fare, else the cheapest partner
  // covering it, else the platform's own distance estimate.
  const outboundPrice = outboundChoice?.price
    ?? lowestOutbound
    ?? (result ? estimateTransferPrice(result.distanceKm, trip?.passengers ?? 2) : null)
  const returnPrice = trip?.wantsReturn
    ? returnChoice?.price
      ?? lowestReturn
      ?? (result ? estimateTransferPrice(result.distanceKm, trip.passengers) : null)
    : null
  const total = (outboundPrice ?? 0) + (returnPrice ?? 0)

  /** Build the cart entry for one leg of the searched journey. */
  const legOption = useCallback((
    leg: 'outbound' | 'inbound',
    ids: { outbound: string; inbound: string },
  ): ShuttleOption | null => {
    if (!trip || !result) return null
    const outbound = leg === 'outbound'
    return buildShuttleOption({
      id: outbound ? ids.outbound : ids.inbound,
      pickup: outbound
        ? { address: trip.pickup.address, lat: trip.pickup.lat, lng: trip.pickup.lng }
        : { address: trip.destination.address, lat: trip.destination.lat, lng: trip.destination.lng },
      destination: outbound
        ? { address: trip.destination.address, lat: trip.destination.lat, lng: trip.destination.lng }
        : { address: trip.pickup.address, lat: trip.pickup.lat, lng: trip.pickup.lng },
      date: outbound ? trip.date : trip.returnDate,
      time: outbound ? trip.time : trip.returnTime,
      passengers: trip.passengers,
      result,
      supplier: (outbound ? outboundChoice : returnChoice) ?? undefined,
      returnOfId: outbound ? undefined : ids.outbound,
    })
  }, [trip, result, outboundChoice, returnChoice])

  // The searched journey goes into the trip cart as soon as it can be priced —
  // the visitor sees it in the booking bar straight away, and choosing an
  // operator below updates that same entry rather than adding another.
  useEffect(() => {
    if (!trip || !result) return
    const ids = legIdsRef.current
    if (!ids) return

    const outbound = legOption('outbound', ids)
    if (outbound) {
      if (booking.shuttles.some(s => s.id === ids.outbound)) booking.updateShuttle(ids.outbound, outbound)
      else booking.addShuttle(outbound)
    }

    const inbound = trip.wantsReturn ? legOption('inbound', ids) : null
    if (inbound) {
      if (booking.shuttles.some(s => s.id === ids.inbound)) booking.updateShuttle(ids.inbound, inbound)
      else booking.addShuttle(inbound)
    } else if (booking.shuttles.some(s => s.id === ids.inbound)) {
      booking.removeShuttle(ids.inbound)
    }
    // booking is a context value that changes identity on every cart write —
    // depending on it here would loop. The leg content is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, result, outboundChoice, returnChoice, legOption])

  function runSearch() {
    const wantsReturn = search.tripType === 'return'

    // Carry the searched journey into the trip itself, not just into the
    // shuttle leg. /checkout reads the party size and travel dates off the
    // booking context, so without this a visitor who starts here reached
    // checkout showing the default "2 guests" and no dates — their own
    // answers, dropped on the way.
    //
    // Only fills what the trip does not already carry. A cart that already
    // has a stay owns its dates and guest count: the stay's night count, and
    // therefore its price, is derived from checkIn/checkOut, so overwriting
    // them with a transfer date would silently re-price the accommodation.
    const nextCheckIn = booking.checkIn || search.date
    const nextCheckOut = booking.checkOut || (wantsReturn ? search.returnDate : '')
    const nextGuests = booking.stay ? booking.guests : (search.passengers || booking.guests)
    if (nextCheckIn !== booking.checkIn || nextCheckOut !== booking.checkOut || nextGuests !== booking.guests) {
      booking.setSearch(booking.region, nextCheckIn, nextCheckOut, nextGuests)
    }

    legIdsRef.current = legIdsRef.current ?? {
      outbound: `shuttle-${Date.now()}`,
      inbound: `shuttle-return-${Date.now()}`,
    }
    setOutboundChoice(null)
    setReturnChoice(null)
    setEligibleCount(null)
    setReturnEligibleCount(null)
    setLowestOutbound(null)
    setLowestReturn(null)
    setTrip({
      pickup: search.pickup,
      destination: search.destination,
      date: search.date,
      time: search.time,
      returnDate: wantsReturn ? search.returnDate : '',
      returnTime: wantsReturn ? search.returnTime : '',
      passengers: search.passengers,
      wantsReturn,
    })
    // The answer lands right under the form — no hunting down the page.
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  /** Add the return leg after the fact, from the results. */
  function addReturnLeg() {
    if (!trip) return
    const returnDate = trip.returnDate || search.returnDate || trip.date
    patchSearch({ tripType: 'return', returnDate })
    setTrip({ ...trip, wantsReturn: true, returnDate, returnTime: trip.returnTime || search.returnTime })
  }

  function dropReturnLeg() {
    if (!trip) return
    patchSearch({ tripType: 'one-way' })
    setReturnChoice(null)
    setTrip({ ...trip, wantsReturn: false })
  }

  const inCart = Boolean(legIdsRef.current && booking.shuttles.some(s => s.id === legIdsRef.current!.outbound))
  const ready = Boolean(
    result && trip
    && (outboundChoice || eligibleCount === 0)
    && (!trip.wantsReturn || returnChoice || returnEligibleCount === 0),
  )

  return (
    <main className="bg-mist min-h-screen pt-16">
      {/* Hero + the whole search in one screenful */}
      <section className="bg-forest text-white pt-12 md:pt-16 pb-28 md:pb-32 px-5 sm:px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-3">Door-to-door transfers</p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-none mb-4">Shuttles &amp; Transfers</h1>
          <p className="font-sans text-sm text-white/50 max-w-xl">
            Pick up anywhere, drop off anywhere. Every transfer is a private vehicle, quoted from live driving
            distance and driven by a registered operator you choose yourself.
          </p>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12 -mt-20 md:-mt-24 relative z-10">
        <ShuttleSearchForm
          value={search}
          onChange={patchSearch}
          onSubmit={runSearch}
          submitLabel={trip ? 'Update search' : 'Search transfers'}
        />
      </div>

      {/* Results — everything the visitor needs next, immediately below the
          form they just submitted rather than further down the page. */}
      <div ref={resultsRef} className="scroll-mt-20">
        {trip && (
          <div className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12 py-8 md:py-10 grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8">
            <div className="lg:col-span-2 space-y-5">
              {/* Route summary */}
              <section className="bg-white border border-black/8 p-5">
                {status === 'calculating' && <p className="font-sans text-sm text-gray-400">Measuring the driving route…</p>}
                {status === 'error' && (
                  <p className="font-sans text-sm text-red-500">
                    We could not calculate a driving route between those points. Try more specific locations.
                  </p>
                )}
                {status === 'idle' && <p className="font-sans text-sm text-gray-400">Enter a pickup and destination to quote your transfer.</p>}
                {status === 'done' && result && (
                  <div className="flex flex-wrap items-center gap-4">
                    <Bus className="text-forest shrink-0" size={20} />
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-display text-lg text-forest">
                        {result.distanceKm} km · {fmtMinutes(result.durationMinutes)} drive
                      </p>
                      <p className="font-sans text-xs text-forest/40 mt-0.5">
                        {trip.pickup.address} → {trip.destination.address}
                      </p>
                    </div>
                    <p className="font-sans text-xs text-forest/50 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1"><Calendar size={11} className="text-gold" /> {fmtDate(trip.date)}</span>
                      {trip.time && <span className="flex items-center gap-1"><Clock size={11} className="text-gold" /> {trip.time}</span>}
                      <span className="flex items-center gap-1"><Users size={11} className="text-gold" /> {trip.passengers}</span>
                    </p>
                  </div>
                )}
              </section>

              {/* Outbound operators */}
              <section className="bg-white border border-black/8">
                <div className="px-5 pt-5">
                  <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-gold mb-1">
                    {trip.wantsReturn ? 'Outbound · choose your operator & vehicle' : 'Choose your operator & vehicle'}
                  </p>
                  <p className="font-sans text-xs text-forest/40 mb-4">
                    Each operator prices every vehicle in its fleet, so the fare you see is the one that vehicle charges.
                  </p>
                </div>
                {result && trip.date ? (
                  <TransportSupplierPicker
                    pickup={{ address: trip.pickup.address, lat: trip.pickup.lat, lng: trip.pickup.lng }}
                    dropoff={{ address: trip.destination.address, lat: trip.destination.lat, lng: trip.destination.lng }}
                    date={trip.date}
                    passengers={trip.passengers}
                    distanceKm={result.distanceKm}
                    selected={outboundChoice}
                    onSelect={setOutboundChoice}
                    onCandidates={setEligibleCount}
                    onLowestPrice={setLowestOutbound}
                  />
                ) : (
                  <p className="p-5 font-sans text-sm text-gray-400">Available operators appear once the route is measured.</p>
                )}
              </section>

              {/* Return leg — offered right here rather than as a second search */}
              {trip.wantsReturn ? (
                <section className="bg-white border border-black/8">
                  <div className="px-5 pt-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-gold mb-1">Return · choose your operator & vehicle</p>
                      <p className="font-sans text-xs text-forest/40 mb-4">
                        {trip.destination.address} → {trip.pickup.address} · {fmtDate(trip.returnDate)}
                        {trip.returnTime ? ` at ${trip.returnTime}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={dropReturnLeg}
                      className="font-sans text-xs text-forest/40 hover:text-red-500 flex items-center gap-1 shrink-0"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                  {result && trip.returnDate ? (
                    <TransportSupplierPicker
                      pickup={{ address: trip.destination.address, lat: trip.destination.lat, lng: trip.destination.lng }}
                      dropoff={{ address: trip.pickup.address, lat: trip.pickup.lat, lng: trip.pickup.lng }}
                      date={trip.returnDate}
                      passengers={trip.passengers}
                      distanceKm={result.distanceKm}
                      selected={returnChoice}
                      onSelect={setReturnChoice}
                      onCandidates={setReturnEligibleCount}
                      onLowestPrice={setLowestReturn}
                    />
                  ) : (
                    <p className="p-5 font-sans text-sm text-gray-400">Pick a return date above to see operators for the leg home.</p>
                  )}
                </section>
              ) : (
                <button
                  onClick={addReturnLeg}
                  className="w-full bg-white border border-dashed border-forest/25 hover:border-forest hover:bg-forest/[0.02] transition-colors p-5 flex items-center gap-3 text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/10 text-gold shrink-0">
                    <Plus size={16} />
                  </span>
                  <span>
                    <span className="block font-display text-base text-forest">Add a return trip</span>
                    <span className="block font-sans text-xs text-forest/45 mt-0.5">
                      Book the leg home in the same trip, from {trip.destination.address || 'your destination'} back to {trip.pickup.address || 'your pickup'}.
                    </span>
                  </span>
                </button>
              )}
            </div>

            {/* Trip summary rail — the cart, mirrored where the visitor is looking */}
            <aside className="bg-forest text-white p-6 sm:p-8 h-fit lg:sticky lg:top-24">
              <div className="flex items-center justify-between mb-4">
                <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-white/40">Your transfer</p>
                {inCart && (
                  <span className="font-sans text-[10px] tracking-[0.1em] uppercase text-emerald-300 flex items-center gap-1">
                    <Check size={11} /> In your trip
                  </span>
                )}
              </div>

              <div className="space-y-5">
                <div className="space-y-2 font-sans text-sm text-white/70">
                  <p className="flex gap-2"><MapPin size={14} className="shrink-0 mt-0.5 text-gold" />{trip.pickup.address || '—'}</p>
                  <p className="flex gap-2"><MapPin size={14} className="shrink-0 mt-0.5 text-gold" />{trip.destination.address || '—'}</p>
                  <p className="flex gap-2 text-white/50 text-xs pt-1">
                    <Calendar size={12} className="shrink-0 mt-0.5" />
                    {fmtDate(trip.date)}{trip.time ? ` · ${trip.time}` : ''} · {trip.passengers} passenger{trip.passengers !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="border-t border-white/10 pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-sans text-xs text-white/70">Outbound</p>
                      <p className="font-sans text-[11px] text-white/40 truncate">
                        {outboundChoice
                          ? `${outboundChoice.companyName} · ${outboundChoice.vehicleName}`
                          : eligibleCount === 0 ? 'Assigned after checkout' : 'Select an operator'}
                      </p>
                    </div>
                    <span className="font-sans text-sm text-white/80 shrink-0">
                      {outboundPrice !== null ? formatMoney(outboundPrice) : '—'}
                    </span>
                  </div>

                  {trip.wantsReturn && (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-sans text-xs text-white/70">Return · {fmtDate(trip.returnDate)}</p>
                        <p className="font-sans text-[11px] text-white/40 truncate">
                          {returnChoice
                            ? `${returnChoice.companyName} · ${returnChoice.vehicleName}`
                            : returnEligibleCount === 0 ? 'Assigned after checkout' : 'Select an operator'}
                        </p>
                      </div>
                      <span className="font-sans text-sm text-white/80 shrink-0">
                        {returnPrice !== null ? formatMoney(returnPrice) : '—'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 pt-4 flex items-end justify-between">
                  <span className="font-sans text-xs text-white/40">
                    {outboundChoice || returnChoice ? 'Fare' : 'Estimated fare'}
                  </span>
                  <span className="font-display text-3xl text-gold">{total > 0 ? formatMoney(total) : '—'}</span>
                </div>
              </div>

              <button
                onClick={() => router.push('/trip')}
                disabled={!ready}
                className="w-full mt-6 bg-gold text-forest font-sans text-sm py-3 flex items-center justify-center gap-2 hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                View trip &amp; checkout <ArrowRight size={14} />
              </button>

              <p className="font-sans text-xs text-white/40 mt-4">
                {ready
                  ? 'Your transfer is in your trip. Nothing is charged until you complete checkout.'
                  : eligibleCount === 0 || returnEligibleCount === 0
                    ? 'No registered partner covers this route yet. Our team will place the transfer with the best available operator after checkout.'
                    : 'Choose an operator and vehicle for each leg to continue.'}
              </p>
            </aside>
          </div>
        )}
      </div>

      <HowShuttlesWork />
      <OperatorTypeCarousel />
      <ShuttleFaq />
      <Footer />
    </main>
  )
}

'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Bus, Calendar, Check, MapPin, Mountain, Plane, Route, Users } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { useBooking } from '@/lib/booking-context'
import { GoogleAddressField, useAutoDrivingDistance, type GooglePlaceSelection } from '@/components/maps/GoogleAddressField'
import { buildShuttleOption, estimateTransferPrice, suggestedVehicleType, type ShuttleSupplierChoice } from '@/lib/shuttle-service'
import { SUPPLIER_CATEGORIES, type SupplierCategory } from '@/lib/transport'
import { TransportSupplierPicker } from '@/components/booking/TransportSupplierPicker'
import { formatMoney } from '@/lib/allocation'

const EMPTY_PLACE: GooglePlaceSelection = { address: '' }

const fieldInput = 'w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-forest transition-colors'
const fieldLabel = 'font-sans text-[10px] tracking-[0.16em] uppercase text-gold mb-3 block'

// On mobile every step stands on its own card with breathing room around it;
// from md up they collapse back into the single bordered panel, so the desktop
// form still reads as one continuous sheet.
const stepCard = 'bg-white border border-black/8 p-5 md:border-0 md:p-0'

// Illustration per operator category — the picture carries the distinction
// (city → mountains, around the region, inside one valley) before the words do.
const CATEGORY_ART: Record<SupplierCategory, { icon: typeof Plane; art: string; scale: string }> = {
  gateway: { icon: Plane, art: 'City & airport', scale: 'Long haul' },
  regional: { icon: Route, art: 'Across the region', scale: 'Mid range' },
  local: { icon: Mountain, art: 'Inside the valley', scale: 'Short hops' },
}

function fmtMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
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
  const [pickup, setPickup] = useState<GooglePlaceSelection>(EMPTY_PLACE)
  const [destination, setDestination] = useState<GooglePlaceSelection>(
    prefillTo
      ? { address: prefillTo }
      : booking.stay?.address || booking.stay?.lat
        ? { address: booking.stay.address || booking.stay.title, lat: booking.stay.lat, lng: booking.stay.lng }
        : EMPTY_PLACE
  )
  const [date, setDate] = useState(booking.checkIn || '')
  const [passengers, setPassengers] = useState(booking.guests || 2)
  const [added, setAdded] = useState(false)
  const [supplierChoice, setSupplierChoice] = useState<ShuttleSupplierChoice | null>(null)
  const [eligibleCount, setEligibleCount] = useState<number | null>(null)
  // Cheapest fare among this route's listed transport partners — shown in
  // the "Live route estimate" below instead of the generic distance-based
  // formula, so the upfront number reflects real market pricing rather than
  // a synthetic guess. Null until the partner list has loaded (or none cover
  // the route), in which case the formula estimate is still the fallback.
  const [lowestSupplierPrice, setLowestSupplierPrice] = useState<number | null>(null)

  // Live driving distance & duration straight from the Google Distance
  // Matrix — the only source of route data on this page.
  const { result, status } = useAutoDrivingDistance(
    { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
    { address: destination.address, lat: destination.lat, lng: destination.lng },
  )

  const price = supplierChoice
    ? supplierChoice.price
    : lowestSupplierPrice !== null
      ? lowestSupplierPrice
      : result ? estimateTransferPrice(result.distanceKm, passengers) : null
  // A transport partner + vehicle must be chosen before booking; only when no
  // registered partner covers the route does the platform estimate stand in.
  const ready = Boolean(result && date && pickup.address && destination.address && (supplierChoice || eligibleCount === 0))

  function addToTrip() {
    if (!result || !date) return
    booking.addShuttle(buildShuttleOption({
      id: `shuttle-${Date.now()}`,
      pickup: { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
      destination: { address: destination.address, lat: destination.lat, lng: destination.lng },
      date,
      passengers,
      result,
      supplier: supplierChoice ?? undefined,
    }))
    setAdded(true)
  }

  return (
    <main className="bg-mist min-h-screen pt-16">
      <section className="bg-forest text-white py-12 md:py-16 px-5 sm:px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-3">Door-to-door transfers</p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-none mb-4">Shuttles &amp; Transfers</h1>
          <p className="font-sans text-sm text-white/50 max-w-xl">
            Pick up anywhere, drop off anywhere. Every transfer is a private vehicle, quoted from live driving
            distance and driven by a registered operator you choose yourself.
          </p>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12 py-8 md:py-12 grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-8">
        {/* Mobile: each step is its own card, spaced apart, so nothing is
            squeezed against a shared container edge. md and up: one panel. */}
        <div className="lg:col-span-2 space-y-5 md:space-y-8 md:bg-white md:border md:border-black/8 md:p-6">
          <section className={stepCard}>
            <p className={fieldLabel}>Step 1 · Pickup location</p>
            <GoogleAddressField
              label="Search any address, airport, lodge, trailhead or town"
              value={pickup.address}
              lat={pickup.lat}
              lng={pickup.lng}
              placeholder="e.g. OR Tambo International Airport"
              inputClassName={fieldInput}
              labelClassName="font-sans text-xs text-forest/50 mb-2 block"
              onChange={setPickup}
            />
          </section>

          <section className={stepCard}>
            <p className={fieldLabel}>Step 2 · Destination</p>
            <GoogleAddressField
              label="Where are we taking you?"
              value={destination.address}
              lat={destination.lat}
              lng={destination.lng}
              placeholder="e.g. your lodge, a trailhead, an attraction"
              inputClassName={fieldInput}
              labelClassName="font-sans text-xs text-forest/50 mb-2 block"
              onChange={setDestination}
            />
          </section>

          <section className={stepCard}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className={fieldLabel}>Step 3 · Date</p>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={fieldInput} />
              </div>
              <div>
                <p className={fieldLabel}>Step 4 · Passengers</p>
                <input type="number" min={1} max={20} value={passengers} onChange={e => setPassengers(Math.max(1, parseInt(e.target.value) || 1))} className={fieldInput} />
              </div>
            </div>
          </section>

          <section className={stepCard}>
            <p className={fieldLabel}>Live route estimate</p>
            <div className="border border-gray-100">
              {status === 'idle' && <p className="p-5 font-sans text-sm text-gray-400">Choose a pickup and destination to see distance, travel time and fare.</p>}
              {status === 'calculating' && <p className="p-5 font-sans text-sm text-gray-400">Calculating driving distance…</p>}
              {status === 'error' && <p className="p-5 font-sans text-sm text-red-500">We could not calculate a driving route between these points. Try more specific locations.</p>}
              {status === 'done' && result && (
                <div className="flex items-center gap-4 p-5">
                  <Bus className="text-forest shrink-0" size={20} />
                  <div className="flex-1">
                    <p className="font-display text-lg text-forest">{result.distanceKm} km · {fmtMinutes(result.durationMinutes)} drive</p>
                    <p className="font-sans text-xs text-forest/40">{suggestedVehicleType(passengers)} · {passengers} passenger{passengers !== 1 ? 's' : ''}</p>
                  </div>
                  {price !== null && <p className="font-display text-xl text-forest">{formatMoney(price)}</p>}
                </div>
              )}
            </div>
          </section>

          <section className={stepCard}>
            <p className={fieldLabel}>Step 5 · Choose your transport partner & vehicle</p>
            <p className="font-sans text-xs text-forest/40 -mt-2 mb-3">
              Each operator prices every vehicle in its fleet, so the fare you see is the one that vehicle charges.
            </p>
            <div className="border border-gray-100">
              {!result || !date
                ? <p className="p-5 font-sans text-sm text-gray-400">Complete the route and date above to see available transport partners.</p>
                : (
                  <TransportSupplierPicker
                    pickup={{ address: pickup.address, lat: pickup.lat, lng: pickup.lng }}
                    dropoff={{ address: destination.address, lat: destination.lat, lng: destination.lng }}
                    date={date}
                    passengers={passengers}
                    distanceKm={result.distanceKm}
                    selected={supplierChoice}
                    onSelect={setSupplierChoice}
                    onCandidates={setEligibleCount}
                    onLowestPrice={setLowestSupplierPrice}
                  />
                )}
            </div>
          </section>

          <section className={`${stepCard} md:border-t md:border-gray-100 md:pt-6`}>
            <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-forest/30 mb-4">Who drives you</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.entries(SUPPLIER_CATEGORIES) as [SupplierCategory, typeof SUPPLIER_CATEGORIES[SupplierCategory]][]).map(([key, cat]) => {
                const { icon: Icon, art, scale } = CATEGORY_ART[key]
                return (
                  <div key={key} className="border border-gray-100 flex flex-col">
                    {/* The illustration band: the shape of the journey at a
                        glance — a plane leaving the city, a road across the
                        region, a peak inside one valley. */}
                    <div className="relative bg-forest/[0.04] px-4 py-5 flex items-center gap-3 overflow-hidden">
                      <span className="absolute -right-4 -bottom-5 text-forest/[0.06]" aria-hidden="true">
                        <Icon size={92} strokeWidth={1} />
                      </span>
                      <span className="absolute right-3 top-3 font-sans text-[9px] tracking-[0.12em] uppercase text-forest/30 border border-forest/10 px-1.5 py-0.5">
                        {scale}
                      </span>
                      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white border border-gold/40">
                        <Icon size={19} className="text-gold" strokeWidth={1.6} />
                      </span>
                      <span className="relative min-w-0">
                        <span className="block font-display text-base text-forest leading-tight">{cat.label}s</span>
                        <span className="block font-sans text-[10px] tracking-[0.14em] uppercase text-forest/35 mt-0.5">{art}</span>
                      </span>
                    </div>
                    <div className="p-4 space-y-3 flex-1">
                      <p className="font-sans text-xs text-forest/50 leading-relaxed">{cat.description}</p>
                      <div>
                        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-forest/25 mb-1.5">Typical trips</p>
                        <ul className="space-y-1">
                          {cat.typicalWork.map(work => (
                            <li key={work} className="font-sans text-xs text-forest/60 flex items-start gap-1.5">
                              <Check size={11} className="text-gold shrink-0 mt-[3px]" /> {work}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {cat.exampleBases.map(base => (
                          <span key={base} className="font-sans text-[10px] text-forest/45 border border-gray-100 bg-mist px-2 py-0.5">{base}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <aside className="bg-forest text-white p-6 sm:p-8 h-fit lg:sticky lg:top-24">
          <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-white/40 mb-3">Step 6 · Review & add to trip</p>
          <div className="space-y-4 font-sans text-sm text-white/70">
            <p className="flex gap-2"><MapPin size={14} className="shrink-0 mt-0.5" />Pickup: {pickup.address || '—'}</p>
            <p className="flex gap-2"><MapPin size={14} className="shrink-0 mt-0.5" />Destination: {destination.address || '—'}</p>
            <p className="flex gap-2"><Calendar size={14} />Date: {date || 'Select date'}</p>
            <p className="flex gap-2"><Users size={14} />Passengers: {passengers}</p>
            <p>Transport partner: {supplierChoice ? supplierChoice.companyName : eligibleCount === 0 ? 'Assigned after checkout' : 'Select below'}</p>
            <p>Vehicle: {supplierChoice ? supplierChoice.vehicleName : suggestedVehicleType(passengers)}</p>
            <p>Estimated duration: {result ? fmtMinutes(result.durationMinutes) : '—'}</p>
          </div>
          <div className="border-t border-white/10 mt-6 pt-6 flex items-end justify-between">
            <span className="font-sans text-xs text-white/40">{supplierChoice ? `${supplierChoice.companyName} fare` : 'Estimated fare'}</span>
            <span className="font-display text-3xl text-gold">{price !== null ? `${formatMoney(price)}` : '—'}</span>
          </div>

          {added ? (
            <div className="mt-6 space-y-3">
              <p className="font-sans text-xs text-emerald-300 flex items-center gap-2"><Check size={14} /> Shuttle added to your trip.</p>
              <button onClick={() => router.push('/trip')} className="w-full bg-gold text-forest font-sans text-sm py-3 flex items-center justify-center gap-2 hover:bg-white transition-colors">
                View trip & checkout <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={addToTrip}
              disabled={!ready}
              className="w-full mt-6 bg-gold text-forest font-sans text-sm py-3 flex items-center justify-center gap-2 hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add shuttle to trip <ArrowRight size={14} />
            </button>
          )}
          <p className="font-sans text-xs text-white/40 mt-4">
            {supplierChoice
              ? `${supplierChoice.companyName} (${supplierChoice.vehicleName}) will be booked for this transfer when you complete checkout.`
              : eligibleCount === 0
                ? 'No registered partner covers this route yet — our team will place the transfer with the best available operator after checkout.'
                : 'Choose a transport partner and vehicle to continue.'}
          </p>
        </aside>
      </div>
      <Footer />
    </main>
  )
}

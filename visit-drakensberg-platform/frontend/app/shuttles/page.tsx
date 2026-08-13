'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Bus, Calendar, Check, MapPin, Users } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { useBooking } from '@/lib/booking-context'
import { GoogleAddressField, useAutoDrivingDistance, type GooglePlaceSelection } from '@/components/maps/GoogleAddressField'
import { buildShuttleOption, estimateTransferPrice, suggestedVehicleType, SHUTTLE_TYPES, type ShuttleSupplierChoice, type ShuttleType } from '@/lib/shuttle-service'
import { SUPPLIER_CATEGORIES } from '@/lib/transport'
import { TransportSupplierPicker } from '@/components/booking/TransportSupplierPicker'

const EMPTY_PLACE: GooglePlaceSelection = { address: '' }

const fieldInput = 'w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-forest transition-colors'
const fieldLabel = 'font-sans text-[10px] tracking-[0.16em] uppercase text-gold mb-3 block'

function fmtMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

export default function ShuttlesPage() {
  const router = useRouter()
  const booking = useBooking()
  const [pickup, setPickup] = useState<GooglePlaceSelection>(EMPTY_PLACE)
  const [destination, setDestination] = useState<GooglePlaceSelection>(
    booking.stay?.address || booking.stay?.lat
      ? { address: booking.stay.address || booking.stay.title, lat: booking.stay.lat, lng: booking.stay.lng }
      : EMPTY_PLACE
  )
  const [date, setDate] = useState(booking.checkIn || '')
  const [passengers, setPassengers] = useState(booking.guests || 2)
  const [shuttleType, setShuttleType] = useState<ShuttleType>('Private Shuttle')
  const [added, setAdded] = useState(false)
  const [supplierChoice, setSupplierChoice] = useState<ShuttleSupplierChoice | null>(null)
  const [eligibleCount, setEligibleCount] = useState<number | null>(null)

  // Live driving distance & duration straight from the Google Distance
  // Matrix — the only source of route data on this page.
  const { result, status } = useAutoDrivingDistance(
    { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
    { address: destination.address, lat: destination.lat, lng: destination.lng },
  )

  const price = supplierChoice
    ? supplierChoice.price
    : result ? estimateTransferPrice(result.distanceKm, passengers, shuttleType) : null
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
      shuttleType,
      result,
      supplier: supplierChoice ?? undefined,
    }))
    setAdded(true)
  }

  return (
    <main className="bg-mist min-h-screen pt-16">
      <section className="bg-forest text-white py-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-3">Door-to-door transfers</p>
          <h1 className="font-display text-5xl lg:text-6xl text-white leading-none mb-4">Shuttles & Transfers</h1>
          <p className="font-sans text-sm text-white/50 max-w-xl">
            Pick up anywhere, drop off anywhere. Your transfer is quoted from live driving distance and
            operated by the best-matched company in our transport partner marketplace.
          </p>
          <Link href="/transport" className="inline-flex items-center gap-1.5 mt-4 font-sans text-sm text-gold hover:text-white transition-colors">
            Browse fixed-price routes <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-black/8 p-6 space-y-8">
          <section>
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

          <section>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <section>
              <p className={fieldLabel}>Step 3 · Date</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={fieldInput} />
            </section>
            <section>
              <p className={fieldLabel}>Step 4 · Passengers</p>
              <input type="number" min={1} max={20} value={passengers} onChange={e => setPassengers(Math.max(1, parseInt(e.target.value) || 1))} className={fieldInput} />
            </section>
            <section>
              <p className={fieldLabel}>Step 5 · Shuttle type</p>
              <select value={shuttleType} onChange={e => setShuttleType(e.target.value as ShuttleType)} className={fieldInput}>
                {SHUTTLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </section>
          </div>

          <section>
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
                    <p className="font-sans text-xs text-forest/40">{suggestedVehicleType(passengers)} · {passengers} passenger{passengers !== 1 ? 's' : ''} · {shuttleType}</p>
                  </div>
                  {price !== null && <p className="font-display text-xl text-forest">R{price.toLocaleString()}</p>}
                </div>
              )}
            </div>
          </section>

          <section>
            <p className={fieldLabel}>Step 6 · Choose your transport partner & vehicle</p>
            <div className="border border-gray-100">
              {!result || !date
                ? <p className="p-5 font-sans text-sm text-gray-400">Complete the route and date above to see available transport partners.</p>
                : (
                  <TransportSupplierPicker
                    pickup={{ address: pickup.address, lat: pickup.lat, lng: pickup.lng }}
                    dropoff={{ address: destination.address, lat: destination.lat, lng: destination.lng }}
                    date={date}
                    passengers={passengers}
                    shuttleType={shuttleType}
                    distanceKm={result.distanceKm}
                    selected={supplierChoice}
                    onSelect={setSupplierChoice}
                    onCandidates={setEligibleCount}
                  />
                )}
            </div>
          </section>

          <section className="border-t border-gray-100 pt-6">
            <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-forest/30 mb-4">Who drives you</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(SUPPLIER_CATEGORIES).map(([key, cat]) => (
                <div key={key} className="border border-gray-100 p-4">
                  <p className="font-display text-base text-forest mb-1">{cat.label}s</p>
                  <p className="font-sans text-xs text-forest/50 leading-relaxed">{cat.description}</p>
                </div>
              ))}
            </div>
            <p className="font-sans text-xs text-forest/40 mt-4">
              Every transfer is matched to the most suitable registered operator — by region, vehicle,
              availability, reliability and price — the moment your booking is confirmed.
            </p>
          </section>
        </div>

        <aside className="bg-forest text-white p-8 h-fit sticky top-24">
          <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-white/40 mb-3">Step 7 · Review & add to trip</p>
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
            <span className="font-display text-3xl text-gold">{price !== null ? `R${price.toLocaleString()}` : '—'}</span>
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

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Car, Bus, Check, Clock, ChevronRight, MapPin } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import { GoogleAddressField, useAutoDrivingDistance, type GooglePlaceSelection } from '@/components/maps/GoogleAddressField'
import { buildShuttleOption, estimateTransferPrice, suggestedVehicleType, SHUTTLE_TYPES, type ShuttleSupplierChoice, type ShuttleType } from '@/lib/shuttle-service'
import { TransportSupplierPicker } from '@/components/booking/TransportSupplierPicker'

// Transfers are quoted live from the Google Distance Matrix against the
// guest's real pickup point and their actual stay — no fixed provider list.
// The operating company is matched by the marketplace dispatch engine after
// checkout.

export default function ShuttlePage() {
  const router = useRouter()
  const booking = useBooking()
  const [needsShuttle, setNeedsShuttle] = useState<boolean | null>(null)
  const [pickup, setPickup] = useState<GooglePlaceSelection>({ address: '' })
  const [shuttleType, setShuttleType] = useState<ShuttleType>('Private Shuttle')
  const [date, setDate] = useState(booking.checkIn || '')
  const [supplierChoice, setSupplierChoice] = useState<ShuttleSupplierChoice | null>(null)
  const [eligibleCount, setEligibleCount] = useState<number | null>(null)

  const stay = booking.stay
  const destination: GooglePlaceSelection = stay
    ? { address: stay.address || `${stay.title}, ${stay.region}, South Africa`, lat: stay.lat, lng: stay.lng }
    : { address: booking.region ? `${booking.region}, Drakensberg, South Africa` : '' }

  const passengers = booking.guests || 2

  const { result, status } = useAutoDrivingDistance(
    { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
    destination,
  )

  const shuttlePrice = needsShuttle && result
    ? (supplierChoice?.price ?? estimateTransferPrice(result.distanceKm, passengers, shuttleType))
    : 0
  // The transfer needs a chosen transport partner + vehicle unless no
  // registered partner covers the route (then dispatch places it later).
  const canConfirm = needsShuttle === false
    || (needsShuttle === true && result && date && (supplierChoice || eligibleCount === 0))

  function confirm() {
    if (needsShuttle === false) {
      booking.setShuttle(null)
      router.push('/checkout')
      return
    }
    if (!result || !date) return
    booking.setShuttle(buildShuttleOption({
      id: `shuttle-${Date.now()}`,
      pickup: { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
      destination: { address: destination.address, lat: destination.lat, lng: destination.lng },
      date,
      passengers,
      shuttleType,
      result,
      supplier: supplierChoice ?? undefined,
    }))
    router.push('/checkout')
  }

  const nights = booking.nights
  const stayTotal = stay ? stay.price_per_night * nights : 0
  const addonTotal = booking.addons.reduce((s, a) => s + a.price_per_person * a.guests, 0)
  const grandTotal = stayTotal + addonTotal + shuttlePrice

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      <section className="bg-[#000000] text-white pt-32 pb-10 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 font-sans text-xs text-white/40 hover:text-white transition-colors mb-6">
            <ArrowLeft size={12} /> Back
          </button>
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">Almost there</p>
          <h1 className="font-display italic text-4xl lg:text-5xl mb-2">Getting to the Berg</h1>
          <p className="font-sans text-sm text-white/50">
            {stay?.region || booking.region
              ? `Getting to ${stay?.region || booking.region}`
              : 'Will you need a shuttle to your accommodation?'}
          </p>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Left: shuttle question + live quote */}
          <div className="lg:col-span-2 space-y-8">

            {/* Self-drive vs shuttle */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-5">How are you getting there?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setNeedsShuttle(false)}
                  className={`flex items-start gap-4 p-5 border text-left transition-colors ${
                    needsShuttle === false ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 bg-white hover:border-gray-400'
                  }`}
                >
                  <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${needsShuttle === false ? 'bg-[#2d6a4f]' : 'bg-[#F7F5F2]'}`}>
                    <Car size={18} className={needsShuttle === false ? 'text-white' : 'text-gray-500'} />
                  </div>
                  <div>
                    <p className="font-display italic text-lg mb-1">Self-drive</p>
                    <p className="font-sans text-xs text-gray-500">I have my own transport and will drive to the accommodation.</p>
                    {needsShuttle === false && <p className="font-sans text-xs text-[#2d6a4f] mt-2 flex items-center gap-1"><Check size={11} /> Selected</p>}
                  </div>
                </button>
                <button
                  onClick={() => setNeedsShuttle(true)}
                  className={`flex items-start gap-4 p-5 border text-left transition-colors ${
                    needsShuttle === true ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 bg-white hover:border-gray-400'
                  }`}
                >
                  <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${needsShuttle === true ? 'bg-[#2d6a4f]' : 'bg-[#F7F5F2]'}`}>
                    <Bus size={18} className={needsShuttle === true ? 'text-white' : 'text-gray-500'} />
                  </div>
                  <div>
                    <p className="font-display italic text-lg mb-1">I need a shuttle</p>
                    <p className="font-sans text-xs text-gray-500">Quote a door-to-door transfer from any pickup point.</p>
                    {needsShuttle === true && <p className="font-sans text-xs text-[#2d6a4f] mt-2 flex items-center gap-1"><Check size={11} /> Selected</p>}
                  </div>
                </button>
              </div>
            </div>

            {/* Live transfer quote */}
            {needsShuttle === true && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display italic text-2xl text-[#000000] mb-2">
                    Your transfer to {stay?.title || stay?.region || booking.region || 'the Berg'}
                  </h2>
                  <p className="font-sans text-xs text-gray-400 mb-5">
                    Priced per vehicle from live driving distance · operated by a matched transport partner
                  </p>

                  <div className="bg-white border border-gray-200 p-5 space-y-5">
                    <GoogleAddressField
                      label="Pickup location"
                      value={pickup.address}
                      lat={pickup.lat}
                      lng={pickup.lng}
                      required
                      placeholder="Airport, hotel, home address…"
                      inputClassName="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] transition-colors"
                      labelClassName="font-sans text-xs text-gray-500 mb-2 block"
                      onChange={setPickup}
                    />

                    <div className="flex items-start gap-2 font-sans text-xs text-gray-500">
                      <MapPin size={13} className="shrink-0 mt-0.5 text-[#C9A96E]" />
                      <span>Drop-off: {destination.address || 'your accommodation'}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="font-sans text-xs text-gray-500 mb-2 block">Transfer date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                          className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
                      </div>
                      <div>
                        <label className="font-sans text-xs text-gray-500 mb-2 block">Shuttle type</label>
                        <select value={shuttleType} onChange={e => setShuttleType(e.target.value as ShuttleType)}
                          className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]">
                          {SHUTTLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      {status === 'idle' && <p className="font-sans text-sm text-gray-400">Enter a pickup point to quote your transfer.</p>}
                      {status === 'calculating' && <p className="font-sans text-sm text-gray-400">Calculating driving distance…</p>}
                      {status === 'error' && <p className="font-sans text-sm text-red-500">We could not find a driving route from that pickup point. Try a more specific address.</p>}
                      {status === 'done' && result && (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex flex-wrap gap-4 font-sans text-xs text-gray-500">
                            <span className="flex items-center gap-1"><MapPin size={11} />{result.distanceKm} km</span>
                            <span className="flex items-center gap-1"><Clock size={11} />~{result.durationText}</span>
                            <span className="flex items-center gap-1"><Bus size={11} />{supplierChoice ? supplierChoice.vehicleName : suggestedVehicleType(passengers)} · {passengers} passenger{passengers !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-display italic text-2xl text-[#2d6a4f]">R {shuttlePrice.toLocaleString()}</p>
                            <p className="font-sans text-[10px] text-gray-400">per vehicle{supplierChoice ? ` · ${supplierChoice.companyName}` : ''}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Choose the transport partner + vehicle for this transfer */}
                {result && date && (
                  <div>
                    <h2 className="font-display italic text-2xl text-[#000000] mb-2">Choose your transport partner</h2>
                    <p className="font-sans text-xs text-gray-400 mb-5">
                      Registered operators are ranked by suitability for this route. Pick the company and vehicle that will drive you.
                    </p>
                    <div className="bg-white border border-gray-200">
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
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Confirm */}
            {canConfirm && (
              <button
                onClick={confirm}
                className="w-full bg-[#C9A96E] hover:bg-[#b8935e] text-[#1a1a1a] font-sans text-sm font-medium py-4 flex items-center justify-center gap-2 transition-colors"
              >
                Continue to Checkout <ChevronRight size={16} />
              </button>
            )}

            {needsShuttle === null && (
              <p className="font-sans text-xs text-gray-400 text-center">Select an option above to continue</p>
            )}
          </div>

          {/* Right: booking summary */}
          <div>
            <div className="bg-[#000000] text-white p-6 sticky top-24">
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-4">Your Booking</p>

              {stay && (
                <div className="mb-4 pb-4 border-b border-white/10">
                  <p className="font-sans text-[10px] uppercase text-white/30 mb-1">Accommodation</p>
                  <p className="font-display italic text-lg">{stay.title}</p>
                  <p className="font-sans text-xs text-white/40 mt-0.5">{stay.region}</p>
                  <p className="font-sans text-xs text-white/40 mt-1">
                    R {stay.price_per_night.toLocaleString()} × {nights} night{nights !== 1 ? 's' : ''} = R {stayTotal.toLocaleString()}
                  </p>
                </div>
              )}

              {booking.addons.length > 0 && (
                <div className="mb-4 pb-4 border-b border-white/10">
                  <p className="font-sans text-[10px] uppercase text-white/30 mb-2">Add-ons ({booking.addons.length})</p>
                  {booking.addons.map(a => (
                    <div key={a.id} className="flex justify-between font-sans text-xs text-white/60 mb-1.5">
                      <span className="truncate mr-2">{a.title}</span>
                      <span className="shrink-0">R {(a.price_per_person * a.guests).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {needsShuttle && result && (
                <div className="mb-4 pb-4 border-b border-white/10">
                  <p className="font-sans text-[10px] uppercase text-white/30 mb-1">Shuttle</p>
                  <div className="flex justify-between font-sans text-xs text-white/60">
                    <span className="truncate mr-2">{pickup.address || 'Transfer'} → {stay?.title || 'accommodation'}</span>
                    <span>R {shuttlePrice.toLocaleString()}</span>
                  </div>
                  {supplierChoice && (
                    <p className="font-sans text-[11px] text-white/40 mt-1">{supplierChoice.companyName} · {supplierChoice.vehicleName}</p>
                  )}
                </div>
              )}

              <div className="flex justify-between items-baseline">
                <span className="font-sans text-sm text-white/60">Estimated total</span>
                <span className="font-display italic text-3xl text-[#C9A96E]">R {grandTotal.toLocaleString()}</span>
              </div>
              <p className="font-sans text-[10px] text-white/30 mt-1">Final total confirmed at checkout</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Car, Bus, Check, MapPin, Clock, Users, ChevronRight, X } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'

const SHUTTLE_OPTIONS_BY_REGION: Record<string, { id: string; label: string; description: string; pickup: string; price: number; duration: string; capacity: number }[]> = {
  default: [
    {
      id: 'sh-jnb-shared',
      label: 'Shared Shuttle from Johannesburg',
      description: 'Daily departures from OR Tambo International Airport. Shared with up to 8 passengers. Drops at your lodge.',
      pickup: 'OR Tambo International Airport, Johannesburg',
      price: 650,
      duration: '4–5 hours',
      capacity: 8,
    },
    {
      id: 'sh-jnb-private',
      label: 'Private Transfer from Johannesburg',
      description: 'Dedicated vehicle for your group. Door-to-door from any Johannesburg address.',
      pickup: 'Any Johannesburg address',
      price: 2800,
      duration: '4–5 hours',
      capacity: 8,
    },
    {
      id: 'sh-dbn-shared',
      label: 'Shared Shuttle from Durban',
      description: 'Departs King Shaka International Airport daily at 08:00 and 13:00.',
      pickup: "King Shaka International Airport, Durban",
      price: 480,
      duration: '2.5–3 hours',
      capacity: 8,
    },
    {
      id: 'sh-dbn-private',
      label: 'Private Transfer from Durban',
      description: 'Direct door-to-door transfer from any Durban address.',
      pickup: 'Any Durban address',
      price: 1800,
      duration: '2.5–3 hours',
      capacity: 8,
    },
  ],
  'Northern Berg': [
    {
      id: 'sh-nb-jnb-shared',
      label: 'Shared Shuttle · Johannesburg → Royal Natal',
      description: 'Departs OR Tambo daily at 07:30. Arrives Sentinel Car Park and Tendele area by 12:30.',
      pickup: 'OR Tambo International Airport',
      price: 700,
      duration: '5 hours',
      capacity: 8,
    },
    {
      id: 'sh-nb-jnb-private',
      label: 'Private Transfer · Johannesburg → Northern Berg',
      description: 'Private vehicle, any pickup point in Johannesburg or Pretoria.',
      pickup: 'Any Joburg / Pretoria address',
      price: 3200,
      duration: '4.5–5 hours',
      capacity: 6,
    },
    {
      id: 'sh-nb-dbn-shared',
      label: 'Shared Shuttle · Durban → Royal Natal',
      description: 'Departs King Shaka Airport at 08:00 and 13:00. 3-hour scenic route.',
      pickup: 'King Shaka International Airport',
      price: 520,
      duration: '3 hours',
      capacity: 10,
    },
  ],
  'Central Berg': [
    {
      id: 'sh-cb-jnb-shared',
      label: 'Shared Shuttle · Johannesburg → Champagne Valley',
      description: 'Daily departures from OR Tambo at 07:00. Via Harrismith N3.',
      pickup: 'OR Tambo International Airport',
      price: 680,
      duration: '4.5 hours',
      capacity: 8,
    },
    {
      id: 'sh-cb-dbn-shared',
      label: 'Shared Shuttle · Durban → Central Berg',
      description: 'Departs King Shaka at 09:00 daily. Drops at Cathedral Peak, Champagne Valley and Giants Castle.',
      pickup: 'King Shaka International Airport',
      price: 460,
      duration: '2.5 hours',
      capacity: 10,
    },
    {
      id: 'sh-cb-private',
      label: 'Private Transfer · Any Origin → Central Berg',
      description: 'Custom pickup location anywhere in KZN or Gauteng.',
      pickup: 'Custom pickup point',
      price: 2400,
      duration: 'Varies',
      capacity: 8,
    },
  ],
  'Southern Berg': [
    {
      id: 'sh-sb-dbn-shared',
      label: 'Shared Shuttle · Durban → Sani Pass',
      description: 'Departs King Shaka Airport at 08:00. Arrives Sani Pass Lower Gate by 11:30.',
      pickup: 'King Shaka International Airport',
      price: 540,
      duration: '3.5 hours',
      capacity: 8,
    },
    {
      id: 'sh-sb-4x4',
      label: '4×4 Sani Pass Ascent Transfer',
      description: 'Dedicated 4×4 shuttle up the Sani Pass to the Lesotho border. Departs 08:00 and 10:00.',
      pickup: 'Sani Pass Lower Gate',
      price: 450,
      duration: '1.5 hours',
      capacity: 6,
    },
  ],
}

export default function ShuttlePage() {
  const router = useRouter()
  const booking = useBooking()
  const [needsShuttle, setNeedsShuttle] = useState<boolean | null>(null)
  const [selected, setSelected] = useState<string | null>(booking.shuttle?.id || null)

  const region = booking.stay?.region || booking.region || 'default'
  const shuttles = SHUTTLE_OPTIONS_BY_REGION[region] || SHUTTLE_OPTIONS_BY_REGION.default

  function confirm() {
    if (needsShuttle === false) {
      booking.setShuttle(null)
      router.push('/checkout')
      return
    }
    if (!selected) return
    const opt = shuttles.find(s => s.id === selected)
    if (opt) {
      booking.setShuttle({ id: opt.id, label: opt.label, price: opt.price, description: opt.description })
    }
    router.push('/checkout')
  }

  const nights = booking.nights
  const stayTotal = booking.stay ? booking.stay.price_per_night * nights : 0
  const addonTotal = booking.addons.reduce((s, a) => s + a.price_per_person * a.guests, 0)
  const selectedShuttlePrice = needsShuttle && selected ? (shuttles.find(s => s.id === selected)?.price ?? 0) : 0
  const grandTotal = stayTotal + addonTotal + selectedShuttlePrice

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
            {booking.stay?.region || booking.region
              ? `Getting to ${booking.stay?.region || booking.region}`
              : 'Will you need a shuttle to your accommodation?'}
          </p>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Left: shuttle question + options */}
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
                    <p className="font-sans text-xs text-gray-500">Show me transfer options from major airports and cities.</p>
                    {needsShuttle === true && <p className="font-sans text-xs text-[#2d6a4f] mt-2 flex items-center gap-1"><Check size={11} /> Selected</p>}
                  </div>
                </button>
              </div>
            </div>

            {/* Shuttle options */}
            {needsShuttle === true && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-2">
                  Shuttles to {booking.stay?.region || booking.region || 'the Berg'}
                </h2>
                <p className="font-sans text-xs text-gray-400 mb-5">Per vehicle (not per person) unless noted</p>
                <div className="space-y-4">
                  {shuttles.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSelected(opt.id)}
                      className={`w-full text-left p-5 border transition-colors ${
                        selected === opt.id ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 bg-white hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`w-5 h-5 border-2 shrink-0 mt-0.5 flex items-center justify-center ${selected === opt.id ? 'border-[#2d6a4f] bg-[#2d6a4f]' : 'border-gray-300'}`}>
                            {selected === opt.id && <Check size={11} className="text-white" />}
                          </div>
                          <div>
                            <p className="font-display italic text-lg mb-1">{opt.label}</p>
                            <p className="font-sans text-sm text-gray-600 mb-3">{opt.description}</p>
                            <div className="flex flex-wrap gap-4 font-sans text-xs text-gray-400">
                              <span className="flex items-center gap-1"><MapPin size={11} />{opt.pickup}</span>
                              <span className="flex items-center gap-1"><Clock size={11} />{opt.duration}</span>
                              <span className="flex items-center gap-1"><Users size={11} />Up to {opt.capacity} passengers</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-display italic text-2xl text-[#2d6a4f]">R {opt.price.toLocaleString()}</p>
                          <p className="font-sans text-[10px] text-gray-400">per vehicle</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm */}
            {needsShuttle !== null && (needsShuttle === false || selected) && (
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

              {booking.stay && (
                <div className="mb-4 pb-4 border-b border-white/10">
                  <p className="font-sans text-[10px] uppercase text-white/30 mb-1">Accommodation</p>
                  <p className="font-display italic text-lg">{booking.stay.title}</p>
                  <p className="font-sans text-xs text-white/40 mt-0.5">{booking.stay.region}</p>
                  <p className="font-sans text-xs text-white/40 mt-1">
                    R {booking.stay.price_per_night.toLocaleString()} × {nights} night{nights !== 1 ? 's' : ''} = R {stayTotal.toLocaleString()}
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

              {needsShuttle && selected && (
                <div className="mb-4 pb-4 border-b border-white/10">
                  <p className="font-sans text-[10px] uppercase text-white/30 mb-1">Shuttle</p>
                  <div className="flex justify-between font-sans text-xs text-white/60">
                    <span className="truncate mr-2">{shuttles.find(s => s.id === selected)?.label}</span>
                    <span>R {selectedShuttlePrice.toLocaleString()}</span>
                  </div>
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

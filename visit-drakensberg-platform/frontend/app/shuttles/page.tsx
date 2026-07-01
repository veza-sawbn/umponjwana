'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Bus, Calendar, MapPin, Users } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { useBooking } from '@/lib/booking-context'
import {
  SHUTTLE_LOCATIONS, findAvailableRoutes, toShuttleOption,
  type LocationType, type ShuttleType,
} from '@/lib/shuttle-service'

const LOCATION_TYPES: LocationType[] = ['Accommodation', 'Airport', 'Hiking trail', 'Town', 'Attraction', 'Landmark', 'GPS location']
const SHUTTLE_TYPES: ShuttleType[] = ['Shared Shuttle', 'Private Shuttle', 'Premium Shuttle']

function fmtMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export default function ShuttlesPage() {
  const booking = useBooking()
  const [pickupType, setPickupType] = useState<LocationType>('Airport')
  const [destinationType, setDestinationType] = useState<LocationType>('Accommodation')
  const [pickupId, setPickupId] = useState('jnb-or-tambo')
  const [destinationId, setDestinationId] = useState(booking.stay?.title.toLowerCase().includes('cathedral') ? 'cathedral-peak-hotel' : 'champagne-valley')
  const [date, setDate] = useState(booking.checkIn || '')
  const [passengers, setPassengers] = useState(booking.guests || 2)
  const [shuttleType, setShuttleType] = useState<ShuttleType>('Private Shuttle')

  const pickupOptions = SHUTTLE_LOCATIONS.filter(l => l.type === pickupType)
  const destinationOptions = SHUTTLE_LOCATIONS.filter(l => l.type === destinationType)
  const available = useMemo(() => date ? findAvailableRoutes({ pickupId, destinationId, date, passengers, shuttleType }) : [], [pickupId, destinationId, date, passengers, shuttleType])
  const routeForCapacity = findAvailableRoutes({ pickupId, destinationId, date: date || 'pending', passengers: 1, shuttleType }).at(0)?.route
  const capacityError = routeForCapacity && passengers > routeForCapacity.capacity

  function chooseLocation(type: LocationType, kind: 'pickup' | 'destination') {
    if (kind === 'pickup') {
      setPickupType(type)
      setPickupId(SHUTTLE_LOCATIONS.find(l => l.type === type)?.id || '')
    } else {
      setDestinationType(type)
      setDestinationId(SHUTTLE_LOCATIONS.find(l => l.type === type)?.id || '')
    }
  }

  return (
    <main className="bg-mist min-h-screen pt-16">
      <section className="bg-forest text-white py-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-3">Ride-style booking</p>
          <h1 className="font-display text-5xl lg:text-6xl text-white leading-none mb-4">Shuttles & Transfers</h1>
          <p className="font-sans text-sm text-white/50">Choose pickup, destination, travel date, passengers and shuttle type.</p>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-black/8 p-6 space-y-8">
          <section>
            <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-gold mb-3">Step 1 · Choose Pickup Location</p>
            <div className="flex flex-wrap gap-2 mb-4">{LOCATION_TYPES.map(type => <button key={type} disabled={type === 'GPS location'} onClick={() => chooseLocation(type, 'pickup')} className={`px-3 py-2 font-sans text-xs border ${pickupType === type ? 'bg-forest text-white border-forest' : 'border-gray-200 text-forest/70'} disabled:opacity-40`}>{type}</button>)}</div>
            <select value={pickupId} onChange={e => setPickupId(e.target.value)} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm">{pickupOptions.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          </section>

          <section>
            <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-gold mb-3">Step 2 · Choose Destination</p>
            <div className="flex flex-wrap gap-2 mb-4">{LOCATION_TYPES.filter(t => t !== 'GPS location').map(type => <button key={type} onClick={() => chooseLocation(type, 'destination')} className={`px-3 py-2 font-sans text-xs border ${destinationType === type ? 'bg-forest text-white border-forest' : 'border-gray-200 text-forest/70'}`}>{type}</button>)}</div>
            <select value={destinationId} onChange={e => setDestinationId(e.target.value)} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm">{destinationOptions.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <section><p className="font-sans text-[10px] tracking-[0.16em] uppercase text-gold mb-3">Step 3 · Date</p><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm" /></section>
            <section><p className="font-sans text-[10px] tracking-[0.16em] uppercase text-gold mb-3">Step 4 · Passengers</p><input type="number" min={1} max={20} value={passengers} onChange={e => setPassengers(parseInt(e.target.value) || 1)} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm" />{capacityError && <p className="font-sans text-xs text-red-500 mt-2">Passenger count exceeds vehicle capacity of {routeForCapacity.capacity}.</p>}</section>
            <section><p className="font-sans text-[10px] tracking-[0.16em] uppercase text-gold mb-3">Step 5 · Shuttle Type</p><select value={shuttleType} onChange={e => setShuttleType(e.target.value as ShuttleType)} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm">{SHUTTLE_TYPES.map(t => <option key={t} value={t} disabled={t === 'Premium Shuttle'}>{t}{t === 'Premium Shuttle' ? ' (future)' : ''}</option>)}</select></section>
          </div>

          <section>
            <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-gold mb-3">Available shuttle schedules</p>
            <div className="divide-y divide-gray-100 border border-gray-100">
              {!date && <p className="p-5 font-sans text-sm text-gray-400">Select a travel date to view schedules.</p>}
              {date && available.length === 0 && <p className="p-5 font-sans text-sm text-gray-400">No available route matches these details. Try a private transfer, fewer passengers, or another pickup/destination.</p>}
              {available.map(({ route, price }) => (
                <button key={route.id} onClick={() => booking.setShuttle(toShuttleOption(route, { pickupId, destinationId, date, passengers, shuttleType }))} className="w-full flex items-center gap-4 p-5 text-left hover:bg-mist transition-colors">
                  <Bus className="text-forest" size={20} /><div className="flex-1"><p className="font-display text-lg text-forest">{route.schedules.join(' · ')}</p><p className="font-sans text-xs text-forest/40">{fmtMinutes(route.durationMinutes)} · {route.vehicleType} · capacity {route.capacity}</p></div><p className="font-display text-xl text-forest">R{price.toLocaleString()}</p><ArrowRight className="text-gold" size={16} />
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="bg-forest text-white p-8 h-fit sticky top-24">
          <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-white/40 mb-3">Step 6 · Review Booking</p>
          <div className="space-y-4 font-sans text-sm text-white/70">
            <p className="flex gap-2"><MapPin size={14} />Pickup: {SHUTTLE_LOCATIONS.find(l => l.id === pickupId)?.name || '—'}</p>
            <p className="flex gap-2"><MapPin size={14} />Destination: {SHUTTLE_LOCATIONS.find(l => l.id === destinationId)?.name || '—'}</p>
            <p className="flex gap-2"><Calendar size={14} />Date: {date || 'Select date'}</p>
            <p className="flex gap-2"><Users size={14} />Passengers: {passengers}</p>
            <p>Vehicle type: {available[0]?.route.vehicleType || '—'}</p>
            <p>Estimated duration: {available[0] ? fmtMinutes(available[0].route.durationMinutes) : '—'}</p>
          </div>
          <div className="border-t border-white/10 mt-6 pt-6 flex items-end justify-between"><span className="font-sans text-xs text-white/40">Price</span><span className="font-display text-3xl text-gold">{available[0] ? `R${available[0].price.toLocaleString()}` : '—'}</span></div>
          <p className="font-sans text-xs text-white/40 mt-4">Selecting a schedule adds the shuttle directly to your itinerary and checkout.</p>
        </aside>
      </div>
      <Footer />
    </main>
  )
}

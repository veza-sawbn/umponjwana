'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Calendar, Users, Search } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'

const REGIONS = [
  'All Drakensberg',
  'Northern Berg',
  'Central Berg',
  'Southern Berg',
  'Royal Natal',
  'Champagne Valley',
  "Giant's Castle",
  'Sani Pass',
]

export default function SearchBar() {
  const router = useRouter()
  const { setSearch, region: savedRegion, checkIn: savedCheckIn, checkOut: savedCheckOut, guests: savedGuests } = useBooking()
  const [region, setRegion] = useState(savedRegion || '')
  const [checkIn, setCheckIn] = useState(savedCheckIn || '')
  const [checkOut, setCheckOut] = useState(savedCheckOut || '')
  const [guests, setGuests] = useState(savedGuests || 2)

  const today = new Date().toISOString().split('T')[0]

  function handleSearch() {
    setSearch(region, checkIn, checkOut, guests)
    const params = new URLSearchParams()
    if (region) params.set('region', region)
    if (checkIn) params.set('check_in', checkIn)
    if (checkOut) params.set('check_out', checkOut)
    params.set('guests', String(guests))
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="bg-white border border-white/20 shadow-2xl">
      {/* Fields row */}
      <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-black/10">

        {/* Region */}
        <div className="px-5 py-4">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1.5 flex items-center gap-1.5">
            <MapPin size={10} /> Where
          </p>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="w-full font-sans text-sm text-[#111] bg-transparent focus:outline-none appearance-none cursor-pointer"
          >
            {REGIONS.map(r => (
              <option key={r} value={r === 'All Drakensberg' ? '' : r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Check in */}
        <div className="px-5 py-4">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1.5 flex items-center gap-1.5">
            <Calendar size={10} /> Check in
          </p>
          <input
            type="date"
            value={checkIn}
            onChange={e => setCheckIn(e.target.value)}
            min={today}
            className="w-full font-sans text-sm text-[#111] bg-transparent focus:outline-none"
          />
        </div>

        {/* Check out */}
        <div className="px-5 py-4">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1.5 flex items-center gap-1.5">
            <Calendar size={10} /> Check out
          </p>
          <input
            type="date"
            value={checkOut}
            onChange={e => setCheckOut(e.target.value)}
            min={checkIn || today}
            className="w-full font-sans text-sm text-[#111] bg-transparent focus:outline-none"
          />
        </div>

        {/* Guests */}
        <div className="px-5 py-4">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1.5 flex items-center gap-1.5">
            <Users size={10} /> Guests
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setGuests(g => Math.max(1, g - 1))}
              className="w-6 h-6 border border-gray-300 text-gray-500 hover:border-[#2d6a4f] hover:text-[#2d6a4f] text-sm transition-colors flex items-center justify-center"
            >−</button>
            <span className="font-sans text-sm text-[#111] min-w-[2ch] text-center">{guests}</span>
            <button
              onClick={() => setGuests(g => g + 1)}
              className="w-6 h-6 border border-gray-300 text-gray-500 hover:border-[#2d6a4f] hover:text-[#2d6a4f] text-sm transition-colors flex items-center justify-center"
            >+</button>
          </div>
        </div>
      </div>

      {/* Search button — full-width bottom strip */}
      <button
        onClick={handleSearch}
        className="w-full bg-[#2d6a4f] hover:bg-[#235a3f] transition-colors text-white py-4 flex items-center justify-center gap-2.5 font-sans text-sm tracking-[0.08em] uppercase"
      >
        <Search size={15} />
        Search Availability
      </button>
    </div>
  )
}

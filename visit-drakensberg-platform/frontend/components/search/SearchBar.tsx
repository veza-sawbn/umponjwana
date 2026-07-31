'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Calendar, Users, Search, ChevronDown } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import { getRegionNames } from '@/lib/regions'

const DEFAULT_REGION_LABELS = ['All Drakensberg']

export default function SearchBar() {
  const router = useRouter()
  const { setSearch, region: savedRegion, checkIn: savedCheckIn, checkOut: savedCheckOut, guests: savedGuests } = useBooking()
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState(savedRegion || '')
  const [regions, setRegions] = useState(DEFAULT_REGION_LABELS)
  const [checkIn, setCheckIn] = useState(savedCheckIn || '')
  const [checkOut, setCheckOut] = useState(savedCheckOut || '')
  const [guests, setGuests] = useState(savedGuests || 2)
  const [isMobileExpanded, setIsMobileExpanded] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    getRegionNames().then(names => setRegions(['All Drakensberg', ...names]))
  }, [])

  function handleSearch() {
    setSearch(region, checkIn, checkOut, guests)
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (region) params.set('region', region)
    if (checkIn) params.set('check_in', checkIn)
    if (checkOut) params.set('check_out', checkOut)
    params.set('guests', String(guests))
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="bg-white/50 backdrop-blur-md border border-white/20 shadow-lg">
      <button
        type="button"
        onClick={() => setIsMobileExpanded(open => !open)}
        aria-expanded={isMobileExpanded}
        aria-controls="home-search-availability-fields"
        className="md:hidden w-full bg-[#2d6a4f] text-white px-5 py-4 flex items-center justify-between gap-3 font-sans text-sm tracking-[0.08em] uppercase"
      >
        <span className="flex items-center gap-2.5">
          <Search size={15} />
          Search Availability
        </span>
        <ChevronDown size={16} className={`transition-transform ${isMobileExpanded ? 'rotate-180' : ''}`} />
      </button>

      <div id="home-search-availability-fields" className={`${isMobileExpanded ? 'block' : 'hidden'} md:block`}>
      {/* Free-text query */}
      <div className="px-5 py-4 border-b border-black/5 flex items-center gap-3">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          placeholder="Search lodges, hikes, activities, towns…"
          aria-label="Search the Drakensberg"
          className="w-full font-sans text-sm text-[#111] placeholder:text-gray-400 bg-transparent focus:outline-none"
        />
      </div>

      {/* Fields row */}
      <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-black/5">

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
            {regions.map(r => (
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
              aria-label="Remove one guest"
              className="w-6 h-6 border border-gray-300 text-gray-500 hover:border-[#2d6a4f] hover:text-[#2d6a4f] text-sm transition-colors flex items-center justify-center"
            >−</button>
            <span className="font-sans text-sm text-[#111] min-w-[2ch] text-center" aria-live="polite">{guests}</span>
            <button
              onClick={() => setGuests(g => g + 1)}
              aria-label="Add one guest"
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
    </div>
  )
}

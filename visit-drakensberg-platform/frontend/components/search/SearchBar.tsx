'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Calendar, Users, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'stays', label: 'Stays' },
  { value: 'activities', label: 'Activities' },
  { value: 'hikes', label: 'Hikes' },
  { value: 'shuttles', label: 'Shuttles' },
  { value: 'packages', label: 'Packages' },
]

export default function SearchBar() {
  const router = useRouter()
  const [location, setLocation] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(2)
  const [category, setCategory] = useState('')

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (location) params.set('location', location)
    if (checkIn) params.set('check_in', checkIn)
    if (checkOut) params.set('check_out', checkOut)
    if (guests > 1) params.set('guests', String(guests))
    const path = category ? `/${category}` : '/stays'
    router.push(`${path}?${params.toString()}`)
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-200">
        {/* Location */}
        <div className="flex items-center gap-3 px-5 py-4 flex-1 hover:bg-gray-50 cursor-text transition-colors">
          <MapPin className="h-5 w-5 text-primary-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Where</p>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Drakensberg destination"
              className="w-full text-sm font-medium text-gray-900 placeholder-gray-400 outline-none bg-transparent mt-0.5"
            />
          </div>
        </div>

        {/* Check in */}
        <div className="flex items-center gap-3 px-5 py-4 flex-1 hover:bg-gray-50 transition-colors cursor-text">
          <Calendar className="h-5 w-5 text-primary-500 shrink-0" />
          <div className="min-w-0 w-full">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Check in</p>
            <input
              type="date"
              value={checkIn}
              onChange={e => setCheckIn(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full text-sm font-medium text-gray-900 outline-none bg-transparent mt-0.5"
            />
          </div>
        </div>

        {/* Check out */}
        <div className="flex items-center gap-3 px-5 py-4 flex-1 hover:bg-gray-50 transition-colors cursor-text">
          <Calendar className="h-5 w-5 text-primary-500 shrink-0" />
          <div className="min-w-0 w-full">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Check out</p>
            <input
              type="date"
              value={checkOut}
              onChange={e => setCheckOut(e.target.value)}
              min={checkIn || new Date().toISOString().split('T')[0]}
              className="w-full text-sm font-medium text-gray-900 outline-none bg-transparent mt-0.5"
            />
          </div>
        </div>

        {/* Guests */}
        <div className="flex items-center gap-3 px-5 py-4 flex-1 hover:bg-gray-50 transition-colors">
          <Users className="h-5 w-5 text-primary-500 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Guests</p>
            <div className="flex items-center gap-2 mt-0.5">
              <button onClick={() => setGuests(g => Math.max(1, g - 1))} className="w-6 h-6 rounded-full border border-gray-300 text-gray-500 hover:border-primary-500 hover:text-primary-500 text-sm font-bold transition-colors flex items-center justify-center">−</button>
              <span className="text-sm font-medium text-gray-900 min-w-[2ch] text-center">{guests}</span>
              <button onClick={() => setGuests(g => g + 1)} className="w-6 h-6 rounded-full border border-gray-300 text-gray-500 hover:border-primary-500 hover:text-primary-500 text-sm font-bold transition-colors flex items-center justify-center">+</button>
            </div>
          </div>
        </div>

        {/* Category + Search */}
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="relative">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="appearance-none text-sm font-medium text-gray-700 bg-gray-100 rounded-lg pl-3 pr-8 py-2 outline-none cursor-pointer hover:bg-gray-200 transition-colors"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
          </div>
          <Button onClick={handleSearch} size="lg" className="gap-2 whitespace-nowrap">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>
      </div>
    </div>
  )
}

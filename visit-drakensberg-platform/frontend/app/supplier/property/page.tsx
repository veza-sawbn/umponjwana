'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, ToggleLeft, ToggleRight, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { formatMoney } from '@/lib/allocation'

const PROPERTIES = [
  { id: 'p1', name: 'Cathedral Peak Mountain Lodge', location: 'Cathedral Peak, Northern Berg', rooms_count: 4 },
  { id: 'p2', name: 'Berg Valley Guesthouse', location: 'Champagne Valley, Central Berg', rooms_count: 2 },
]

const ROOMS: Record<string, any[]> = {
  p1: [
    { id: 'r1', name: 'Mountain View Suite', max_guests: 2, price_per_night: 2200, amenities: ['En-suite', 'Fireplace', 'Mountain view', 'King bed'], is_available: true, bookings_this_month: 6 },
    { id: 'r2', name: 'Garden Chalet', max_guests: 4, price_per_night: 1850, amenities: ['Private braai', 'Kitchen', 'Garden access'], is_available: true, bookings_this_month: 4 },
    { id: 'r3', name: 'Classic Double', max_guests: 2, price_per_night: 1450, amenities: ['En-suite', 'Balcony', 'Double bed'], is_available: true, bookings_this_month: 8 },
    { id: 'r4', name: 'Backpacker Dorm', max_guests: 6, price_per_night: 380, amenities: ['Shared bathroom', 'Lockers'], is_available: false, bookings_this_month: 2 },
  ],
  p2: [
    { id: 'r5', name: 'Honeymoon Suite', max_guests: 2, price_per_night: 1600, amenities: ['En-suite', 'Jacuzzi', 'Valley view'], is_available: true, bookings_this_month: 5 },
    { id: 'r6', name: 'Family Room', max_guests: 5, price_per_night: 1200, amenities: ['2 bedrooms', 'Kitchenette', 'Garden'], is_available: true, bookings_this_month: 3 },
  ],
}

const BOOKINGS: Record<string, any[]> = {
  p1: [
    { id: 'bk1', room: 'Mountain View Suite', guest: 'Sarah van der Merwe', check_in: '2026-07-15', check_out: '2026-07-18', guests: 2, total: 6600, status: 'confirmed' },
    { id: 'bk2', room: 'Garden Chalet', guest: 'James Fourie', check_in: '2026-07-10', check_out: '2026-07-13', guests: 4, total: 5550, status: 'confirmed' },
    { id: 'bk3', room: 'Classic Double', guest: 'Priya Naidoo', check_in: '2026-07-20', check_out: '2026-07-22', guests: 2, total: 2900, status: 'pending' },
    { id: 'bk4', room: 'Backpacker Dorm', guest: 'Tom Kruger', check_in: '2026-07-08', check_out: '2026-07-10', guests: 3, total: 760, status: 'completed' },
  ],
  p2: [
    { id: 'bk5', room: 'Honeymoon Suite', guest: 'Lindiwe Dlamini', check_in: '2026-07-25', check_out: '2026-07-28', guests: 2, total: 4800, status: 'confirmed' },
  ],
}

type Tab = 'rooms' | 'bookings' | 'calendar' | 'revenue'

const STATUS_COLOR: Record<string, string> = {
  confirmed: 'text-[#2d6a4f] bg-[#2d6a4f]/10',
  pending: 'text-[#9a7840] bg-[#C9A96E]/10',
  completed: 'text-gray-500 bg-gray-100',
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function CalendarGrid({ bookings }: { bookings: any[] }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = (firstDay + 6) % 7

  const bookingDays = new Set(bookings.flatMap(b => {
    const days = []
    const start = new Date(b.check_in), end = new Date(b.check_out)
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() === month) days.push(d.getDate())
    }
    return days
  }))

  return (
    <div>
      <p className="font-display italic text-xl text-[#000000] mb-4">{MONTHS[month]} {year}</p>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => <div key={d} className="font-sans text-[10px] uppercase text-gray-400 text-center py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const booked = bookingDays.has(day)
          const isToday = day === today.getDate()
          return (
            <div key={day} className={`aspect-square flex items-center justify-center font-sans text-sm ${isToday ? 'ring-2 ring-[#2d6a4f]' : ''} ${booked ? 'bg-[#2d6a4f] text-white' : 'bg-white border border-gray-100 text-gray-700'}`}>
              {day}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 font-sans text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#2d6a4f] inline-block" /> Booked</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-white border border-gray-200 inline-block" /> Available</span>
      </div>
    </div>
  )
}

export default function PropertyDashboardPage() {
  const [selectedProp, setSelectedProp] = useState(PROPERTIES[0].id)
  const [tab, setTab] = useState<Tab>('rooms')
  const [rooms, setRooms] = useState(ROOMS)
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null)

  const property = PROPERTIES.find(p => p.id === selectedProp)!
  const propRooms = rooms[selectedProp] || []
  const propBookings = BOOKINGS[selectedProp] || []
  const revenue = propBookings.filter(b => b.status !== 'cancelled').reduce((s: number, b: any) => s + b.total, 0)
  const occupancy = Math.round((propRooms.filter(r => r.is_available).length / Math.max(propRooms.length, 1)) * 100)

  function toggleAvailability(roomId: string) {
    setRooms(prev => ({
      ...prev,
      [selectedProp]: prev[selectedProp].map(r => r.id === roomId ? { ...r, is_available: !r.is_available } : r)
    }))
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'rooms', label: `Rooms (${propRooms.length})` },
    { id: 'bookings', label: `Bookings (${propBookings.length})` },
    { id: 'calendar', label: 'Calendar' },
    { id: 'revenue', label: 'Revenue' },
  ]

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#2d6a4f] text-white py-16 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/supplier" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h1 className="font-display italic text-4xl lg:text-5xl">Property Management</h1>
          <p className="mt-3 text-white/70 font-sans text-lg">Manage rooms, bookings and revenue across your properties.</p>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Property sidebar */}
          <div className="lg:col-span-1">
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-3">Your Properties</p>
            <div className="space-y-2">
              {PROPERTIES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProp(p.id)}
                  className={`w-full text-left p-4 border transition-colors ${selectedProp === p.id ? 'bg-[#2d6a4f] text-white border-[#2d6a4f]' : 'bg-white border-gray-200 hover:border-[#2d6a4f] text-[#000000]'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-display italic text-lg leading-tight">{p.name}</p>
                    <ChevronRight size={16} className={selectedProp === p.id ? 'text-white/60' : 'text-gray-400'} />
                  </div>
                  <p className={`font-sans text-xs ${selectedProp === p.id ? 'text-white/60' : 'text-gray-500'}`}>{p.location}</p>
                  <p className={`font-sans text-xs mt-1 ${selectedProp === p.id ? 'text-white/60' : 'text-gray-400'}`}>{p.rooms_count} rooms</p>
                </button>
              ))}
              <Link href="/supplier/listings/new" className="block text-center border border-dashed border-gray-300 text-gray-400 hover:border-[#2d6a4f] hover:text-[#2d6a4f] py-3 font-sans text-sm transition-colors">
                <Plus size={14} className="inline mr-1" /> Add Property
              </Link>
            </div>
          </div>

          {/* Main panel */}
          <div className="lg:col-span-3">
            {/* Property header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display italic text-3xl text-[#000000]">{property.name}</h2>
                <p className="font-sans text-sm text-gray-500 mt-0.5">{property.location}</p>
              </div>
              <Link href={`/supplier/listings/${selectedProp}/edit`} className="border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
                Edit Listing
              </Link>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-gray-200 mb-8">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-5 py-3 font-sans text-sm border-b-2 transition-colors ${tab === t.id ? 'border-[#2d6a4f] text-[#2d6a4f] font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Rooms */}
            {tab === 'rooms' && (
              <div className="space-y-4">
                {propRooms.map(room => (
                  <div key={room.id} className="bg-white border border-gray-200">
                    <div className="flex items-start justify-between p-5">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-display italic text-xl">{room.name}</h3>
                          <button onClick={() => toggleAvailability(room.id)} className="flex items-center gap-1.5">
                            {room.is_available
                              ? <><ToggleRight size={22} className="text-[#2d6a4f]" /><span className="font-sans text-xs text-[#2d6a4f]">Available</span></>
                              : <><ToggleLeft size={22} className="text-gray-400" /><span className="font-sans text-xs text-gray-400">Blocked</span></>
                            }
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {room.amenities.map((a: string) => <span key={a} className="bg-[#F7F5F2] px-2.5 py-1 font-sans text-xs">{a}</span>)}
                        </div>
                        <p className="font-sans text-xs text-gray-400">{room.max_guests} guests max · {room.bookings_this_month} bookings this month</p>
                      </div>
                      <div className="text-right ml-6">
                        <p className="font-display italic text-2xl text-[#2d6a4f]">{formatMoney(room.price_per_night)}</p>
                        <p className="font-sans text-xs text-gray-400">/night</p>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 px-5 py-2 flex items-center">
                      <button onClick={() => setExpandedRoom(expandedRoom === room.id ? null : room.id)} className="flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline">
                        {expandedRoom === room.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {expandedRoom === room.id ? 'Close editor' : 'Edit room'}
                      </button>
                    </div>
                    {expandedRoom === room.id && (
                      <div className="border-t border-gray-100 p-5 grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#F7F5F2]">
                        <div>
                          <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Room Name</label>
                          <input defaultValue={room.name} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white" />
                        </div>
                        <div>
                          <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Price / Night (R)</label>
                          <input type="number" defaultValue={room.price_per_night} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white" />
                        </div>
                        <div>
                          <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Max Guests</label>
                          <input type="number" defaultValue={room.max_guests} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white" />
                        </div>
                        <div className="md:col-span-3 flex gap-2">
                          <button className="bg-[#2d6a4f] text-white px-5 py-2 font-sans text-sm hover:bg-[#235a3f] transition-colors">Save Room</button>
                          <button onClick={() => setExpandedRoom(null)} className="border border-gray-300 text-gray-600 px-5 py-2 font-sans text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <button className="w-full border border-dashed border-gray-300 text-gray-400 hover:border-[#2d6a4f] hover:text-[#2d6a4f] py-4 font-sans text-sm transition-colors">
                  <Plus size={14} className="inline mr-2" /> Add Room
                </button>
              </div>
            )}

            {/* Bookings */}
            {tab === 'bookings' && (
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Room', 'Guest', 'Check-in', 'Check-out', 'Total', 'Status'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {propBookings.map(b => (
                      <tr key={b.id} className="hover:bg-[#F7F5F2] transition-colors">
                        <td className="px-4 py-3 font-sans text-sm">{b.room}</td>
                        <td className="px-4 py-3 font-sans text-sm font-medium">{b.guest}</td>
                        <td className="px-4 py-3 font-sans text-xs text-gray-500">{new Date(b.check_in).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</td>
                        <td className="px-4 py-3 font-sans text-xs text-gray-500">{new Date(b.check_out).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</td>
                        <td className="px-4 py-3 font-display italic text-lg text-[#2d6a4f]">{formatMoney(b.total)}</td>
                        <td className="px-4 py-3">
                          <span className={`font-sans text-xs px-2.5 py-1 ${STATUS_COLOR[b.status]}`}>{b.status.charAt(0).toUpperCase() + b.status.slice(1)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* Calendar */}
            {tab === 'calendar' && (
              <div className="bg-white border border-gray-200 p-6">
                <CalendarGrid bookings={propBookings} />
              </div>
            )}

            {/* Revenue */}
            {tab === 'revenue' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Revenue this month', value: `${formatMoney(revenue)}` },
                    { label: 'Avg nightly rate', value: `${formatMoney(Math.round(propRooms.reduce((s, r) => s + r.price_per_night, 0) / Math.max(propRooms.length, 1)))}` },
                    { label: 'Occupancy', value: `${occupancy}%` },
                    { label: 'Total bookings', value: propBookings.length.toString() },
                  ].map(stat => (
                    <div key={stat.label} className="bg-white border border-gray-200 p-5">
                      <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">{stat.label}</p>
                      <p className="font-display italic text-3xl text-[#2d6a4f]">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-gray-200 p-6">
                  <h3 className="font-display italic text-xl mb-5">Revenue by Room</h3>
                  <div className="space-y-4">
                    {propRooms.map(room => {
                      const roomRevenue = propBookings.filter(b => b.room === room.name).reduce((s: number, b: any) => s + b.total, 0)
                      const maxRev = Math.max(...propRooms.map(r => propBookings.filter(b => b.room === r.name).reduce((s: number, b: any) => s + b.total, 0)), 1)
                      const pct = Math.round((roomRevenue / maxRev) * 100)
                      return (
                        <div key={room.id}>
                          <div className="flex justify-between font-sans text-sm mb-1.5">
                            <span className="text-gray-700">{room.name}</span>
                            <span className="text-[#2d6a4f] font-medium">{formatMoney(roomRevenue)}</span>
                          </div>
                          <div className="bg-gray-100 h-2">
                            <div className="bg-[#2d6a4f] h-2 transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

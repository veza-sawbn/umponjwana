'use client'

import { useState } from 'react'
import { Search, TrendingUp, DollarSign, CheckCircle, Clock, XCircle } from 'lucide-react'

const BOOKINGS = [
  { id: 'BK-4421', visitor: 'Sarah van der Merwe', listing: 'Cathedral Peak Mountain Lodge', type: 'accommodation', checkIn: '2026-07-15', checkOut: '2026-07-18', guests: 2, total: 8214, status: 'confirmed', payment: 'paid', supplier: 'Mountain Retreats SA' },
  { id: 'BK-4420', visitor: 'James Fourie', listing: 'Tugela Falls Guided Hike', type: 'hike', checkIn: '2026-07-12', checkOut: '2026-07-12', guests: 2, total: 1160, status: 'confirmed', payment: 'paid', supplier: 'Berg Trail Co.' },
  { id: 'BK-4419', visitor: 'Priya Naidoo', listing: 'Tendele Tented Camp', type: 'accommodation', checkIn: '2026-08-01', checkOut: '2026-08-04', guests: 2, total: 9600, status: 'pending', payment: 'pending', supplier: 'Wilderness Stays' },
  { id: 'BK-4418', visitor: 'Lindiwe Dlamini', listing: "Giant's Castle Restcamp", type: 'accommodation', checkIn: '2026-07-20', checkOut: '2026-07-23', guests: 3, total: 2340, status: 'confirmed', payment: 'paid', supplier: 'Ezemvelo KZN' },
  { id: 'BK-4417', visitor: 'Mike Peterson', listing: 'Rock Climbing Experience', type: 'activity', checkIn: '2026-07-05', checkOut: '2026-07-05', guests: 1, total: 750, status: 'cancelled', payment: 'refunded', supplier: 'Drakensberg Adventures' },
  { id: 'BK-4416', visitor: 'Thandi Sithole', listing: 'San Rock Art Full-Day Tour', type: 'experience', checkIn: '2026-06-18', checkOut: '2026-06-18', guests: 2, total: 1240, status: 'completed', payment: 'paid', supplier: 'Berg Cultural Tours' },
  { id: 'BK-4415', visitor: 'Ruan Meyer', listing: 'Fairy Glen Waterfall Walk', type: 'hike', checkIn: '2026-06-15', checkOut: '2026-06-15', guests: 4, total: 1160, status: 'completed', payment: 'paid', supplier: 'Berg Trail Co.' },
  { id: 'BK-4414', visitor: 'Anele Khumalo', listing: 'Cathedral Peak Mountain Lodge', type: 'accommodation', checkIn: '2026-09-10', checkOut: '2026-09-14', guests: 2, total: 10940, status: 'pending', payment: 'pending', supplier: 'Mountain Retreats SA' },
]

const BOOKING_STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  pending: 'bg-[#C9A96E]/15 text-[#8B6914]',
  cancelled: 'bg-red-50 text-red-400',
  completed: 'bg-gray-100 text-gray-500',
}

const PAYMENT_STYLE: Record<string, string> = {
  paid: 'text-[#2d6a4f]',
  pending: 'text-[#C9A96E]',
  refunded: 'text-gray-400',
  failed: 'text-red-400',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminBookingsPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = BOOKINGS.filter(b => {
    const matchSearch = b.visitor.toLowerCase().includes(search.toLowerCase()) || b.listing.toLowerCase().includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || b.status === filter
    return matchSearch && matchFilter
  })

  const totalRevenue = BOOKINGS.filter(b => b.payment === 'paid').reduce((sum, b) => sum + b.total, 0)
  const confirmed = BOOKINGS.filter(b => b.status === 'confirmed').length
  const pending = BOOKINGS.filter(b => b.status === 'pending').length
  const cancelled = BOOKINGS.filter(b => b.status === 'cancelled').length

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
        <h1 className="font-display italic text-3xl text-[#000000]">Bookings</h1>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue (Paid)', value: `R ${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
          { label: 'Confirmed', value: confirmed, icon: CheckCircle, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
          { label: 'Pending', value: pending, icon: Clock, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
          { label: 'Cancelled', value: cancelled, icon: XCircle, color: 'text-red-400', bg: 'bg-red-50' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white border border-gray-200 p-4">
              <div className={`${s.bg} w-8 h-8 flex items-center justify-center mb-3`}>
                <Icon size={15} className={s.color} />
              </div>
              <p className="font-display italic text-2xl text-[#000000]">{s.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2 flex-1 min-w-[220px]">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by guest, listing or booking ID…"
            className="flex-1 font-sans text-sm focus:outline-none"
          />
        </div>
        <div className="flex gap-0 border border-gray-200 bg-white overflow-hidden">
          {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 font-sans text-xs capitalize transition-colors border-r border-gray-100 last:border-0 ${
                filter === f ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-100">
              {['Booking ID', 'Visitor', 'Listing', 'Dates', 'Guests', 'Total', 'Payment', 'Status'].map(h => (
                <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(b => (
              <tr key={b.id} className="hover:bg-[#F7F5F2] transition-colors">
                <td className="px-5 py-4 font-mono text-xs text-gray-400">{b.id}</td>
                <td className="px-5 py-4 font-sans text-sm font-medium">{b.visitor}</td>
                <td className="px-5 py-4">
                  <p className="font-sans text-sm text-gray-700">{b.listing}</p>
                  <p className="font-sans text-xs text-gray-400">{b.supplier}</p>
                </td>
                <td className="px-5 py-4 font-sans text-xs text-gray-500">
                  {fmt(b.checkIn)}{b.checkIn !== b.checkOut ? ` — ${fmt(b.checkOut)}` : ''}
                </td>
                <td className="px-5 py-4 font-sans text-sm text-gray-600">{b.guests}</td>
                <td className="px-5 py-4 font-display italic text-[#2d6a4f]">R {b.total.toLocaleString()}</td>
                <td className="px-5 py-4">
                  <span className={`font-sans text-xs capitalize ${PAYMENT_STYLE[b.payment]}`}>{b.payment}</span>
                </td>
                <td className="px-5 py-4">
                  <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${BOOKING_STATUS_STYLE[b.status]}`}>{b.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

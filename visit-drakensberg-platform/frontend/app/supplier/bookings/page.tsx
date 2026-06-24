'use client'
import { useState } from 'react'
import { CalendarDays, Search } from 'lucide-react'
import { useSupplier } from '@/lib/supplier-context'

type Status = 'all' | 'confirmed' | 'pending' | 'completed' | 'cancelled'

const MOCK = [
  { id: 'BK001', guest: 'Sarah van der Merwe', item: 'Cathedral Peak Mountain Lodge', checkIn: '2025-07-15', checkOut: '2025-07-18', guests: 2, total: 8214, status: 'confirmed' },
  { id: 'BK002', guest: 'James Fourie',         item: 'Berg Valley Guesthouse',        checkIn: '2025-06-22', checkOut: '2025-06-25', guests: 4, total: 12320, status: 'completed' },
  { id: 'BK003', guest: 'Priya Naidoo',         item: 'Cathedral Peak Mountain Lodge', checkIn: '2025-07-10', checkOut: '2025-07-12', guests: 2, total: 2940,  status: 'pending' },
  { id: 'BK004', guest: 'Lindiwe Dlamini',      item: 'Cathedral Peak Mountain Lodge', checkIn: '2025-08-01', checkOut: '2025-08-04', guests: 6, total: 18500, status: 'confirmed' },
]

const STATUS_CHIP: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  pending:   'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-600',
}

export default function BookingsPage() {
  const [filter, setFilter] = useState<Status>('all')
  const [search, setSearch] = useState('')
  const { loading } = useSupplier()

  const rows = MOCK.filter(b =>
    (filter === 'all' || b.status === filter) &&
    (b.guest.toLowerCase().includes(search.toLowerCase()) || b.item.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Bookings</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search guest or listing…"
            className="pl-8 pr-4 py-2 font-sans text-sm border border-black/10 rounded-lg bg-white outline-none focus:border-[#C9A96E]/50 w-64"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'confirmed', 'pending', 'completed', 'cancelled'] as Status[]).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`font-sans text-xs px-3 py-1.5 rounded-full capitalize transition-colors ${
                filter === s ? 'bg-[#C9A96E] text-white' : 'bg-white border border-black/10 text-black/60 hover:border-[#C9A96E]/40'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/6">
              {['ID', 'Guest', 'Listing', 'Check-in', 'Check-out', 'Guests', 'Total', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center font-sans text-sm text-black/30">No bookings found</td></tr>
            )}
            {rows.map((b, i) => (
              <tr key={b.id} className={i < rows.length - 1 ? 'border-b border-black/5' : ''}>
                <td className="px-4 py-3 font-sans text-xs text-black/40">{b.id}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/80">{b.guest}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60 max-w-[160px] truncate">{b.item}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{b.checkIn}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{b.checkOut}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{b.guests}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/80">R {b.total.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`font-sans text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_CHIP[b.status]}`}>{b.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

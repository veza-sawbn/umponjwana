'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, DollarSign, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react'
import { getAdminBookings, setAdminBookingStatus } from '@/lib/admin-supabase'
import type { SavedBooking } from '@/lib/bookings'

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
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function listingName(booking: SavedBooking) {
  return booking.stay?.title || booking.addons[0]?.title || booking.shuttle?.label || 'Custom itinerary'
}

function supplierName(booking: SavedBooking) {
  return booking.addons.find(addon => addon.operator)?.operator || 'Supplier pending'
}

function bookingType(booking: SavedBooking) {
  if (booking.stay) return 'accommodation'
  if (booking.shuttle) return 'shuttle'
  return booking.addons[0]?.type || 'itinerary'
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<SavedBooking[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadBookings() {
    setLoading(true)
    setError('')
    try {
      const data = await getAdminBookings()
      setBookings(data.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    } catch {
      setError('Could not load bookings from Supabase.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBookings() }, [])

  const filtered = useMemo(() => bookings.filter(b => {
    const haystack = `${b.reference} ${b.customerName} ${b.customerEmail} ${listingName(b)} ${supplierName(b)}`.toLowerCase()
    const matchSearch = haystack.includes(search.toLowerCase())
    const matchFilter = filter === 'all' || b.status === filter
    return matchSearch && matchFilter
  }), [bookings, filter, search])

  const totalRevenue = bookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + b.total, 0)
  const confirmed = bookings.filter(b => b.status === 'confirmed').length
  const pending = bookings.filter(b => (b.status as string) === 'pending').length
  const cancelled = bookings.filter(b => b.status === 'cancelled').length

  async function updateStatus(id: string, status: SavedBooking['status']) {
    await setAdminBookingStatus(id, status)
    await loadBookings()
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Bookings</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Confirmed checkout bookings stored in Supabase.</p>
        </div>
        <button onClick={loadBookings} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: `R ${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
          { label: 'Confirmed', value: confirmed, icon: CheckCircle, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
          { label: 'Pending', value: pending, icon: Clock, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
          { label: 'Cancelled', value: cancelled, icon: XCircle, color: 'text-red-400', bg: 'bg-red-50' },
        ].map(s => {
          const Icon = s.icon
          return <div key={s.label} className="bg-white border border-gray-200 p-4"><div className={`${s.bg} w-8 h-8 flex items-center justify-center mb-3`}><Icon size={15} className={s.color} /></div><p className="font-display italic text-2xl text-[#000000]">{s.value}</p><p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{s.label}</p></div>
        })}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2 flex-1 min-w-[220px]"><Search size={14} className="text-gray-400 shrink-0" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by guest, listing, supplier, email or booking ref…" className="flex-1 font-sans text-sm focus:outline-none" /></div>
        <div className="flex gap-0 border border-gray-200 bg-white overflow-hidden">{['all', 'pending', 'confirmed', 'cancelled'].map(f => <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 font-sans text-xs capitalize transition-colors border-r border-gray-100 last:border-0 ${filter === f ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>{f}</button>)}</div>
      </div>

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead><tr className="border-b border-gray-100">{['Booking Ref', 'Visitor', 'Listing', 'Dates', 'Guests', 'Total', 'Payment', 'Status', 'Actions'].map(h => <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(b => <tr key={b.id} className="hover:bg-[#F7F5F2] transition-colors"><td className="px-5 py-4 font-mono text-xs text-gray-400">{b.reference}</td><td className="px-5 py-4"><p className="font-sans text-sm font-medium">{b.customerName}</p><p className="font-sans text-xs text-gray-400">{b.customerEmail}</p></td><td className="px-5 py-4"><p className="font-sans text-sm text-gray-700">{listingName(b)}</p><p className="font-sans text-xs text-gray-400">{supplierName(b)} · {bookingType(b)}</p></td><td className="px-5 py-4 font-sans text-xs text-gray-500">{fmt(b.checkIn)}{b.checkIn !== b.checkOut ? ` — ${fmt(b.checkOut)}` : ''}</td><td className="px-5 py-4 font-sans text-sm text-gray-600">{b.guests}</td><td className="px-5 py-4 font-display italic text-[#2d6a4f]">R {b.total.toLocaleString()}</td><td className="px-5 py-4"><span className={`font-sans text-xs capitalize ${PAYMENT_STYLE.paid}`}>paid</span></td><td className="px-5 py-4"><span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${BOOKING_STATUS_STYLE[b.status] ?? BOOKING_STATUS_STYLE.pending}`}>{b.status}</span></td><td className="px-5 py-4"><div className="flex gap-2">{b.status !== 'confirmed' && <button onClick={() => updateStatus(b.id, 'confirmed')} className="font-sans text-xs text-[#2d6a4f] hover:underline">Confirm</button>}{b.status !== 'cancelled' && <button onClick={() => updateStatus(b.id, 'cancelled')} className="font-sans text-xs text-red-400 hover:underline">Cancel</button>}</div></td></tr>)}
            {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-5 py-12 text-center font-sans text-sm text-gray-400">No bookings found.</td></tr>}
            {loading && <tr><td colSpan={9} className="px-5 py-12 text-center font-sans text-sm text-gray-400">Loading bookings…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

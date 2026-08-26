'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { MapPin, Calendar, Users, CheckCircle, Clock, XCircle, Download, ChevronRight } from 'lucide-react'
import { getBookingsByUser, updateBookingStatus, type SavedBooking } from '@/lib/bookings'
import { getDepartures, releaseDepartureSeats } from '@/lib/departures'
import { releaseActivityTimeslot } from '@/lib/activities'
import { supabase } from '@/lib/auth'
import { formatMoney } from '@/lib/allocation'

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  pending: 'bg-[#C9A96E]/15 text-[#8B6914]',
  cancelled: 'bg-red-50 text-red-400',
  completed: 'bg-gray-100 text-gray-500',
}

const STATUS_ICON: Record<string, any> = {
  confirmed: CheckCircle, pending: Clock, cancelled: XCircle, completed: CheckCircle,
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function BookingCard({ b, onCancel }: { b: SavedBooking; onCancel?: (b: SavedBooking) => void }) {
  const status = b.status
  const Icon = STATUS_ICON[status] || CheckCircle
  const title = b.stay?.title || (b.addons[0]?.title ?? 'Booking')
  const location = b.stay?.region || b.region || ''

  return (
    <div className="bg-white border border-gray-200 flex gap-0 overflow-hidden">
      <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              {location && (
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-[#C9A96E] mb-1 flex items-center gap-1">
                  <MapPin size={10} />{location}
                </p>
              )}
              <h3 className="font-display italic text-xl text-[#000000]">{title}</h3>
              <p className="font-sans text-xs text-gray-400 mt-0.5">Ref: {b.reference}</p>
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 font-sans text-[10px] tracking-[0.1em] uppercase shrink-0 ${STATUS_STYLE[status] || STATUS_STYLE.confirmed}`}>
              <Icon size={9} /> {status}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 font-sans text-xs text-gray-500 mt-3">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {b.stay ? `${fmt(b.checkIn)} — ${fmt(b.checkOut)} (${b.nights} night${b.nights !== 1 ? 's' : ''})` : fmt(b.checkIn)}
            </span>
            <span className="flex items-center gap-1"><Users size={11} />{b.guests} guest{b.guests !== 1 ? 's' : ''}</span>
          </div>
          {b.addons.length > 0 && (
            <p className="font-sans text-xs text-gray-400 mt-2">
              {b.addons.length} experience{b.addons.length !== 1 ? 's' : ''}: {b.addons.map(a => a.title).join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <p className="font-display italic text-2xl text-[#2d6a4f]">{formatMoney(b.total)}</p>
          <div className="flex gap-2">
            {onCancel && status === 'confirmed' && (
              <button
                onClick={() => onCancel(b)}
                className="inline-flex items-center gap-1 border border-red-200 text-red-500 px-3 py-1.5 font-sans text-xs hover:bg-red-50 transition-colors"
              >
                <XCircle size={12} /> Cancel
              </button>
            )}
            <Link
              href={`/checkout/success?id=${b.id}`}
              className="inline-flex items-center gap-1 border border-gray-200 text-gray-500 px-3 py-1.5 font-sans text-xs hover:bg-[#F7F5F2] transition-colors"
            >
              <Download size={12} /> Confirmation
            </Link>
            <Link href={`/account/itinerary?id=${b.id}`} className="inline-flex items-center gap-1 text-[#2d6a4f] font-sans text-xs hover:underline">
              Itinerary <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AccountBookingsPage() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [bookings, setBookings] = useState<SavedBooking[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setLoading(false); return }
      getBookingsByUser(data.user.id).then(bs => { setBookings(bs); setLoading(false) })
    })
  }, [])

  const upcoming = bookings.filter(b => b.status !== 'cancelled' && (b.checkOut >= today || (!b.stay && b.addons.some(a => (a.date || '') >= today))))
  const past = bookings.filter(b => b.status === 'cancelled' || (!upcoming.includes(b)))

  async function cancelBooking(b: SavedBooking) {
    if (!window.confirm(`Cancel booking ${b.reference}? Free cancellation applies until 48 hours before check-in.`)) return
    try {
      await updateBookingStatus(b.id, 'cancelled', { notifySuppliers: true })
      // Release any tour departure seats and activity timeslots held by this booking.
      const deps = await getDepartures()
      await Promise.all([
        ...b.addons
          .filter(a => deps.some(d => d.id === a.id))
          .map(a => releaseDepartureSeats(a.id, a.guests).catch(() => {})),
        ...b.addons
          .filter(a => a.activityId && a.timeslotId && a.date)
          .map(a => releaseActivityTimeslot(a.activityId!, a.date!, a.timeslotId!, a.guests).catch(() => {})),
      ])
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'cancelled' } : x))
      toast.success('Booking cancelled. The suppliers have been notified.')
    } catch {
      toast.error('Could not cancel this booking. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display italic text-3xl text-[#000000]">My Bookings</h1>
        <p className="font-sans text-sm text-gray-400 mt-1">{upcoming.length} upcoming · {past.length} past</p>
      </div>

      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {(['upcoming', 'past'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 font-sans text-sm capitalize border-b-2 transition-colors ${tab === t ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
          >
            {t === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
          </button>
        ))}
      </div>

      {tab === 'upcoming' && (
        <div className="space-y-4">
          {upcoming.length === 0 ? (
            <div className="bg-white border border-gray-200 p-12 text-center">
              <p className="font-display italic text-2xl text-gray-300 mb-2">No upcoming trips</p>
              <p className="font-sans text-sm text-gray-400 mb-5">Time to plan your next Drakensberg adventure.</p>
              <Link href="/stays" className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">Browse Stays</Link>
            </div>
          ) : upcoming.map(b => <BookingCard key={b.id} b={b} onCancel={cancelBooking} />)}
        </div>
      )}

      {tab === 'past' && (
        <div className="space-y-4">
          {past.length === 0 ? (
            <p className="font-sans text-sm text-gray-400">No past bookings yet.</p>
          ) : past.map(b => <BookingCard key={b.id} b={b} />)}
        </div>
      )}
    </div>
  )
}

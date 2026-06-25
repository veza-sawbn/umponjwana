'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Calendar, Clock, Download, ArrowRight, Mountain, Bus } from 'lucide-react'
import { getBookingById, type SavedBooking } from '@/lib/bookings'

function fmtLong(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function fmt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ItineraryInner() {
  const params = useSearchParams()
  const id = params.get('id')
  const [booking, setBooking] = useState<SavedBooking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    getBookingById(id).then(b => { setBooking(b); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="py-20 text-center">
        <p className="font-sans text-sm text-gray-400 mb-4">Booking not found.</p>
        <Link href="/account" className="font-sans text-sm text-[#2d6a4f] hover:underline">Back to My Bookings</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display italic text-3xl text-[#000000]">Your Itinerary</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">Ref: {booking.reference}</p>
        </div>
        <Link
          href={`/checkout/success?id=${booking.id}`}
          className="flex items-center gap-2 border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
        >
          <Download size={13} />
          Download PDF
        </Link>
      </div>

      {/* Accommodation */}
      {booking.stay && (
        <div className="bg-[#000000] text-white p-6 mb-8">
          <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] block mb-3">Accommodation</span>
          <h2 className="font-display italic text-3xl mb-1">{booking.stay.title}</h2>
          <p className="font-sans text-xs text-white/40 flex items-center gap-1 mb-6">
            <MapPin size={10} />{booking.stay.region}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Check-in', value: fmtLong(booking.checkIn) },
              { label: 'Check-out', value: fmtLong(booking.checkOut) },
              { label: 'Duration', value: `${booking.nights} night${booking.nights !== 1 ? 's' : ''}`, sub: `${booking.guests} guest${booking.guests !== 1 ? 's' : ''}` },
            ].map(item => (
              <div key={item.label} className="border border-white/10 p-3">
                <p className="font-sans text-[10px] uppercase tracking-wider text-white/40 mb-1">{item.label}</p>
                <p className="font-sans text-sm text-white font-medium">{item.value}</p>
                {item.sub && <p className="font-sans text-xs text-white/40">{item.sub}</p>}
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="font-sans text-xs text-white/40">Contact the property directly with any special requests regarding your stay.</p>
            {booking.specialRequests && (
              <p className="font-sans text-xs text-white/60 mt-2 italic">Your note: {booking.specialRequests}</p>
            )}
          </div>
        </div>
      )}

      {/* Experiences / Hikes */}
      {booking.addons.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display italic text-2xl text-[#000000] mb-5">Activities &amp; Experiences</h2>
          <div className="space-y-3">
            {booking.addons.map(a => (
              <div key={a.id} className="bg-white border border-gray-200 p-5 flex gap-4">
                <div className="w-10 h-10 bg-[#2d6a4f]/10 flex items-center justify-center shrink-0">
                  <Mountain size={16} className="text-[#2d6a4f]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display italic text-lg text-[#000000]">{a.title}</h4>
                  <div className="flex flex-wrap gap-4 font-sans text-xs text-gray-500 mt-1">
                    {a.date && (
                      <span className="flex items-center gap-1"><Calendar size={10} />{fmtLong(a.date)}</span>
                    )}
                    <span className="flex items-center gap-1"><Clock size={10} />{a.guests} {a.guests === 1 ? 'person' : 'people'}</span>
                  </div>
                </div>
                <p className="font-display italic text-lg text-[#2d6a4f] shrink-0">R {(a.price_per_person * a.guests).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shuttle */}
      {booking.shuttle && (
        <div className="bg-white border border-gray-200 p-5 mb-8 flex items-start gap-4">
          <Bus size={18} className="text-[#C9A96E] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-1">Shuttle</p>
            <p className="font-display italic text-lg">{booking.shuttle.label}</p>
            <p className="font-sans text-xs text-gray-500 mt-0.5">{booking.shuttle.description}</p>
          </div>
          <p className="font-display italic text-lg text-[#2d6a4f] shrink-0">R {booking.shuttle.price.toLocaleString()}</p>
        </div>
      )}

      {/* No stay / no addons fallback */}
      {!booking.stay && booking.addons.length === 0 && (
        <div className="bg-white border border-gray-200 p-8 text-center mb-8">
          <p className="font-sans text-sm text-gray-400">No itinerary details found for this booking.</p>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/account" className="group bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors p-4 flex items-center justify-between">
          <span className="font-sans text-sm text-gray-700">All Bookings</span>
          <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
        </Link>
        <Link href="/hikes" className="group bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors p-4 flex items-center justify-between">
          <span className="font-sans text-sm text-gray-700">Explore More Hikes</span>
          <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
        </Link>
        <Link href="/account/saved" className="group bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors p-4 flex items-center justify-between">
          <span className="font-sans text-sm text-gray-700">Saved Listings</span>
          <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
        </Link>
      </div>
    </div>
  )
}

export default function ItineraryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ItineraryInner />
    </Suspense>
  )
}

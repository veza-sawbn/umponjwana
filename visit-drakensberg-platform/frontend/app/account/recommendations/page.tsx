'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, Clock, Mountain, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { useBooking } from '@/lib/booking-context'
import { getBookingsByUser, type SavedBooking } from '@/lib/bookings'
import { getRecommendations, type Recommendation } from '@/lib/recommendations'

const KIND_LABEL: Record<Recommendation['kind'], string> = {
  activity: 'Activity',
  'tour-departure': 'Guided tour',
  stay: 'Stay',
}

export default function RecommendationsPage() {
  const booking = useBooking()
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [pastBookings, setPastBookings] = useState<SavedBooking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const history = user ? await getBookingsByUser(user.id) : []
      setPastBookings(history.slice(0, 4))

      const bookedIds = history.flatMap(b => [
        ...(b.stay ? [b.stay.id] : []),
        ...b.addons.map(a => a.id),
      ])
      const historyRegions = [...new Set(history.map(b => b.stay?.region || b.region).filter(Boolean))] as string[]

      const results = await getRecommendations({
        region: booking.stay?.region || booking.region || historyRegions[0],
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guests: booking.guests,
        historyRegions,
        excludeIds: [
          ...bookedIds,
          ...booking.addons.map(a => a.id),
          ...(booking.stay ? [booking.stay.id] : []),
        ],
      }, 6)
      setRecs(results)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display italic text-3xl text-[#000000]">Continue Planning Your Trip</h1>
        <p className="font-sans text-sm text-gray-400 mt-1">
          Matched to your travel dates, region and booking history
        </p>
      </div>

      {/* From your bookings */}
      {pastBookings.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Clock size={16} className="text-[#C9A96E]" />
            <h2 className="font-display italic text-xl text-[#000000]">Your Recent Trips</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {pastBookings.map(b => (
              <Link key={b.id} href={`/account/itinerary?id=${b.id}`} className="group bg-white border border-gray-200 p-4 hover:border-[#2d6a4f] transition-colors">
                <span className="font-sans text-[9px] tracking-[0.12em] uppercase text-[#C9A96E]">{b.reference}</span>
                <p className="font-display italic text-base leading-tight mt-0.5 truncate">
                  {b.stay?.title || b.addons[0]?.title || 'Trip'}
                </p>
                <p className="font-sans text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <CalendarDays size={10} />
                  {b.checkIn ? new Date(b.checkIn).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : '—'}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Context-aware recommendations */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <Mountain size={16} className="text-[#C9A96E]" />
          <h2 className="font-display italic text-xl text-[#000000]">Recommended for You</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recs.length === 0 ? (
          <div className="bg-white border border-gray-200 p-10 text-center">
            <p className="font-display italic text-xl text-gray-300 mb-2">Nothing to recommend yet</p>
            <p className="font-sans text-sm text-gray-400 mb-5">
              Set travel dates or make a booking and we&apos;ll match live experiences to your trip.
            </p>
            <Link href="/search" className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">
              Explore the Berg
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recs.map(item => (
              <Link key={item.id} href={item.href} className="group bg-white border border-gray-200 overflow-hidden flex hover:border-[#2d6a4f] transition-colors">
                <div className="w-28 h-28 shrink-0 overflow-hidden bg-[#2d6a4f]/10">
                  {item.image ? (
                    <img src={item.image} alt={item.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Mountain size={20} className="text-[#2d6a4f]/40" />
                    </div>
                  )}
                </div>
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-sans text-[9px] tracking-[0.12em] uppercase text-[#C9A96E]">{KIND_LABEL[item.kind]}</span>
                    {item.price != null && (
                      <span className="font-sans text-xs text-gray-400">R {item.price.toLocaleString()} pp</span>
                    )}
                  </div>
                  <p className="font-display italic text-lg leading-tight truncate">{item.title}</p>
                  <p className="font-sans text-xs text-gray-400 flex items-center gap-1 mt-1"><MapPin size={10} />{item.region}</p>
                  <p className="font-sans text-xs text-gray-400 mt-2 italic">{item.reason}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

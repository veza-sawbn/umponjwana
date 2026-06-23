'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Calendar, Users, CheckCircle, Clock, XCircle, Download, ChevronRight } from 'lucide-react'

const UPCOMING = [
  {
    id: 'b1', title: 'Cathedral Peak Mountain Lodge', location: 'Cathedral Peak, Northern Berg',
    room: 'Mountain View Suite', checkIn: '2026-07-15', checkOut: '2026-07-18', guests: 2,
    total: 8214, status: 'confirmed', image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80',
  },
  {
    id: 'b2', title: 'Tugela Falls Guided Hike', location: 'Royal Natal National Park',
    room: null, checkIn: '2026-08-03', checkOut: '2026-08-03', guests: 2,
    total: 1160, status: 'confirmed', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80',
  },
]

const PAST = [
  {
    id: 'b3', title: 'Berg Valley Guesthouse', location: 'Champagne Valley',
    room: 'Garden Suite', checkIn: '2026-04-10', checkOut: '2026-04-13', guests: 3,
    total: 5880, status: 'completed', image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80',
  },
  {
    id: 'b4', title: 'San Rock Art Full-Day Tour', location: "Giant's Castle",
    room: null, checkIn: '2026-02-18', checkOut: '2026-02-18', guests: 2,
    total: 1240, status: 'completed', image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80',
  },
]

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

function nights(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

function BookingCard({ b }: { b: typeof UPCOMING[0] }) {
  const Icon = STATUS_ICON[b.status]
  const n = nights(b.checkIn, b.checkOut)
  return (
    <div className="bg-white border border-gray-200 flex gap-0 overflow-hidden">
      <div className="w-40 shrink-0 overflow-hidden hidden sm:block">
        <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-[#C9A96E] mb-1 flex items-center gap-1"><MapPin size={10} />{b.location}</p>
              <h3 className="font-display italic text-xl text-[#000000]">{b.title}</h3>
              {b.room && <p className="font-sans text-xs text-gray-400 mt-0.5">{b.room}</p>}
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 font-sans text-[10px] tracking-[0.1em] uppercase shrink-0 ${STATUS_STYLE[b.status]}`}>
              <Icon size={9} /> {b.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 font-sans text-xs text-gray-500 mt-3">
            <span className="flex items-center gap-1"><Calendar size={11} />{fmt(b.checkIn)}{n > 0 ? ` — ${fmt(b.checkOut)} (${n} night${n !== 1 ? 's' : ''})` : ''}</span>
            <span className="flex items-center gap-1"><Users size={11} />{b.guests} guest{b.guests !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <p className="font-display italic text-2xl text-[#2d6a4f]">R {b.total.toLocaleString()}</p>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1 border border-gray-200 text-gray-500 px-3 py-1.5 font-sans text-xs hover:bg-[#F7F5F2] transition-colors">
              <Download size={12} /> Confirmation
            </button>
            <Link href={`/stays/${b.id}`} className="inline-flex items-center gap-1 text-[#2d6a4f] font-sans text-xs hover:underline">
              View listing <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AccountBookingsPage() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display italic text-3xl text-[#000000]">My Bookings</h1>
        <p className="font-sans text-sm text-gray-400 mt-1">{UPCOMING.length} upcoming · {PAST.length} completed</p>
      </div>

      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {(['upcoming', 'past'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 font-sans text-sm capitalize border-b-2 transition-colors ${tab === t ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
          >
            {t === 'upcoming' ? `Upcoming (${UPCOMING.length})` : `Past (${PAST.length})`}
          </button>
        ))}
      </div>

      {tab === 'upcoming' && (
        <div className="space-y-4">
          {UPCOMING.length === 0 ? (
            <div className="bg-white border border-gray-200 p-12 text-center">
              <p className="font-display italic text-2xl text-gray-300 mb-2">No upcoming trips</p>
              <p className="font-sans text-sm text-gray-400 mb-5">Time to plan your next Drakensberg adventure.</p>
              <Link href="/stays" className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">Browse Stays</Link>
            </div>
          ) : UPCOMING.map(b => <BookingCard key={b.id} b={b} />)}
        </div>
      )}

      {tab === 'past' && (
        <div className="space-y-4">
          {PAST.map(b => <BookingCard key={b.id} b={b} />)}
        </div>
      )}
    </div>
  )
}

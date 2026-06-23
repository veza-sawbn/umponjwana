'use client'

import { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { CalendarDays, MapPin, Ticket, Star, Filter } from 'lucide-react'

interface PublicEvent {
  id: string
  title: string
  description: string
  event_type: 'event' | 'special'
  location: string
  starts_at: string
  ends_at?: string
  ticket_price: number
  total_tickets: number
  tickets_sold: number
  image_bg: string
}

const EVENTS: PublicEvent[] = [
  {
    id: '1',
    title: 'Drakensberg Star Gazing Night',
    description: 'A guided star gazing session at 1800m altitude with a certified astronomer. Hot drinks and light snacks included.',
    event_type: 'event',
    location: 'Cathedral Peak',
    starts_at: '2026-07-20T19:00',
    ends_at: '2026-07-20T22:00',
    ticket_price: 350,
    total_tickets: 30,
    tickets_sold: 12,
    image_bg: 'bg-[#0a0a1a]',
  },
  {
    id: '2',
    title: 'Winter Wildflower Walk Special',
    description: '20% off guided wildflower identification walks. Learn to identify over 200 Drakensberg endemic species.',
    event_type: 'special',
    location: "Monk's Cowl",
    starts_at: '2026-07-01T08:00',
    ends_at: '2026-07-31T17:00',
    ticket_price: 180,
    total_tickets: 100,
    tickets_sold: 45,
    image_bg: 'bg-[#2d6a4f]',
  },
  {
    id: '3',
    title: 'San Rock Art Full-Day Tour',
    description: 'Explore ancient San rock paintings with an accredited heritage guide. Includes light lunch and transport.',
    event_type: 'event',
    location: 'Giant\'s Castle',
    starts_at: '2026-08-05T07:00',
    ends_at: '2026-08-05T16:00',
    ticket_price: 620,
    total_tickets: 16,
    tickets_sold: 9,
    image_bg: 'bg-[#8B4513]',
  },
  {
    id: '4',
    title: 'Berg & Braai Sunset Special',
    description: 'Traditional South African braai at sunset with panoramic Berg views. Live music by local artists.',
    event_type: 'special',
    location: 'Champagne Valley',
    starts_at: '2026-07-25T17:30',
    ends_at: '2026-07-25T21:00',
    ticket_price: 450,
    total_tickets: 50,
    tickets_sold: 22,
    image_bg: 'bg-[#C9A96E]',
  },
  {
    id: '5',
    title: 'Photography & Landscape Workshop',
    description: 'Two-day photography workshop with professional landscape photographer. All skill levels welcome.',
    event_type: 'event',
    location: 'Drakensberg Gardens',
    starts_at: '2026-08-15T06:00',
    ends_at: '2026-08-16T18:00',
    ticket_price: 1850,
    total_tickets: 10,
    tickets_sold: 6,
    image_bg: 'bg-[#1a1a2e]',
  },
  {
    id: '6',
    title: 'Kids Berg Explorer Camp',
    description: 'A fun-filled two-night camp for children aged 8–14. Hiking, survival skills, nature journaling and more.',
    event_type: 'event',
    location: 'Royal Natal',
    starts_at: '2026-07-12T08:00',
    ends_at: '2026-07-14T15:00',
    ticket_price: 2200,
    total_tickets: 24,
    tickets_sold: 18,
    image_bg: 'bg-[#4A7251]',
  },
]

type Filter = 'all' | 'event' | 'special'

export default function EventsPage() {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = filter === 'all' ? EVENTS : EVENTS.filter(e => e.event_type === filter)

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#2d6a4f] text-white py-20 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-4">What's On</p>
          <h1 className="font-display italic text-5xl lg:text-6xl mb-4">Events & Specials</h1>
          <p className="font-sans text-lg text-white/70 max-w-2xl">
            Guided experiences, cultural evenings, seasonal specials and more — all set against the dramatic backdrop of the Drakensberg.
          </p>
        </div>
      </section>

      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-4 flex items-center gap-3">
          <Filter size={14} className="text-gray-400" />
          {([['all', 'All'], ['event', 'Events'], ['special', 'Specials']] as [Filter, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-4 py-1.5 font-sans text-sm transition-colors ${filter === val ? 'bg-[#2d6a4f] text-white' : 'border border-gray-300 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f]'}`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto font-sans text-sm text-gray-400">{filtered.length} listing{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(event => {
            const remaining = event.total_tickets > 0 ? event.total_tickets - event.tickets_sold : null
            const almostFull = remaining !== null && remaining <= 5
            const soldOut = remaining !== null && remaining === 0
            return (
              <div key={event.id} className="bg-white border border-gray-200 group cursor-pointer">
                <div className={`relative aspect-[4/3] ${event.image_bg} flex items-end p-6 overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="relative z-10 flex items-center justify-between w-full">
                    <span className={`font-sans text-[10px] tracking-[0.14em] uppercase px-3 py-1.5 ${event.event_type === 'special' ? 'bg-[#C9A96E] text-[#2d2d2d]' : 'bg-white/20 backdrop-blur-sm text-white'}`}>
                      {event.event_type === 'special' ? <><Star size={9} className="inline mr-1" />Special</> : 'Event'}
                    </span>
                    {soldOut && <span className="font-sans text-xs bg-red-600 text-white px-2.5 py-1">Sold Out</span>}
                    {almostFull && !soldOut && <span className="font-sans text-xs bg-[#C9A96E] text-[#2d2d2d] px-2.5 py-1">Only {remaining} left</span>}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-display italic text-xl text-[#000000] mb-2 group-hover:text-[#2d6a4f] transition-colors">{event.title}</h3>
                  <p className="font-sans text-sm text-gray-600 mb-4 line-clamp-2">{event.description}</p>

                  <div className="space-y-1.5 mb-5">
                    <p className="font-sans text-xs text-gray-500 flex items-center gap-1.5">
                      <MapPin size={12} /> {event.location}
                    </p>
                    <p className="font-sans text-xs text-gray-500 flex items-center gap-1.5">
                      <CalendarDays size={12} />
                      {new Date(event.starts_at).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {remaining !== null && (
                      <p className="font-sans text-xs text-gray-500 flex items-center gap-1.5">
                        <Ticket size={12} /> {remaining} tickets remaining
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div>
                      <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">From</p>
                      <p className="font-display italic text-2xl text-[#2d6a4f]">R {event.ticket_price}</p>
                    </div>
                    <button
                      disabled={soldOut}
                      className={`px-5 py-2.5 font-sans text-sm font-medium transition-colors ${soldOut ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'}`}
                    >
                      {soldOut ? 'Sold Out' : 'Book Tickets'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <Footer />
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Footer from '@/components/layout/Footer'
import { CalendarDays, MapPin, Ticket, Star, Filter, Check, Loader2 } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import { getSupplierEntities } from '@/lib/supplier-entities'
import { formatMoney } from '@/lib/allocation'

interface PublicEvent {
  id: string
  supplierId: string
  title: string
  description: string
  event_type: 'event' | 'special'
  location: string
  starts_at: string
  ends_at?: string
  ticket_price: number
  total_tickets: number
  tickets_sold: number
  is_published: boolean
}

const ENTITY = 'events'

// No image field exists on the real supplier event record — a colour is
// derived from the event type instead of a fake photo.
const TYPE_BG: Record<PublicEvent['event_type'], string> = {
  event: 'bg-[#1a1a2e]',
  special: 'bg-[#2d6a4f]',
}

type Filter = 'all' | 'event' | 'special'

export default function EventsPage() {
  const booking = useBooking()
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    getSupplierEntities<any>(ENTITY)
      .then((all: PublicEvent[]) => {
        const now = new Date().toISOString()
        setEvents(
          all
            // RLS already hides drafts from the public, but a supplier
            // browsing this page while signed in would otherwise see their
            // own unpublished events too — filter defensively.
            .filter(e => e.is_published && (e.ends_at || e.starts_at) >= now)
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
        )
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? events : events.filter(e => e.event_type === filter)

  function toggleAddon(event: PublicEvent) {
    const addonId = `event-${event.id}`
    if (booking.addons.some(a => a.id === addonId)) {
      booking.removeAddon(addonId)
    } else {
      booking.addAddon({
        id: addonId,
        type: 'event',
        title: event.title,
        supplierId: event.supplierId,
        date: event.starts_at.slice(0, 10),
        price_per_person: event.ticket_price,
        guests: 1,
        location: event.location || undefined,
      })
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

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
        {loading ? (
          <div className="py-24 flex justify-center"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-sans text-sm text-gray-400">No upcoming events or specials right now — check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(event => {
              const remaining = event.total_tickets > 0 ? event.total_tickets - event.tickets_sold : null
              const almostFull = remaining !== null && remaining <= 5
              const soldOut = remaining !== null && remaining <= 0
              const isAdded = booking.addons.some(a => a.id === `event-${event.id}`)
              return (
                <div key={event.id} className="bg-white border border-gray-200 group">
                  <div className={`relative aspect-[4/3] ${TYPE_BG[event.event_type]} flex items-end p-6 overflow-hidden`}>
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
                    {event.description && <p className="font-sans text-sm text-gray-600 mb-4 line-clamp-2">{event.description}</p>}

                    <div className="space-y-1.5 mb-5">
                      {event.location && (
                        <p className="font-sans text-xs text-gray-500 flex items-center gap-1.5">
                          <MapPin size={12} /> {event.location}
                        </p>
                      )}
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
                        <p className="font-display italic text-2xl text-[#2d6a4f]">{formatMoney(event.ticket_price)}</p>
                      </div>
                      <button
                        onClick={() => toggleAddon(event)}
                        disabled={soldOut}
                        className={`px-5 py-2.5 font-sans text-sm font-medium transition-colors flex items-center gap-1.5 ${
                          soldOut ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : isAdded ? 'bg-[#2d6a4f]/10 text-[#2d6a4f] border border-[#2d6a4f]'
                          : 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'
                        }`}
                      >
                        {soldOut ? 'Sold Out' : isAdded ? <><Check size={14} /> Added</> : 'Book Tickets'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

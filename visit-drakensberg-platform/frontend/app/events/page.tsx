'use client'

import { useEffect, useState } from 'react'
import Footer from '@/components/layout/Footer'
import { CalendarDays, MapPin, Ticket, Star, Filter, Check, Loader2, Minus, Plus } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import { getSupplierEntities } from '@/lib/supplier-entities'
import { formatMoney } from '@/lib/allocation'
import {
  type Event, type EventSession, type EventTicketType,
  ticketsRemaining, sessionRemaining, eventFromPrice,
} from '@/lib/events'

const ENTITY = 'events'

// No image field exists on the real supplier event record — a colour is
// derived from the event type instead of a fake photo.
const TYPE_BG: Record<Event['event_type'], string> = {
  event: 'bg-[#1a1a2e]',
  special: 'bg-[#2d6a4f]',
}

type Filter = 'all' | 'event' | 'special'

function upcomingSessions(event: Event): EventSession[] {
  const now = new Date().toISOString()
  return (event.sessions ?? [])
    .filter(s => s.status === 'active' && (s.ends_at || s.starts_at) >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
}

export default function EventsPage() {
  const booking = useBooking()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    getSupplierEntities<Event>(ENTITY)
      .then((all: Event[]) => {
        setEvents(
          all
            // RLS already hides drafts from the public, but a supplier
            // browsing this page while signed in would otherwise see their
            // own unpublished events too — filter defensively. An event with
            // no upcoming session left to sell isn't worth showing either.
            .filter(e => e.is_published && upcomingSessions(e).length > 0)
            .sort((a, b) => (upcomingSessions(a)[0]?.starts_at ?? '').localeCompare(upcomingSessions(b)[0]?.starts_at ?? '')),
        )
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? events : events.filter(e => e.event_type === filter)

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      <section className="bg-[#2d6a4f] text-white py-20 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-4">What's On</p>
          <h1 className="font-display italic text-5xl lg:text-6xl mb-4">Events & Specials</h1>
          <p className="font-sans text-lg text-white/70 max-w-2xl">
            Guided experiences, cultural evenings, seasonal specials and more, all set against the dramatic backdrop of the Drakensberg.
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
            <p className="font-sans text-sm text-gray-400">No upcoming events or specials right now. Please check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(event => <EventCard key={event.id} event={event} />)}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

function EventCard({ event }: { event: Event }) {
  const booking = useBooking()
  const sessions = upcomingSessions(event)
  const tiers: EventTicketType[] = event.ticketTypes?.length
    ? event.ticketTypes
    : [{ id: 'tier-general', name: 'General', price: event.ticket_price }]

  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? '')
  const [tierId, setTierId] = useState(tiers[0]?.id ?? '')
  const [qty, setQty] = useState(1)

  const remaining = sessionId && tierId ? ticketsRemaining(event, sessionId, tierId) : 0
  const soldOut = sessions.every(s => sessionRemaining(event, s.id) <= 0)
  const addonId = `event-${event.id}-${sessionId}-${tierId}`
  const isAdded = booking.addons.some(a => a.id === addonId)
  const selectedTier = tiers.find(t => t.id === tierId)
  const fromPrice = eventFromPrice(event)

  function toggleAddon() {
    if (isAdded) {
      booking.removeAddon(addonId)
      return
    }
    if (!sessionId || !tierId || !selectedTier) return
    booking.addAddon({
      id: addonId,
      type: 'event',
      title: `${event.title}${selectedTier.name !== 'General' ? ` · ${selectedTier.name}` : ''}`,
      supplierId: event.supplierId,
      date: sessionId ? sessions.find(s => s.id === sessionId)?.starts_at?.slice(0, 10) : undefined,
      price_per_person: selectedTier.price,
      guests: Math.min(qty, Math.max(remaining, 1)),
      location: event.location || undefined,
      eventId: event.id,
      sessionId,
      ticketTypeId: tierId,
    })
  }

  return (
    <div className="bg-white border border-gray-200 group flex flex-col">
      <div className={`relative aspect-[4/3] ${TYPE_BG[event.event_type]} flex items-end p-6 overflow-hidden`}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 flex items-center justify-between w-full">
          <span className={`font-sans text-[10px] tracking-[0.14em] uppercase px-3 py-1.5 ${event.event_type === 'special' ? 'bg-[#C9A96E] text-[#2d2d2d]' : 'bg-white/20 backdrop-blur-sm text-white'}`}>
            {event.event_type === 'special' ? <><Star size={9} className="inline mr-1" />Special</> : 'Event'}
          </span>
          {soldOut && <span className="font-sans text-xs bg-red-600 text-white px-2.5 py-1">Sold Out</span>}
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <h3 className="font-display italic text-xl text-[#000000] mb-2 group-hover:text-[#2d6a4f] transition-colors">{event.title}</h3>
        {event.description && <p className="font-sans text-sm text-gray-600 mb-4 line-clamp-2">{event.description}</p>}

        <div className="space-y-1.5 mb-5">
          {event.location && (
            <p className="font-sans text-xs text-gray-500 flex items-center gap-1.5">
              <MapPin size={12} /> {event.location}
            </p>
          )}
        </div>

        {sessions.length > 0 && (
          <div className="mb-3">
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Date</label>
            <select
              value={sessionId}
              onChange={e => setSessionId(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 font-sans text-sm bg-white focus:outline-none focus:border-[#2d6a4f]"
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {new Date(s.starts_at).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {' · '}{sessionRemaining(event, s.id)} left
                </option>
              ))}
            </select>
          </div>
        )}

        {tiers.length > 1 && (
          <div className="mb-3">
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Ticket type</label>
            <select
              value={tierId}
              onChange={e => setTierId(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 font-sans text-sm bg-white focus:outline-none focus:border-[#2d6a4f]"
            >
              {tiers.map(t => (
                <option key={t.id} value={t.id}>{t.name} — {formatMoney(t.price)}</option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-5 flex items-center justify-between">
          <span className="font-sans text-xs text-gray-500 flex items-center gap-1.5">
            <Ticket size={12} /> {remaining > 0 ? `${remaining} tickets remaining` : 'Sold out for this date'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-7 h-7 flex items-center justify-center border border-gray-300 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f]"
            >
              <Minus size={12} />
            </button>
            <span className="font-sans text-sm w-5 text-center">{qty}</span>
            <button
              type="button"
              onClick={() => setQty(q => Math.min(Math.max(remaining, 1), q + 1))}
              className="w-7 h-7 flex items-center justify-center border border-gray-300 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f]"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
          <div>
            <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">From</p>
            <p className="font-display italic text-2xl text-[#2d6a4f]">{formatMoney(fromPrice)}</p>
          </div>
          <button
            onClick={toggleAddon}
            disabled={remaining <= 0 && !isAdded}
            className={`px-5 py-2.5 font-sans text-sm font-medium transition-colors flex items-center gap-1.5 ${
              remaining <= 0 && !isAdded ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : isAdded ? 'bg-[#2d6a4f]/10 text-[#2d6a4f] border border-[#2d6a4f]'
              : 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'
            }`}
          >
            {remaining <= 0 && !isAdded ? 'Sold Out' : isAdded ? <><Check size={14} /> Added</> : 'Book Tickets'}
          </button>
        </div>
      </div>
    </div>
  )
}

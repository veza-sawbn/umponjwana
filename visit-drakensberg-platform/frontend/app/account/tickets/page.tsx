'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Ticket as TicketIcon, MapPin, CalendarDays, CheckCircle2, XCircle } from 'lucide-react'
import { getMyTickets, type Ticket } from '@/lib/tickets'
import { getEventById, type Event } from '@/lib/events'

type Group = {
  event: Event | null
  sessionId: string
  tickets: Ticket[]
}

export default function MyTicketsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getMyTickets()
      .then(async tickets => {
        const eventIds = Array.from(new Set(tickets.map(t => t.eventId)))
        const events = await Promise.all(eventIds.map(id => getEventById(id)))
        const eventById = new Map(events.filter((e): e is Event => !!e).map(e => [e.id, e]))

        const byGroup = new Map<string, Group>()
        for (const t of tickets) {
          const key = `${t.eventId}:${t.sessionId}`
          const g = byGroup.get(key) ?? { event: eventById.get(t.eventId) ?? null, sessionId: t.sessionId, tickets: [] }
          g.tickets.push(t)
          byGroup.set(key, g)
        }
        if (!cancelled) setGroups(Array.from(byGroup.values()))
      })
      .catch(() => { if (!cancelled) setGroups([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display italic text-3xl text-[#000000]">My Tickets</h1>
        <p className="font-sans text-sm text-gray-400 mt-1">
          {loading ? 'Loading your tickets…' : `${groups.reduce((n, g) => n + g.tickets.length, 0)} ticket${groups.reduce((n, g) => n + g.tickets.length, 0) !== 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map(i => <div key={i} className="bg-white border border-gray-200 h-56 animate-pulse" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <TicketIcon size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-2xl text-gray-300 mb-2">No tickets yet</p>
          <p className="font-sans text-sm text-gray-400">
            Tickets you buy for events and specials appear here once payment is confirmed.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(g => <EventGroup key={`${g.event?.id}:${g.sessionId}`} group={g} />)}
        </div>
      )}
    </div>
  )
}

function EventGroup({ group }: { group: Group }) {
  const { event, sessionId, tickets } = group
  const session = event?.sessions?.find(s => s.id === sessionId)

  return (
    <div>
      <div className="mb-3">
        <h2 className="font-display italic text-xl text-[#000000]">{event?.title ?? 'Event'}</h2>
        <div className="flex flex-wrap gap-4 mt-1 font-sans text-xs text-gray-500">
          {session?.starts_at && (
            <span className="flex items-center gap-1.5">
              <CalendarDays size={12} />
              {new Date(session.starts_at).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {event?.location && <span className="flex items-center gap-1.5"><MapPin size={12} />{event.location}</span>}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tickets.map(t => <TicketCard key={t.id} ticket={t} tierName={event?.ticketTypes?.find(ty => ty.id === t.ticketTypeId)?.name} />)}
      </div>
    </div>
  )
}

function TicketCard({ ticket, tierName }: { ticket: Ticket; tierName?: string }) {
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(`${ticket.id}:${ticket.token}`, { margin: 1, width: 220 })
      .then(url => { if (!cancelled) setQr(url) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [ticket.id, ticket.token])

  const statusBadge = ticket.status === 'redeemed'
    ? { label: `Checked in${ticket.redeemedAt ? ` at ${new Date(ticket.redeemedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}` : ''}`, cls: 'text-[#2d6a4f]', Icon: CheckCircle2 }
    : ticket.status === 'void'
    ? { label: 'Cancelled', cls: 'text-red-500', Icon: XCircle }
    : { label: 'Valid — not yet used', cls: 'text-gray-500', Icon: TicketIcon }

  return (
    <div className={`bg-white border border-gray-200 p-5 flex items-center gap-5 ${ticket.status === 'void' ? 'opacity-60' : ''}`}>
      <div className="w-24 h-24 shrink-0 bg-[#F7F5F2] flex items-center justify-center">
        {qr ? <img src={qr} alt={`QR code for ticket ${ticket.code}`} className="w-full h-full" /> : <TicketIcon size={20} className="text-gray-300" />}
      </div>
      <div className="min-w-0">
        <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">{tierName || 'General'}</p>
        <p className="font-display italic text-lg text-[#000000] mb-2">{ticket.code}</p>
        <p className={`font-sans text-xs flex items-center gap-1.5 ${statusBadge.cls}`}>
          <statusBadge.Icon size={13} /> {statusBadge.label}
        </p>
      </div>
    </div>
  )
}

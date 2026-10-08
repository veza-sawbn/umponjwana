'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { Ticket as TicketIcon, MapPin, CalendarDays, CheckCircle2, XCircle, Bus, Clock, X } from 'lucide-react'
import { getMyTickets, type Ticket } from '@/lib/tickets'
import { getEventById, type Event } from '@/lib/events'
import { getActivityById, type Activity } from '@/lib/activities'
import { todayISO } from '@/lib/upcoming'

// One heading per thing the guest is going to: an event session, or one
// departure of a day tour. Tickets inside are one per seat.
type Group =
  | { kind: 'event'; key: string; event: Event | null; sessionId: string; tickets: Ticket[] }
  | { kind: 'tour'; key: string; activity: Activity | null; ticket: Ticket; tickets: Ticket[] }

function groupTickets(tickets: Ticket[], events: Map<string, Event>, activities: Map<string, Activity>): Group[] {
  const byKey = new Map<string, Group>()
  for (const t of tickets) {
    if (t.activityId) {
      // Pickup is part of the key: two pickups on one booking board at two stops.
      const key = `tour:${t.activityId}:${t.slotDate}:${t.timeslotId}:${t.pickupPointId ?? ''}`
      const g = byKey.get(key) ?? { kind: 'tour', key, activity: activities.get(t.activityId) ?? null, ticket: t, tickets: [] }
      g.tickets.push(t)
      byKey.set(key, g)
    } else if (t.eventId && t.sessionId) {
      const key = `event:${t.eventId}:${t.sessionId}`
      const g = byKey.get(key) ?? { kind: 'event', key, event: events.get(t.eventId) ?? null, sessionId: t.sessionId, tickets: [] }
      g.tickets.push(t)
      byKey.set(key, g)
    }
  }
  // Soonest first; past days sink to the bottom.
  const when = (g: Group) => g.kind === 'tour'
    ? `${g.ticket.slotDate}T${g.ticket.departureTime ?? '00:00'}`
    : g.event?.sessions?.find(s => s.id === g.sessionId)?.starts_at ?? ''
  const today = todayISO()
  return Array.from(byKey.values()).sort((a, b) => {
    const wa = when(a), wb = when(b)
    const pa = wa.slice(0, 10) < today, pb = wb.slice(0, 10) < today
    if (pa !== pb) return pa ? 1 : -1
    return pa ? wb.localeCompare(wa) : wa.localeCompare(wb)
  })
}

export default function MyTicketsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [enlarged, setEnlarged] = useState<{ ticket: Ticket; title: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    getMyTickets()
      .then(async tickets => {
        const eventIds = Array.from(new Set(tickets.map(t => t.eventId).filter((id): id is string => !!id)))
        const activityIds = Array.from(new Set(tickets.map(t => t.activityId).filter((id): id is string => !!id)))
        const [events, activities] = await Promise.all([
          Promise.all(eventIds.map(id => getEventById(id).catch(() => null))),
          Promise.all(activityIds.map(id => getActivityById(id).catch(() => null))),
        ])
        const eventById = new Map(events.filter((e): e is Event => !!e).map(e => [e.id, e]))
        const activityById = new Map(activities.filter((a): a is Activity => !!a).map(a => [a.id, a]))
        if (!cancelled) {
          setCount(tickets.length)
          setGroups(groupTickets(tickets, eventById, activityById))
        }
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
          {loading ? 'Loading your tickets…' : `${count} ticket${count !== 1 ? 's' : ''} · show the QR code to your operator before boarding`}
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
            Seats on Grand Tour day tours, and tickets for events, appear here once payment is confirmed.
          </p>
          <Link href="/grand-tour" className="inline-block mt-5 font-sans text-sm text-[#2d6a4f] underline underline-offset-4">
            Explore the Grand Tour Drakensberg
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map(g => g.kind === 'tour'
            ? <TourGroup key={g.key} group={g} onEnlarge={setEnlarged} />
            : <EventGroup key={g.key} group={g} onEnlarge={setEnlarged} />)}
        </div>
      )}

      {enlarged && <EnlargedQr ticket={enlarged.ticket} title={enlarged.title} onClose={() => setEnlarged(null)} />}
    </div>
  )
}

type Enlarge = (v: { ticket: Ticket; title: string }) => void

function TourGroup({ group, onEnlarge }: { group: Extract<Group, { kind: 'tour' }>; onEnlarge: Enlarge }) {
  const { activity, ticket, tickets } = group
  const title = activity?.name ?? 'Day tour'
  const date = ticket.slotDate
    ? new Date(`${ticket.slotDate}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''
  return (
    <div>
      <p className="font-sans text-[10px] tracking-[0.18em] uppercase text-[#C9A96E] mb-1">Grand Tour Drakensberg · Boarding pass</p>
      <h2 className="font-display italic text-2xl text-[#000000]">{title}</h2>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2 font-sans text-xs text-gray-600">
        {date && <span className="flex items-center gap-1.5"><CalendarDays size={12} />{date}</span>}
        {ticket.departureTime && <span className="flex items-center gap-1.5"><Clock size={12} />Departs {ticket.departureTime}</span>}
        {activity?.supplierName && <span className="flex items-center gap-1.5"><TicketIcon size={12} />{activity.supplierName}</span>}
      </div>
      {ticket.pickupLabel ? (
        <div className="mt-3 bg-[#2d6a4f]/5 border-l-2 border-[#2d6a4f] px-4 py-3 font-sans text-sm text-[#000000] flex items-start gap-2.5">
          <Bus size={16} className="text-[#2d6a4f] mt-0.5 shrink-0" />
          <span>
            Pickup at <strong>{ticket.pickupLabel}</strong>
            {ticket.pickupTime ? <> at <strong>{ticket.pickupTime}</strong></> : null}.
            {' '}Please be at reception a few minutes early.
          </span>
        </div>
      ) : activity?.meetingPoint ? (
        <p className="mt-3 font-sans text-sm text-gray-600 flex items-center gap-1.5"><MapPin size={13} />Meet at {activity.meetingPoint}</p>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {tickets.map((t, i) => (
          <TicketCard
            key={t.id}
            ticket={t}
            label={`Seat ${i + 1} of ${tickets.length}${t.holderName ? ` · ${t.holderName}` : ''}`}
            onEnlarge={() => onEnlarge({ ticket: t, title })}
          />
        ))}
      </div>
    </div>
  )
}

function EventGroup({ group, onEnlarge }: { group: Extract<Group, { kind: 'event' }>; onEnlarge: Enlarge }) {
  const { event, sessionId, tickets } = group
  const session = event?.sessions?.find(s => s.id === sessionId)
  const title = event?.title ?? 'Event'

  return (
    <div>
      <div className="mb-3">
        <h2 className="font-display italic text-xl text-[#000000]">{title}</h2>
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
        {tickets.map(t => (
          <TicketCard
            key={t.id}
            ticket={t}
            label={event?.ticketTypes?.find(ty => ty.id === t.ticketTypeId)?.name || 'General'}
            onEnlarge={() => onEnlarge({ ticket: t, title })}
          />
        ))}
      </div>
    </div>
  )
}

function useQr(ticket: Ticket, width: number): string | null {
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(`${ticket.id}:${ticket.token}`, { margin: 1, width })
      .then(url => { if (!cancelled) setQr(url) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [ticket.id, ticket.token, width])
  return qr
}

function TicketCard({ ticket, label, onEnlarge }: { ticket: Ticket; label: string; onEnlarge: () => void }) {
  const qr = useQr(ticket, 260)
  const usable = ticket.status === 'issued'

  const statusBadge = ticket.status === 'redeemed'
    ? { label: `Checked in${ticket.redeemedAt ? ` at ${new Date(ticket.redeemedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}` : ''}`, cls: 'text-[#2d6a4f]', Icon: CheckCircle2 }
    : ticket.status === 'void'
    ? { label: 'Cancelled', cls: 'text-red-500', Icon: XCircle }
    : { label: 'Valid — not yet used', cls: 'text-gray-500', Icon: TicketIcon }

  return (
    <div className={`bg-white border border-gray-200 p-5 flex items-center gap-5 ${ticket.status === 'void' ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={usable ? onEnlarge : undefined}
        disabled={!usable}
        aria-label={usable ? `Show QR code for ticket ${ticket.code} full screen` : undefined}
        className="w-28 h-28 shrink-0 bg-[#F7F5F2] flex items-center justify-center disabled:cursor-default"
      >
        {qr ? <img src={qr} alt={`QR code for ticket ${ticket.code}`} className="w-full h-full" /> : <TicketIcon size={20} className="text-gray-300" />}
      </button>
      <div className="min-w-0">
        <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1 truncate">{label}</p>
        <p className="font-display italic text-lg text-[#000000] mb-2">{ticket.code}</p>
        <p className={`font-sans text-xs flex items-center gap-1.5 ${statusBadge.cls}`}>
          <statusBadge.Icon size={13} /> {statusBadge.label}
        </p>
        {usable && <p className="font-sans text-[11px] text-gray-400 mt-2">Tap the code to enlarge for scanning</p>}
      </div>
    </div>
  )
}

function EnlargedQr({ ticket, title, onClose }: { ticket: Ticket; title: string; onClose: () => void }) {
  const qr = useQr(ticket, 640)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={`Ticket ${ticket.code}`} className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6" onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Close" className="absolute top-5 right-5 p-2 text-gray-500 hover:text-black"><X size={24} /></button>
      <p className="font-sans text-[10px] tracking-[0.18em] uppercase text-gray-400 mb-2 text-center">{title}</p>
      {qr && <img src={qr} alt={`QR code for ticket ${ticket.code}`} className="w-full max-w-[min(80vw,420px)] aspect-square" />}
      <p className="font-display italic text-3xl mt-4">{ticket.code}</p>
      {ticket.pickupLabel && (
        <p className="font-sans text-sm text-gray-600 mt-2 text-center">
          Pickup: {ticket.pickupLabel}{ticket.pickupTime ? ` · ${ticket.pickupTime}` : ''}
        </p>
      )}
    </div>
  )
}

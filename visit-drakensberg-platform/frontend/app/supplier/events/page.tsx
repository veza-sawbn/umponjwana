'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Plus, Trash2, CalendarDays, Ticket, MapPin, Star, Users, ChevronDown } from 'lucide-react'
import { getRegionNames } from '@/lib/regions'
import { GoogleAddressField } from '@/components/maps/GoogleAddressField'
import {
  type Event, type EventSession, type EventTicketType, type EventCapacityMap,
  getEventsBySupplier, updateEvent, deleteEvent, addEventSession, setEventCapacity,
  sessionRemaining,
} from '@/lib/events'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { formatMoney } from '@/lib/allocation'
import { addSupplierEntity } from '@/lib/supplier-entities'

const ENTITY = 'events'

type SessionDraft = { starts_at: string; ends_at: string }
type TierDraft = { name: string; price: string; capacity: string }

function newId(prefix: string) {
  return `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`
}

export default function EventsManagePage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [regions, setRegions] = useState<string[]>([])
  const [supplierId, setSupplierId] = useState<string>('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const sid = effectiveSupplierId(user.id)
        setSupplierId(sid)
        setEvents(await getEventsBySupplier(sid))
      }
      setLoading(false)
    })
    getRegionNames().then(setRegions)
  }, [])

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_type: 'event' as 'event' | 'special',
    location: '',
    region: '',
    gpsLat: '',
    gpsLng: '',
  })
  const [sessions, setSessions] = useState<SessionDraft[]>([{ starts_at: '', ends_at: '' }])
  const [tiers, setTiers] = useState<TierDraft[]>([{ name: 'General', price: '', capacity: '' }])

  function resetForm() {
    setForm({ title: '', description: '', event_type: 'event', location: '', region: '', gpsLat: '', gpsLng: '' })
    setSessions([{ starts_at: '', ends_at: '' }])
    setTiers([{ name: 'General', price: '', capacity: '' }])
  }

  async function handleCreate() {
    const validSessions = sessions.filter(s => s.starts_at)
    const validTiers = tiers.filter(t => t.name && t.price !== '')
    if (!form.title || validSessions.length === 0 || validTiers.length === 0) {
      toast.error('Add a title, at least one date and one ticket type.')
      return
    }
    try {
      const sessionRows: EventSession[] = validSessions.map(s => ({
        id: newId('sess'), starts_at: s.starts_at, ends_at: s.ends_at || s.starts_at, status: 'active',
      }))
      const tierRows: EventTicketType[] = validTiers.map(t => ({
        id: newId('tier'), name: t.name, price: parseFloat(t.price) || 0,
      }))
      const capacity: EventCapacityMap = {}
      for (const s of sessionRows) {
        capacity[s.id] = {}
        for (let i = 0; i < tierRows.length; i++) {
          capacity[s.id][tierRows[i].id] = { total: Math.max(0, parseInt(validTiers[i].capacity) || 0), sold: 0 }
        }
      }
      const saved = await addSupplierEntity<Event>(ENTITY, {
        supplierId,
        title: form.title,
        description: form.description,
        event_type: form.event_type,
        location: form.location,
        region: form.region,
        gpsLat: form.gpsLat,
        gpsLng: form.gpsLng,
        starts_at: sessionRows[0].starts_at,
        ends_at: sessionRows[0].ends_at,
        // Legacy flat fields kept in sync with the first session/cheapest
        // tier so anything still reading them (list sort) shows something
        // sane — capacity itself lives only in `capacity` above.
        ticket_price: Math.min(...tierRows.map(t => t.price)),
        total_tickets: Object.values(capacity[sessionRows[0].id]).reduce((s, c) => s + c.total, 0),
        tickets_sold: 0,
        sessions: sessionRows,
        ticketTypes: tierRows,
        capacity,
        is_published: true,
        status: 'active',
      } as unknown as Omit<Event, 'id' | 'createdAt'>)
      setEvents(prev => [...prev, saved])
      resetForm()
      setShowForm(false)
      toast.success('Event created.')
    } catch {
      toast.error('Could not create the event. Please try again.')
    }
  }

  async function handleDelete(id: string) {
    const prev = events
    setEvents(es => es.filter(e => e.id !== id))
    try {
      await deleteEvent(id)
    } catch {
      setEvents(prev)
      toast.error('Could not delete the event.')
    }
  }

  async function togglePublish(event: Event) {
    const is_published = !event.is_published
    try {
      await updateEvent(event.id, { is_published, status: is_published ? 'active' : 'draft' })
      setEvents(prev => prev.map(e => e.id === event.id ? { ...e, is_published, status: is_published ? 'active' : 'draft' } : e))
    } catch {
      toast.error('Could not update the event.')
    }
  }

  function refreshEvent(updated: Event) {
    setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#2d6a4f] text-white py-16 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/supplier" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h1 className="font-display italic text-4xl lg:text-5xl">Events & Specials</h1>
          <p className="mt-3 text-white/70 font-sans text-lg">
            List upcoming events with multiple dates and ticket types. Visitors purchase tickets directly through the platform.
          </p>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="flex items-center justify-between mb-8">
          <p className="font-sans text-gray-600">{events.length} listing{events.length !== 1 ? 's' : ''}</p>
          <button
            onClick={() => setShowForm(v => !v)}
            className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm font-medium hover:bg-[#235a3f] transition-colors"
          >
            <Plus size={16} /> Add Event / Special
          </button>
        </div>

        {showForm && (
          <div className="bg-white border border-gray-200 p-8 mb-8">
            <h2 className="font-display italic text-2xl text-[#2d6a4f] mb-6">New Event or Special</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Type</label>
                <div className="flex gap-4">
                  {(['event', 'special'] as const).map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="event_type"
                        value={type}
                        checked={form.event_type === type}
                        onChange={() => setForm(f => ({ ...f, event_type: type }))}
                        className="accent-[#2d6a4f]"
                      />
                      <span className="font-sans text-sm capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="Event name"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Region</label>
                <select
                  value={form.region}
                  onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white"
                >
                  <option value="">Select region…</option>
                  {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <GoogleAddressField
                  label="Venue / Location"
                  value={form.location}
                  lat={form.gpsLat}
                  lng={form.gpsLng}
                  placeholder="Start typing the venue or trail name"
                  inputClassName="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  labelClassName="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2"
                  onChange={({ address, lat, lng }) => setForm(f => ({ ...f, location: address, gpsLat: lat || f.gpsLat, gpsLng: lng || f.gpsLng }))}
                />
              </div>

              <div className="md:col-span-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3 mt-4">
                  <label className="font-sans text-xs tracking-[0.12em] uppercase text-gray-500">Dates *</label>
                  <button
                    type="button"
                    onClick={() => setSessions(s => [...s, { starts_at: '', ends_at: '' }])}
                    className="font-sans text-xs text-[#2d6a4f] hover:underline"
                  >
                    + Add another date
                  </button>
                </div>
                <div className="space-y-3">
                  {sessions.map((s, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <input
                        type="datetime-local"
                        value={s.starts_at}
                        onChange={e => setSessions(arr => arr.map((row, j) => j === i ? { ...row, starts_at: e.target.value } : row))}
                        className="flex-1 border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                      />
                      <span className="font-sans text-xs text-gray-400">to</span>
                      <input
                        type="datetime-local"
                        value={s.ends_at}
                        onChange={e => setSessions(arr => arr.map((row, j) => j === i ? { ...row, ends_at: e.target.value } : row))}
                        className="flex-1 border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                      />
                      {sessions.length > 1 && (
                        <button type="button" onClick={() => setSessions(arr => arr.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3 mt-4">
                  <label className="font-sans text-xs tracking-[0.12em] uppercase text-gray-500">Ticket types *</label>
                  <button
                    type="button"
                    onClick={() => setTiers(t => [...t, { name: '', price: '', capacity: '' }])}
                    className="font-sans text-xs text-[#2d6a4f] hover:underline"
                  >
                    + Add ticket type
                  </button>
                </div>
                <div className="space-y-3">
                  {tiers.map((t, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <input
                        value={t.name}
                        onChange={e => setTiers(arr => arr.map((row, j) => j === i ? { ...row, name: e.target.value } : row))}
                        placeholder="Ticket name (e.g. General)"
                        className="flex-1 border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                      />
                      <input
                        type="number"
                        value={t.price}
                        onChange={e => setTiers(arr => arr.map((row, j) => j === i ? { ...row, price: e.target.value } : row))}
                        placeholder="Price (R)"
                        className="w-28 border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                      />
                      <input
                        type="number"
                        value={t.capacity}
                        onChange={e => setTiers(arr => arr.map((row, j) => j === i ? { ...row, capacity: e.target.value } : row))}
                        placeholder="Capacity per date"
                        className="w-40 border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                      />
                      {tiers.length > 1 && (
                        <button type="button" onClick={() => setTiers(arr => arr.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="font-sans text-xs text-gray-400 mt-2">
                  Each ticket type applies to every date above at the same capacity — you can adjust an individual date's capacity afterwards.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleCreate} className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm font-medium hover:bg-[#235a3f] transition-colors">
                Publish Listing
              </button>
              <button onClick={() => { setShowForm(false); resetForm() }} className="border border-gray-300 text-gray-700 px-6 py-2.5 font-sans text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {events.map(event => (
            <EventRow
              key={event.id}
              event={event}
              onDelete={() => handleDelete(event.id)}
              onTogglePublish={() => togglePublish(event)}
              onChanged={refreshEvent}
            />
          ))}
        </div>

        {events.length === 0 && !loading && (
          <div className="text-center py-20 bg-white border border-gray-200">
            <CalendarDays size={40} className="text-gray-300 mx-auto mb-4" />
            <p className="font-display italic text-2xl text-gray-400 mb-2">No events listed</p>
            <p className="font-sans text-gray-500 text-sm">Add an event or seasonal special to sell tickets to visitors.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

function EventRow({ event, onDelete, onTogglePublish, onChanged }: {
  event: Event
  onDelete: () => void
  onTogglePublish: () => void
  onChanged: (e: Event) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [newDate, setNewDate] = useState('')

  const totalRemaining = (event.sessions ?? []).reduce((sum, s) => sum + sessionRemaining(event, s.id), 0)
  const totalCapacity = Object.values(event.capacity ?? {}).reduce(
    (sum, tiers) => sum + Object.values(tiers).reduce((s, c) => s + c.total, 0), 0,
  )
  const totalSold = totalCapacity - totalRemaining

  async function handleAddDate() {
    if (!newDate) return
    try {
      const session = await addEventSession(event, { starts_at: newDate, ends_at: newDate, status: 'active' })
      // New date starts with zero capacity for every existing tier until the
      // supplier sets it below — matches "capacity is explicit, never assumed".
      onChanged({ ...event, sessions: [...(event.sessions ?? []), session] })
      setNewDate('')
      toast.success('Date added.')
    } catch {
      toast.error('Could not add this date.')
    }
  }

  async function handleCapacityChange(sessionId: string, tierId: string, total: number) {
    try {
      await setEventCapacity(event, sessionId, tierId, total)
      const capacity = { ...(event.capacity ?? {}) }
      const forSession = { ...(capacity[sessionId] ?? {}) }
      forSession[tierId] = { total, sold: forSession[tierId]?.sold ?? 0 }
      capacity[sessionId] = forSession
      onChanged({ ...event, capacity })
    } catch {
      toast.error('Could not update capacity.')
    }
  }

  return (
    <div className="bg-white border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`font-sans text-[10px] tracking-[0.14em] uppercase px-2.5 py-1 ${event.event_type === 'special' ? 'bg-[#C9A96E]/20 text-[#9a7840]' : 'bg-[#2d6a4f]/10 text-[#2d6a4f]'}`}>
              {event.event_type === 'special' ? <><Star size={10} className="inline mr-1" />Special</> : <><CalendarDays size={10} className="inline mr-1" />Event</>}
            </span>
            {!event.is_published && (
              <span className="font-sans text-[10px] tracking-[0.12em] uppercase px-2 py-1 bg-gray-100 text-gray-500">Draft</span>
            )}
          </div>
          <h3 className="font-display italic text-xl text-[#000000] mb-1">{event.title}</h3>
          <p className="font-sans text-sm text-gray-600 mb-3">{event.description}</p>
          <div className="flex flex-wrap gap-4 text-sm font-sans text-gray-500">
            {event.location && (
              <span className="flex items-center gap-1.5"><MapPin size={14} />{event.location}</span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} />
              {(event.sessions ?? []).length} date{(event.sessions ?? []).length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display italic text-2xl text-[#2d6a4f]">
            {formatMoney(Math.min(...(event.ticketTypes?.length ? event.ticketTypes.map(t => t.price) : [event.ticket_price])))}
          </p>
          <p className="font-sans text-xs text-gray-400 mb-3">from</p>
          <div className="flex items-center gap-1.5 justify-end text-xs font-sans text-gray-500">
            <Ticket size={12} />
            <span>{totalSold}/{totalCapacity} sold</span>
          </div>
          {totalCapacity > 0 && (
            <div className="mt-1 w-24 ml-auto bg-gray-100 h-1.5">
              <div className="bg-[#2d6a4f] h-1.5" style={{ width: `${Math.round((totalSold / totalCapacity) * 100)}%` }} />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={onTogglePublish}
          className="border border-[#2d6a4f] text-[#2d6a4f] px-4 py-1.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
        >
          {event.is_published ? 'Unpublish' : 'Publish'}
        </button>
        <Link
          href={`/supplier/events/${event.id}/guests`}
          className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-600 px-4 py-1.5 font-sans text-sm hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
        >
          <Users size={14} /> Guests
        </Link>
        <button
          onClick={() => setExpanded(v => !v)}
          className="inline-flex items-center gap-1.5 text-gray-500 font-sans text-sm hover:text-[#2d6a4f] transition-colors"
        >
          <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} /> Dates & capacity
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-700 font-sans text-sm transition-colors ml-auto"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="text-left text-[10px] tracking-[0.1em] uppercase text-gray-400">
                <th className="pb-2 font-normal">Date</th>
                {(event.ticketTypes ?? []).map(t => <th key={t.id} className="pb-2 font-normal">{t.name} capacity</th>)}
              </tr>
            </thead>
            <tbody>
              {(event.sessions ?? []).map(s => (
                <tr key={s.id} className="border-t border-gray-50">
                  <td className="py-2 text-gray-700">
                    {new Date(s.starts_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  {(event.ticketTypes ?? []).map(t => {
                    const cap = event.capacity?.[s.id]?.[t.id]
                    return (
                      <td key={t.id} className="py-2 pr-4">
                        <input
                          type="number"
                          defaultValue={cap?.total ?? 0}
                          onBlur={e => {
                            const val = Math.max(0, parseInt(e.target.value) || 0)
                            if (val !== (cap?.total ?? 0)) handleCapacityChange(s.id, t.id, val)
                          }}
                          className="w-20 border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:border-[#2d6a4f]"
                        />
                        <span className="text-gray-400 text-xs ml-1">({cap?.sold ?? 0} sold)</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-3 mt-4">
            <input
              type="datetime-local"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="border border-gray-300 px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
            />
            <button onClick={handleAddDate} className="font-sans text-xs text-[#2d6a4f] hover:underline">+ Add another date</button>
          </div>
        </div>
      )}
    </div>
  )
}

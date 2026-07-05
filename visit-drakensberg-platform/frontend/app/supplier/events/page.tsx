'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Plus, Trash2, CalendarDays, Ticket, MapPin, Star } from 'lucide-react'

interface SupplierEvent {
  id: string
  title: string
  description: string
  event_type: 'event' | 'special'
  location: string
  starts_at: string
  ends_at: string
  ticket_price: number
  total_tickets: number
  tickets_sold: number
  is_published: boolean
}

import { supabase } from '@/lib/auth'
import {
  getSupplierEntities, addSupplierEntity, updateSupplierEntity, deleteSupplierEntity,
} from '@/lib/supplier-entities'

const ENTITY = 'events'

export default function EventsManagePage() {
  const [events, setEvents] = useState<SupplierEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) setEvents(await getSupplierEntities<any>(ENTITY, user.id) as unknown as SupplierEvent[])
      setLoading(false)
    })
  }, [])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_type: 'event' as 'event' | 'special',
    location: '',
    starts_at: '',
    ends_at: '',
    ticket_price: '',
    total_tickets: '',
  })

  async function handleCreate() {
    if (!form.title || !form.ticket_price || !form.starts_at) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('no session')
      const saved = await addSupplierEntity<any>(ENTITY, {
        supplierId: user.id,
        title: form.title,
        description: form.description,
        event_type: form.event_type,
        location: form.location,
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        ticket_price: parseFloat(form.ticket_price),
        total_tickets: parseInt(form.total_tickets) || 0,
        tickets_sold: 0,
        is_published: true,
        status: 'active',
      })
      setEvents(prev => [...prev, saved as unknown as SupplierEvent])
      setForm({ title: '', description: '', event_type: 'event', location: '', starts_at: '', ends_at: '', ticket_price: '', total_tickets: '' })
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
      await deleteSupplierEntity(ENTITY, id)
    } catch {
      setEvents(prev)
      toast.error('Could not delete the event.')
    }
  }

  async function togglePublish(id: string) {
    const ev = events.find(e => e.id === id)
    if (!ev) return
    const is_published = !ev.is_published
    try {
      await updateSupplierEntity(ENTITY, id, { is_published, status: is_published ? 'active' : 'draft' })
      setEvents(prev => prev.map(e => e.id === id ? { ...e, is_published } : e))
    } catch {
      toast.error('Could not update the event.')
    }
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
            List upcoming events and seasonal specials. Visitors purchase tickets directly through the platform.
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
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Location</label>
                <input
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="Venue / trail name"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Ticket Price (R) *</label>
                <input
                  type="number"
                  value={form.ticket_price}
                  onChange={e => setForm(f => ({ ...f, ticket_price: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="350"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Start Date & Time *</label>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Total Tickets Available</label>
                <input
                  type="number"
                  value={form.total_tickets}
                  onChange={e => setForm(f => ({ ...f, total_tickets: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="50"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleCreate} className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm font-medium hover:bg-[#235a3f] transition-colors">
                Publish Listing
              </button>
              <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-6 py-2.5 font-sans text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {events.map(event => {
            const remaining = event.total_tickets - event.tickets_sold
            const soldPct = event.total_tickets > 0 ? Math.round((event.tickets_sold / event.total_tickets) * 100) : 0
            return (
              <div key={event.id} className="bg-white border border-gray-200 p-6">
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
                        {new Date(event.starts_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display italic text-2xl text-[#2d6a4f]">R {event.ticket_price}</p>
                    <p className="font-sans text-xs text-gray-400 mb-3">per ticket</p>
                    <div className="flex items-center gap-1.5 justify-end text-xs font-sans text-gray-500">
                      <Ticket size={12} />
                      <span>{event.tickets_sold}/{event.total_tickets} sold</span>
                    </div>
                    {event.total_tickets > 0 && (
                      <div className="mt-1 w-24 ml-auto bg-gray-100 h-1.5">
                        <div className="bg-[#2d6a4f] h-1.5" style={{ width: `${soldPct}%` }} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => togglePublish(event.id)}
                    className="border border-[#2d6a4f] text-[#2d6a4f] px-4 py-1.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
                  >
                    {event.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-700 font-sans text-sm transition-colors ml-auto"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {events.length === 0 && (
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

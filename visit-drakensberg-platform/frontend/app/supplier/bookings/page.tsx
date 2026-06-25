'use client'

import { useState, useEffect } from 'react'
import { CalendarDays, Search, Phone, Mail, Users, MessageSquare } from 'lucide-react'
import { getBookings, type SavedBooking } from '@/lib/bookings'
import { getPropertiesBySupplier } from '@/lib/properties'
import { supabase } from '@/lib/auth'

type Status = 'all' | 'confirmed' | 'cancelled'

const STATUS_CHIP: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
}

function fmt(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BookingsPage() {
  const [filter, setFilter] = useState<Status>('all')
  const [search, setSearch] = useState('')
  const [bookings, setBookings] = useState<SavedBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const [allBookings, myProperties] = await Promise.all([
        getBookings(),
        getPropertiesBySupplier(user.id),
      ])
      const myPropertyIds = new Set(myProperties.map(p => p.id))
      const relevant = allBookings.filter(b =>
        b.addons.some(a => a.supplierId === user.id) ||
        (b.stay && myPropertyIds.has(b.stay.id))
      )
      setBookings(relevant.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      setLoading(false)
    })
  }, [])

  const filtered = bookings.filter(b =>
    (filter === 'all' || b.status === filter) &&
    (
      b.customerName.toLowerCase().includes(search.toLowerCase()) ||
      b.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      b.reference.toLowerCase().includes(search.toLowerCase()) ||
      b.addons.some(a => a.title.toLowerCase().includes(search.toLowerCase())) ||
      (b.stay?.title || '').toLowerCase().includes(search.toLowerCase())
    )
  )

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Bookings</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search guest, ref, or experience…"
            className="pl-8 pr-4 py-2 font-sans text-sm border border-black/10 bg-white outline-none focus:border-[#C9A96E]/50 w-72"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'confirmed', 'cancelled'] as Status[]).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`font-sans text-xs px-3 py-1.5 capitalize transition-colors ${
                filter === s ? 'bg-[#C9A96E] text-white' : 'bg-white border border-black/10 text-black/60 hover:border-[#C9A96E]/40'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-black/8 p-12 text-center">
          <p className="font-display italic text-xl text-black/20 mb-2">No bookings found</p>
          <p className="font-sans text-sm text-black/30">Bookings from customers will appear here once confirmed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => (
            <div key={b.id} className="bg-white border border-black/8 overflow-hidden">
              {/* Summary row */}
              <button
                className="w-full text-left px-5 py-4 flex flex-wrap gap-4 items-center hover:bg-black/[0.02] transition-colors"
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
              >
                <div className="min-w-[120px]">
                  <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-0.5">Reference</p>
                  <p className="font-display italic text-base text-[#2d6a4f]">{b.reference}</p>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-0.5">Customer</p>
                  <p className="font-sans text-sm text-black/80 font-medium">{b.customerName}</p>
                </div>
                <div className="min-w-[140px]">
                  <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-0.5">Experience</p>
                  <p className="font-sans text-sm text-black/60 truncate max-w-[180px]">
                    {b.addons.length > 0 ? b.addons[0].title : b.stay?.title || '—'}
                    {b.addons.length > 1 ? ` +${b.addons.length - 1}` : ''}
                  </p>
                </div>
                <div className="min-w-[100px]">
                  <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-0.5">Date</p>
                  <p className="font-sans text-sm text-black/60">{b.addons[0]?.date ? fmt(b.addons[0].date) : fmt(b.checkIn)}</p>
                </div>
                <div className="min-w-[60px] text-center">
                  <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-0.5">Guests</p>
                  <p className="font-sans text-sm text-black/60">{b.guests}</p>
                </div>
                <div className="min-w-[80px]">
                  <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-0.5">Total</p>
                  <p className="font-sans text-sm text-black/80 font-medium">R {b.total.toLocaleString()}</p>
                </div>
                <div>
                  <span className={`font-sans text-xs px-2.5 py-1 capitalize ${STATUS_CHIP[b.status] || 'bg-gray-100 text-gray-500'}`}>{b.status}</span>
                </div>
              </button>

              {/* Expanded customer details */}
              {expanded === b.id && (
                <div className="border-t border-black/6 px-5 py-5 bg-[#FAFAF9] grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-3">Customer Contact</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 font-sans text-sm text-black/70">
                        <Mail size={13} className="text-[#C9A96E] shrink-0" />
                        <a href={`mailto:${b.customerEmail}`} className="hover:underline">{b.customerEmail}</a>
                      </div>
                      {b.customerPhone && (
                        <div className="flex items-center gap-2 font-sans text-sm text-black/70">
                          <Phone size={13} className="text-[#C9A96E] shrink-0" />
                          <a href={`tel:${b.customerPhone}`} className="hover:underline">{b.customerPhone}</a>
                        </div>
                      )}
                      <div className="flex items-center gap-2 font-sans text-sm text-black/70">
                        <Users size={13} className="text-[#C9A96E] shrink-0" />
                        {b.guests} guest{b.guests !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-3">Booking Details</p>
                    <div className="space-y-1.5 font-sans text-sm text-black/60">
                      {b.addons.map(a => (
                        <div key={a.id} className="flex justify-between">
                          <span>{a.title} {a.date ? `— ${fmt(a.date)}` : ''} × {a.guests}</span>
                          <span className="font-medium text-black/70">R {(a.price_per_person * a.guests).toLocaleString()}</span>
                        </div>
                      ))}
                      {b.stay && (
                        <div className="flex justify-between">
                          <span>{b.stay.title} ({b.nights}n)</span>
                          <span className="font-medium text-black/70">R {b.stay.price_per_night ? (b.stay.price_per_night * b.nights).toLocaleString() : '—'}</span>
                        </div>
                      )}
                      {b.shuttle && (
                        <div className="flex justify-between">
                          <span>{b.shuttle.label}</span>
                          <span className="font-medium text-black/70">R {b.shuttle.price.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {b.specialRequests && (
                    <div className="md:col-span-2">
                      <div className="flex items-start gap-2 bg-[#C9A96E]/10 border border-[#C9A96E]/20 p-3">
                        <MessageSquare size={13} className="text-[#C9A96E] shrink-0 mt-0.5" />
                        <div>
                          <p className="font-sans text-[10px] uppercase tracking-wider text-[#8B6914] mb-1">Special Requests</p>
                          <p className="font-sans text-sm text-black/70">{b.specialRequests}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2 pt-2 border-t border-black/6 flex justify-between items-center">
                    <p className="font-sans text-xs text-black/30">Booked {new Date(b.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="font-display italic text-lg text-[#2d6a4f]">Total: R {b.total.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

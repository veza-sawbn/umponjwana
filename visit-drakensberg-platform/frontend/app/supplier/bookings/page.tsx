'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { CalendarDays, Search, Phone, Mail, Users, MessageSquare, XCircle } from 'lucide-react'
import { getMyOrders, cancelOrderAsSupplier, type SupplierOrder } from '@/lib/booking-orders'
import { getMyDepartures, releaseDepartureSeats } from '@/lib/departures'
import { supabase } from '@/lib/auth'

type Status = 'all' | 'confirmed' | 'cancelled'

const STATUS_CHIP: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
}

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BookingsPage() {
  const [filter, setFilter] = useState<Status>('all')
  const [search, setSearch] = useState('')
  const [orders, setOrders] = useState<SupplierOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      // RLS returns only this supplier's orders — each order holds just the
      // items this supplier delivers, never the guest's full itinerary.
      setOrders(await getMyOrders())
      setLoading(false)
    })
  }, [])

  async function cancelOrder(o: SupplierOrder) {
    if (!window.confirm(`Cancel your service on booking ${o.reference} for ${o.customerName}? The guest will be notified; the rest of their trip is unaffected.`)) return
    try {
      await cancelOrderAsSupplier(o)
      // Free any tour departure seats this order held.
      const deps = await getMyDepartures()
      await Promise.all(
        o.items
          .filter(i => deps.some(d => d.id === i.id))
          .map(i => releaseDepartureSeats(i.id, i.guests).catch(() => {}))
      )
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: 'cancelled' } : x))
      toast.success('Your service was cancelled and the guest notified.')
    } catch {
      toast.error('Could not cancel this booking. Please try again.')
    }
  }

  const filtered = orders.filter(o =>
    (filter === 'all' || o.status === filter) &&
    (
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      o.reference.toLowerCase().includes(search.toLowerCase()) ||
      o.items.some(i => i.title.toLowerCase().includes(search.toLowerCase()))
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
            placeholder="Search guest, ref, or service…"
            aria-label="Search bookings"
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
          <p className="font-sans text-sm text-black/30">Bookings for your services will appear here as guests confirm them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => {
            const firstItem = o.items[0]
            const primaryDate = o.checkIn || firstItem?.date
            return (
              <div key={o.id} className="bg-white border border-black/8 overflow-hidden">
                {/* Summary row */}
                <button
                  className="w-full text-left px-5 py-4 flex flex-wrap gap-4 items-center hover:bg-black/[0.02] transition-colors"
                  onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                >
                  <div className="min-w-[120px]">
                    <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-0.5">Reference</p>
                    <p className="font-display italic text-base text-[#2d6a4f]">{o.reference}</p>
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-0.5">Customer</p>
                    <p className="font-sans text-sm text-black/80 font-medium">{o.customerName}</p>
                  </div>
                  <div className="min-w-[140px]">
                    <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-0.5">Your service</p>
                    <p className="font-sans text-sm text-black/60 truncate max-w-[180px]">
                      {firstItem?.title || '—'}{o.items.length > 1 ? ` +${o.items.length - 1}` : ''}
                    </p>
                  </div>
                  <div className="min-w-[100px]">
                    <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-0.5">Date</p>
                    <p className="font-sans text-sm text-black/60">{fmt(primaryDate)}</p>
                  </div>
                  <div className="min-w-[60px] text-center">
                    <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-0.5">Guests</p>
                    <p className="font-sans text-sm text-black/60">{o.guests}</p>
                  </div>
                  <div className="min-w-[80px]">
                    <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-0.5">Your total</p>
                    <p className="font-sans text-sm text-black/80 font-medium">R {o.orderTotal.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className={`font-sans text-xs px-2.5 py-1 capitalize ${STATUS_CHIP[o.status] || 'bg-gray-100 text-gray-500'}`}>{o.status}</span>
                  </div>
                </button>

                {/* Expanded details — scoped to this supplier's order only */}
                {expanded === o.id && (
                  <div className="border-t border-black/6 px-5 py-5 bg-[#FAFAF9] grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-3">Customer Contact</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 font-sans text-sm text-black/70">
                          <Mail size={13} className="text-[#C9A96E] shrink-0" />
                          <a href={`mailto:${o.customerEmail}`} className="hover:underline">{o.customerEmail}</a>
                        </div>
                        {o.customerPhone && (
                          <div className="flex items-center gap-2 font-sans text-sm text-black/70">
                            <Phone size={13} className="text-[#C9A96E] shrink-0" />
                            <a href={`tel:${o.customerPhone}`} className="hover:underline">{o.customerPhone}</a>
                          </div>
                        )}
                        <div className="flex items-center gap-2 font-sans text-sm text-black/70">
                          <Users size={13} className="text-[#C9A96E] shrink-0" />
                          {o.guests} guest{o.guests !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-3">Booked Services</p>
                      <div className="space-y-1.5 font-sans text-sm text-black/60">
                        {o.items.map(i => (
                          <div key={i.id} className="flex justify-between">
                            <span>
                              {i.title}
                              {i.type === 'stay'
                                ? ` (${o.nights ?? 0}n · ${fmt(o.checkIn)} → ${fmt(o.checkOut)})`
                                : i.date ? ` — ${fmt(i.date)}` : ''} × {i.guests}
                            </span>
                            <span className="font-medium text-black/70">R {i.total.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {o.specialRequests && (
                      <div className="md:col-span-2">
                        <div className="flex items-start gap-2 bg-[#C9A96E]/10 border border-[#C9A96E]/20 p-3">
                          <MessageSquare size={13} className="text-[#C9A96E] shrink-0 mt-0.5" />
                          <div>
                            <p className="font-sans text-[10px] uppercase tracking-wider text-[#8B6914] mb-1">Special Requests</p>
                            <p className="font-sans text-sm text-black/70">{o.specialRequests}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="md:col-span-2 pt-2 border-t border-black/6 flex flex-wrap gap-3 justify-between items-center">
                      <p className="font-sans text-xs text-black/30">Booked {new Date(o.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      <div className="flex items-center gap-4">
                        {o.status === 'confirmed' && (
                          <button
                            onClick={() => cancelOrder(o)}
                            className="inline-flex items-center gap-1.5 font-sans text-xs text-red-500 border border-red-200 px-3 py-1.5 hover:bg-red-50 transition-colors"
                          >
                            <XCircle size={12} /> Cancel this service
                          </button>
                        )}
                        <p className="font-display italic text-lg text-[#2d6a4f]">Your total: R {o.orderTotal.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

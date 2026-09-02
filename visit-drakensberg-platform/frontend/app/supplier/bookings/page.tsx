'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { CalendarDays, Search, Phone, Mail, Users, MessageSquare, XCircle, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { getMyOrders, cancelOrderAsSupplier, type SupplierOrder } from '@/lib/booking-orders'
import { getMyOrderLinesForBooking, setLineFulfilment, type OrderLine } from '@/lib/orders'
import { getMyDepartures, releaseDepartureSeats } from '@/lib/departures'
import { releaseActivityTimeslot } from '@/lib/activities'
import { supabase } from '@/lib/auth'
import { readManagedSupplierId } from '@/lib/effective-supplier'
import { formatMoney } from '@/lib/allocation'
import { decideStayRequest, holdDeadlineLabel, paymentWindowHours } from '@/lib/stay-requests'

type Status = 'all' | 'requested' | 'confirmed' | 'cancelled'

const STATUS_CHIP: Record<string, string> = {
  requested: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-red-100 text-red-600',
  expired: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
}

// What each state means from the operator's side of the desk.
const STATUS_LABEL: Record<string, string> = {
  requested: 'awaiting your confirmation',
  pending: 'guest paying',
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
  const [linesByBooking, setLinesByBooking] = useState<Record<string, OrderLine[]>>({})
  const [linesLoading, setLinesLoading] = useState<Record<string, boolean>>({})
  const [deciding, setDeciding] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      // RLS returns only this supplier's orders — each order holds just the
      // items this supplier delivers, never the guest's full itinerary. An
      // operations employee managing several suppliers is admitted to all of
      // theirs, so narrow to the one they have actually entered, the way
      // every other supplier-portal screen does.
      const rows = await getMyOrders()
      const managed = readManagedSupplierId()
      setOrders(managed ? rows.filter(o => o.supplierId === managed) : rows)
      setLoading(false)
    })
  }, [])

  async function cancelOrder(o: SupplierOrder) {
    if (!window.confirm(`Cancel your service on booking ${o.reference} for ${o.customerName}? The guest will be notified; the rest of their trip is unaffected.`)) return
    try {
      await cancelOrderAsSupplier(o)
      // Free any tour departure seats and activity timeslots this order held.
      const deps = await getMyDepartures()
      await Promise.all([
        ...o.items
          .filter(i => deps.some(d => d.id === i.id))
          .map(i => releaseDepartureSeats(i.id, i.guests).catch(() => {})),
        ...o.items
          .filter(i => i.activityId && i.timeslotId && i.date)
          .map(i => releaseActivityTimeslot(i.activityId!, i.date!, i.timeslotId!, i.guests).catch(() => {})),
      ])
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: 'cancelled' } : x))
      toast.success('Your service was cancelled and the guest notified.')
    } catch {
      toast.error('Could not cancel this booking. Please try again.')
    }
  }

  // Request-to-book stays: the guest asked, this operator answers. Goes
  // through vd_decide_stay_request rather than a direct write — the decision
  // has to touch the parent booking, which suppliers deliberately cannot
  // reach (20260705 revoked that access; they see only their own order
  // slice). The RPC authorises against the stay order below, re-checks the
  // room is still free on approval, sets the payment deadline and tells the
  // guest.
  async function decide(o: SupplierOrder, approve: boolean) {
    setDeciding(o.id)
    try {
      const result = await decideStayRequest(o.bookingId, approve, declineReason.trim())
      setOrders(prev => prev.map(x => x.bookingId === o.bookingId ? { ...x, status: result.status } : x))
      setDecliningId(null)
      setDeclineReason('')
      toast.success(approve
        ? `Dates confirmed. ${o.customerName} has until ${holdDeadlineLabel(result.holdExpiresAt ?? undefined)} to pay.`
        : 'Request declined and the guest told. They were never charged.')
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      toast.error(/sold out/i.test(message)
        ? 'That room is no longer free for these dates — decline the request instead.'
        : message || 'Could not record your decision. Please try again.')
    } finally {
      setDeciding(null)
    }
  }

  // Line items carry the real fulfilment status (vd_order_lines); this
  // booking's vd_booking_orders row only ever tracks confirmed/cancelled.
  // Fetched lazily on expand rather than for every row up front.
  async function toggleExpand(o: SupplierOrder) {
    const willOpen = expanded !== o.id
    setExpanded(willOpen ? o.id : null)
    if (willOpen && !linesByBooking[o.bookingId]) {
      setLinesLoading(s => ({ ...s, [o.bookingId]: true }))
      const lines = await getMyOrderLinesForBooking(o.bookingId)
      setLinesByBooking(s => ({ ...s, [o.bookingId]: lines }))
      setLinesLoading(s => ({ ...s, [o.bookingId]: false }))
    }
  }

  async function markLineCompleted(bookingId: string, line: OrderLine) {
    try {
      await setLineFulfilment(line.id, 'fulfilled')
      setLinesByBooking(s => ({
        ...s,
        [bookingId]: (s[bookingId] ?? []).map(l => l.id === line.id ? { ...l, fulfilment_status: 'fulfilled' } : l),
      }))
      toast.success('Marked as completed.')
    } catch {
      toast.error('Could not update. Please try again.')
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

      {orders.some(o => o.status === 'requested') && (
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 px-4 py-3">
          <AlertTriangle size={15} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="font-sans text-sm text-black/70">
            <span className="font-medium">
              {orders.filter(o => o.status === 'requested').length} booking request
              {orders.filter(o => o.status === 'requested').length !== 1 ? 's are' : ' is'} waiting on you.
            </span>{' '}
            These guests can&apos;t pay until you confirm the dates are available.
          </p>
        </div>
      )}

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
          {(['all', 'requested', 'confirmed', 'cancelled'] as Status[]).map(s => (
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
                  onClick={() => toggleExpand(o)}
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
                    <p className="font-sans text-sm text-black/80 font-medium">{formatMoney(o.orderTotal)}</p>
                  </div>
                  <div>
                    <span className={`font-sans text-xs px-2.5 py-1 ${STATUS_CHIP[o.status] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                  </div>
                </button>

                {/* Request-to-book: this stay isn't sold until you confirm it. */}
                {o.status === 'requested' && (
                  <div className="border-t border-black/6 px-5 py-4 bg-blue-50/40">
                    <div className="flex items-start gap-2 mb-3">
                      <Clock size={14} className="text-blue-600 mt-0.5 shrink-0" />
                      <p className="font-sans text-xs text-black/60 leading-relaxed">
                        {o.customerName} is asking about {fmt(o.checkIn)} → {fmt(o.checkOut)}
                        {o.nights ? ` (${o.nights} night${o.nights !== 1 ? 's' : ''})` : ''} for {o.guests} guest{o.guests !== 1 ? 's' : ''}.
                        They have not been charged. Confirming holds the room and gives them{' '}
                        {paymentWindowHours(o.checkIn ?? '')} hours to pay; if they don&apos;t, it releases automatically.
                      </p>
                    </div>
                    {decliningId === o.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          value={declineReason}
                          onChange={e => setDeclineReason(e.target.value)}
                          placeholder="Why these dates don't work — shared with the guest (optional)…"
                          className="w-full font-sans text-sm border border-black/10 px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => decide(o, false)}
                            disabled={deciding === o.id}
                            className="bg-red-500 text-white font-sans text-sm px-4 py-2 hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            <XCircle size={13} className="inline mr-1.5 -mt-0.5" />
                            {deciding === o.id ? 'Declining…' : 'Decline request'}
                          </button>
                          <button
                            onClick={() => { setDecliningId(null); setDeclineReason('') }}
                            className="font-sans text-sm px-4 py-2 border border-black/10 text-black/50 hover:border-black/20 transition-colors"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => decide(o, true)}
                          disabled={deciding === o.id}
                          className="bg-[#2d6a4f] text-white font-sans text-sm px-4 py-2 hover:bg-[#235a3f] disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle2 size={13} className="inline mr-1.5 -mt-0.5" />
                          {deciding === o.id ? 'Confirming…' : 'Confirm availability'}
                        </button>
                        <button
                          onClick={() => setDecliningId(o.id)}
                          disabled={deciding === o.id}
                          className="font-sans text-sm px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {o.status === 'pending' && (
                  <div className="border-t border-black/6 px-5 py-3 bg-amber-50/50">
                    <p className="font-sans text-xs text-amber-800 flex items-center gap-1.5">
                      <Clock size={12} /> You confirmed these dates — the room is held while {o.customerName} pays.
                      It releases automatically if they don&apos;t.
                    </p>
                  </div>
                )}

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
                            <span className="font-medium text-black/70">{formatMoney(i.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <p className="font-sans text-[10px] uppercase tracking-wider text-black/30 mb-3">Trip Status</p>
                      {linesLoading[o.bookingId] ? (
                        <p className="font-sans text-xs text-black/30">Loading…</p>
                      ) : (linesByBooking[o.bookingId] ?? []).length === 0 ? (
                        <p className="font-sans text-xs text-black/30">No fulfilment record for this booking yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(linesByBooking[o.bookingId] ?? []).map(line => (
                            <div key={line.id} className="flex items-center justify-between gap-3 bg-white border border-black/6 px-3 py-2">
                              <div className="min-w-0">
                                <p className="font-sans text-sm text-black/70 truncate">{line.title}</p>
                                <p className="font-sans text-[11px] text-black/30 capitalize">{line.fulfilment_status.replace('_', ' ')}</p>
                              </div>
                              {line.fulfilment_status === 'fulfilled' ? (
                                <span className="inline-flex items-center gap-1 font-sans text-xs text-emerald-600 shrink-0">
                                  <CheckCircle2 size={13} /> Completed
                                </span>
                              ) : line.fulfilment_status === 'cancelled' ? (
                                <span className="font-sans text-xs text-black/30 shrink-0">Cancelled</span>
                              ) : (
                                <button
                                  onClick={() => markLineCompleted(o.bookingId, line)}
                                  className="font-sans text-xs text-[#2d6a4f] border border-[#2d6a4f]/30 px-3 py-1.5 hover:bg-[#2d6a4f]/5 transition-colors shrink-0"
                                >
                                  Mark trip completed
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
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
                        <p className="font-display italic text-lg text-[#2d6a4f]">Your total: {formatMoney(o.orderTotal)}</p>
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

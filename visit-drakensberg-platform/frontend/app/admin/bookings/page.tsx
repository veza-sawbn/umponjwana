'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, DollarSign, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react'
import { getAdminBookings, setAdminBookingStatus } from '@/lib/admin-supabase'
import type { SavedBooking } from '@/lib/bookings'
import { useQuickParam } from '@/lib/admin-quick-param'
import { formatMoney } from '@/lib/allocation'
import { getOrders, type MasterOrder } from '@/lib/orders'
import { bookingPayment, hadCapturedPayment, ordersByBooking, PAYMENT_STATE_LABEL, type BookingPayment, type BookingPaymentState } from '@/lib/booking-payment'
import { settleCancelledBooking, type SettlementMode } from '@/lib/guest-credit'

const BOOKING_STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  pending: 'bg-[#C9A96E]/15 text-[#8B6914]',
  cancelled: 'bg-red-50 text-red-400',
  completed: 'bg-gray-100 text-gray-500',
}

const PAYMENT_STYLE: Record<BookingPaymentState, string> = {
  paid: 'text-[#2d6a4f]',
  partial: 'text-[#8B6914]',
  unpaid: 'text-[#C9A96E]',
  refund_due: 'text-red-400',
  refunded: 'text-gray-400',
  credited: 'text-gray-500',
  not_due: 'text-gray-300',
}

function PaymentCell({ payment }: { payment: BookingPayment }) {
  const detail = payment.state === 'partial' ? `${formatMoney(payment.captured)} of ${formatMoney(payment.due)}`
    : payment.state === 'refund_due' ? formatMoney(payment.refundDue)
    : ''
  return (
    <span className={`font-sans text-xs ${PAYMENT_STYLE[payment.state]}`}>
      {PAYMENT_STATE_LABEL[payment.state]}
      {detail && <span className="block text-[10px] text-gray-400">{detail}</span>}
    </span>
  )
}

function fmt(d: string) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function listingName(booking: SavedBooking) {
  return booking.stay?.title || booking.addons[0]?.title || booking.shuttles[0]?.label || 'Custom itinerary'
}

function supplierName(booking: SavedBooking) {
  return booking.addons.find(addon => addon.operator)?.operator || 'Supplier pending'
}

function bookingType(booking: SavedBooking) {
  if (booking.stay) return 'accommodation'
  if (booking.shuttles.length > 0) return 'shuttle'
  return booking.addons[0]?.type || 'itinerary'
}

// Cancelling a booking the guest has already paid for is a money decision,
// not just a status change: the payment goes back as a refund, or stays with
// us as credit on the guest's account. `cancelFirst` is false when the
// booking is already cancelled and only the money is still outstanding.
function SettleDialog({ booking, amount, cancelFirst, onClose, onDone }: {
  booking: SavedBooking
  amount: number
  cancelFirst: boolean
  onClose: () => void
  /** Called once the booking has changed; `failed` when the money step did not land. */
  onDone: (message: string, failed?: boolean) => void
}) {
  const [mode, setMode] = useState<SettlementMode>('refund')
  const [method, setMethod] = useState('card')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true)
    setError('')
    let cancelled = false
    try {
      if (cancelFirst) {
        await setAdminBookingStatus(booking.id, 'cancelled')
        cancelled = true
      }
      const settled = await settleCancelledBooking(booking, { mode, method, reference, notes })
      onDone(mode === 'credit'
        ? `${booking.reference} cancelled — ${formatMoney(settled)} credited to ${booking.customerName}'s account.`
        : `${booking.reference} cancelled — refund of ${formatMoney(settled)} recorded.`)
    } catch (e) {
      const why = e instanceof Error ? e.message : 'unknown error'
      // Cancelled but not settled: close, so a retry doesn't cancel twice —
      // the row now reads Refund due and settles from its own action.
      if (cancelled) onDone(`${booking.reference} was cancelled, but the ${mode} could not be recorded (${why}). Use "Refund / credit" on the booking to finish.`, true)
      else setError(`Could not ${cancelFirst ? 'cancel this booking' : `record the ${mode}`} (${why}).`)
    } finally {
      setBusy(false)
    }
  }

  const option = (value: SettlementMode, title: string, detail: string) => (
    <label className={`flex gap-3 border p-3 cursor-pointer ${mode === value ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200'}`}>
      <input type="radio" name="settle-mode" checked={mode === value} onChange={() => setMode(value)} className="mt-1 accent-[#2d6a4f]" />
      <span><span className="block font-sans text-sm font-medium">{title}</span><span className="block font-sans text-xs text-gray-500 mt-0.5">{detail}</span></span>
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-6" onClick={busy ? undefined : onClose}>
      <div className="bg-white w-full sm:max-w-md p-5 sm:p-6" onClick={e => e.stopPropagation()}>
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">{booking.reference}</p>
        <h2 className="font-display italic text-2xl text-[#000000]">{cancelFirst ? 'Cancel paid booking' : 'Settle cancelled booking'}</h2>
        <p className="font-sans text-sm text-gray-500 mt-2">
          {booking.customerName} paid <span className="font-medium text-gray-800">{formatMoney(amount)}</span>. {cancelFirst ? 'Once cancelled, that' : 'That'} money has to go back to them — choose how.
        </p>
        <div className="space-y-2 mt-4">
          {option('refund', 'Refund the guest', 'Record a refund you have made (card reversal in iKhokha, or EFT).')}
          {option('credit', "Credit the guest's account", 'Keep the money as credit towards a future booking. The guest sees it on their account.')}
        </div>
        {mode === 'refund' && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <select value={method} onChange={e => setMethod(e.target.value)} className="border border-gray-200 px-3 py-2 font-sans text-base sm:text-sm bg-white">
              <option value="card">Card reversal</option>
              <option value="eft">EFT</option>
            </select>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Refund reference" className="border border-gray-200 px-3 py-2 font-sans text-base sm:text-sm" />
          </div>
        )}
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note (optional)" className="w-full border border-gray-200 px-3 py-2 font-sans text-base sm:text-sm mt-2" />
        {error && <p className="font-sans text-xs text-red-500 mt-3">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={busy} className="flex-1 border border-gray-200 py-2.5 font-sans text-sm text-gray-600">Back</button>
          <button onClick={submit} disabled={busy} className="flex-1 bg-[#2d6a4f] text-white py-2.5 font-sans text-sm disabled:opacity-60">
            {busy ? 'Saving…' : cancelFirst ? `Cancel & ${mode === 'credit' ? 'credit' : 'refund'}` : `Record ${mode}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<SavedBooking[]>([])
  const [orders, setOrders] = useState<MasterOrder[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [settling, setSettling] = useState<{ booking: SavedBooking; amount: number; cancelFirst: boolean } | null>(null)

  async function loadBookings() {
    setLoading(true)
    setError('')
    try {
      // Payment facts live on the bookings' Master Orders, not the booking row.
      const [data, orderRows] = await Promise.all([getAdminBookings(), getOrders()])
      setBookings(data.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      setOrders(orderRows)
    } catch {
      setError('Could not load bookings from Supabase.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBookings() }, [])

  // Landed here from the mobile quick-action sheet.
  useQuickParam('filter', v => setFilter(v))

  const filtered = useMemo(() => bookings.filter(b => {
    const haystack = `${b.reference} ${b.customerName} ${b.customerEmail} ${listingName(b)} ${supplierName(b)}`.toLowerCase()
    const matchSearch = haystack.includes(search.toLowerCase())
    const matchFilter = filter === 'all' || b.status === filter
    return matchSearch && matchFilter
  }), [bookings, filter, search])

  const payments = useMemo(() => {
    const byBooking = ordersByBooking(orders)
    return new Map(bookings.map(b => [b.id, bookingPayment(b, byBooking.get(b.id) ?? [])]))
  }, [bookings, orders])
  const paymentOf = (b: SavedBooking) => payments.get(b.id) ?? bookingPayment(b, [])

  // Revenue is money actually captured on bookings that still stand — not the
  // face value of confirmed bookings, and nothing from cancelled ones.
  const totalRevenue = bookings.reduce((sum, b) => sum + paymentOf(b).captured, 0)
  const confirmed = bookings.filter(b => b.status === 'confirmed').length
  const pending = bookings.filter(b => (b.status as string) === 'pending').length
  const cancelled = bookings.filter(b => b.status === 'cancelled').length

  async function updateStatus(id: string, status: SavedBooking['status']) {
    await setAdminBookingStatus(id, status)
    await loadBookings()
  }

  // A paid booking can't just be flipped to cancelled — the money has to be
  // refunded or credited to the guest in the same step.
  function cancelBooking(b: SavedBooking) {
    const p = paymentOf(b)
    if (p.captured > 0) {
      setSettling({ booking: b, amount: p.captured, cancelFirst: true })
      return
    }
    if (window.confirm(`Cancel ${b.reference}? No payment has been captured, so nothing is owed back.`)) {
      updateStatus(b.id, 'cancelled')
    }
  }

  function bookingActions(b: SavedBooking, variant: 'table' | 'card') {
    const p = paymentOf(b)
    const cls = variant === 'table'
      ? (tone: string) => `font-sans text-xs ${tone} hover:underline whitespace-nowrap`
      : (tone: string) => `flex-1 border border-gray-200 py-2.5 font-sans text-sm ${tone}`
    return <>
      {/* A booking whose payment was captured and is being given back stays cancelled. */}
      {b.status !== 'confirmed' && !hadCapturedPayment(p) && <button onClick={() => updateStatus(b.id, 'confirmed')} className={cls('text-[#2d6a4f]')}>Confirm</button>}
      {b.status !== 'cancelled' && <button onClick={() => cancelBooking(b)} className={cls('text-red-400')}>Cancel</button>}
      {p.state === 'refund_due' && <button onClick={() => setSettling({ booking: b, amount: p.refundDue, cancelFirst: false })} className={cls('text-[#8B6914]')}>Refund / credit</button>}
    </>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">Bookings</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Confirmed checkout bookings stored in Supabase.</p>
        </div>
        <button onClick={loadBookings} className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 sm:py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors shrink-0">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
      {notice && <p className="mb-4 text-sm text-[#2d6a4f]">{notice}</p>}
      {settling && <SettleDialog {...settling} onClose={() => setSettling(null)} onDone={(msg, failed) => { setSettling(null); loadBookings(); setNotice(failed ? '' : msg); if (failed) setError(msg) }} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 lg:mb-8">
        {[
          { label: 'Total Revenue', value: `${formatMoney(totalRevenue)}`, icon: DollarSign, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
          { label: 'Confirmed', value: confirmed, icon: CheckCircle, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/8' },
          { label: 'Pending', value: pending, icon: Clock, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
          { label: 'Cancelled', value: cancelled, icon: XCircle, color: 'text-red-400', bg: 'bg-red-50' },
        ].map(s => {
          const Icon = s.icon
          return <div key={s.label} className="bg-white border border-gray-200 p-4"><div className={`${s.bg} w-8 h-8 flex items-center justify-center mb-3`}><Icon size={15} className={s.color} /></div><p className="font-display italic text-2xl text-[#000000]">{s.value}</p><p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{s.label}</p></div>
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2.5 sm:py-2 flex-1 sm:min-w-[220px]"><Search size={14} className="text-gray-400 shrink-0" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guest, listing, supplier or ref…" className="flex-1 min-w-0 font-sans text-base sm:text-sm focus:outline-none" /></div>
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
          <div className="flex w-max border border-gray-200 bg-white">{['all', 'pending', 'confirmed', 'cancelled'].map(f => <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2.5 sm:py-2 font-sans text-xs capitalize whitespace-nowrap transition-colors border-r border-gray-100 last:border-0 ${filter === f ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>{f}</button>)}</div>
        </div>
      </div>

      {/* Phones: a card per booking, with confirm/cancel as full-width taps. */}
      <div className="md:hidden bg-white border border-gray-200 divide-y divide-gray-100">
        {filtered.map(b => (
          <div key={b.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-gray-400">{b.reference}</p>
                <p className="font-sans text-sm font-medium truncate mt-0.5">{b.customerName}</p>
                <p className="font-sans text-xs text-gray-400 truncate">{listingName(b)}</p>
              </div>
              <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 shrink-0 ${BOOKING_STATUS_STYLE[b.status] ?? BOOKING_STATUS_STYLE.pending}`}>{b.status}</span>
            </div>
            <div className="flex items-end justify-between gap-3 mt-3">
              <p className="font-sans text-xs text-gray-500">{fmt(b.checkIn)}{b.checkIn !== b.checkOut ? ` — ${fmt(b.checkOut)}` : ''} · {b.guests} {b.guests === 1 ? 'guest' : 'guests'}</p>
              <div className="text-right">
                <p className="font-display italic text-xl text-[#2d6a4f]">{formatMoney(b.total)}</p>
                <PaymentCell payment={paymentOf(b)} />
              </div>
            </div>
            <div className="flex gap-2 mt-3">{bookingActions(b, 'card')}</div>
          </div>
        ))}
        {!loading && filtered.length === 0 && <p className="px-4 py-12 text-center font-sans text-sm text-gray-400">No bookings found.</p>}
        {loading && <p className="px-4 py-12 text-center font-sans text-sm text-gray-400">Loading bookings…</p>}
      </div>

      <div className="hidden md:block bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead><tr className="border-b border-gray-100">{['Booking Ref', 'Visitor', 'Listing', 'Dates', 'Guests', 'Total', 'Payment', 'Status', 'Actions'].map(h => <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(b => <tr key={b.id} className="hover:bg-[#F7F5F2] transition-colors"><td className="px-5 py-4 font-mono text-xs text-gray-400">{b.reference}</td><td className="px-5 py-4"><p className="font-sans text-sm font-medium">{b.customerName}</p><p className="font-sans text-xs text-gray-400">{b.customerEmail}</p></td><td className="px-5 py-4"><p className="font-sans text-sm text-gray-700">{listingName(b)}</p><p className="font-sans text-xs text-gray-400">{supplierName(b)} · {bookingType(b)}</p></td><td className="px-5 py-4 font-sans text-xs text-gray-500">{fmt(b.checkIn)}{b.checkIn !== b.checkOut ? ` — ${fmt(b.checkOut)}` : ''}</td><td className="px-5 py-4 font-sans text-sm text-gray-600">{b.guests}</td><td className="px-5 py-4 font-display italic text-[#2d6a4f]">{formatMoney(b.total)}</td><td className="px-5 py-4"><PaymentCell payment={paymentOf(b)} /></td><td className="px-5 py-4"><span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${BOOKING_STATUS_STYLE[b.status] ?? BOOKING_STATUS_STYLE.pending}`}>{b.status}</span></td><td className="px-5 py-4"><div className="flex gap-2">{bookingActions(b, 'table')}</div></td></tr>)}
            {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-5 py-12 text-center font-sans text-sm text-gray-400">No bookings found.</td></tr>}
            {loading && <tr><td colSpan={9} className="px-5 py-12 text-center font-sans text-sm text-gray-400">Loading bookings…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

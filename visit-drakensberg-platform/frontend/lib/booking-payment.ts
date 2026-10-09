// What the admin Bookings console says about a booking's money. Kept free of
// the Supabase client so it can be unit-tested on its own.
//
// The booking row itself carries no payment facts — those live on its Master
// Order(s) in vd_orders, written by vd_record_order_payment (the iKhokha
// webhook or a staff receipt) and vd_cancel_order. A booking reads "paid" only
// once the full order value has been captured AND the booking still stands:
// cancelling a paid booking moves amount_paid into refund_balance, so it reads
// "refund due" until finance settles it (lib/guest-credit.ts) — then
// "refunded", or "credited" when the money went onto the guest's account.

export type BookingPaymentState =
  | 'paid'
  | 'partial'
  | 'unpaid'
  | 'refund_due'
  | 'refunded'
  | 'credited'
  | 'not_due'

export type OrderMoney = {
  booking_id: string | null
  payment_status: string
  total_value: number
  amount_paid: number
  refund_balance: number
}

export type BookingPayment = {
  state: BookingPaymentState
  /** Money captured and still held against the booking. */
  captured: number
  /** What the booking's order(s) are worth. */
  due: number
  /** Captured money owed back to the guest after a cancellation. */
  refundDue: number
}

export const PAYMENT_STATE_LABEL: Record<BookingPaymentState, string> = {
  paid: 'Paid',
  partial: 'Part paid',
  unpaid: 'Unpaid',
  refund_due: 'Refund due',
  refunded: 'Refunded',
  credited: 'Credited to guest',
  not_due: '—',
}

// Statuses that never reach checkout — a stay request still waiting on (or
// turned down by) its operator has no order and nothing to pay.
const NO_PAYMENT_STATUSES = new Set(['requested', 'declined', 'expired'])

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

export function bookingPayment(
  booking: { status: string },
  orders: OrderMoney[],
): BookingPayment {
  const due = orders.reduce((s, o) => s + num(o.total_value), 0)
  const paidIn = orders.reduce((s, o) => s + num(o.amount_paid), 0)
  const refundDue = orders.reduce((s, o) => s + num(o.refund_balance), 0)
  const settledAs = (status: string) => orders.length > 0 && orders.every(o => o.payment_status === status)
  const refunded = settledAs('refunded')

  if (booking.status === 'cancelled') {
    if (refundDue > 0) return { state: 'refund_due', captured: 0, due, refundDue }
    if (refunded) return { state: 'refunded', captured: 0, due, refundDue: 0 }
    if (settledAs('credited')) return { state: 'credited', captured: 0, due, refundDue: 0 }
    // A mix of refunded and credited orders on one booking.
    if (paidIn > 0) return { state: 'refunded', captured: 0, due, refundDue: 0 }
    return { state: 'not_due', captured: 0, due, refundDue: 0 }
  }

  if (NO_PAYMENT_STATUSES.has(booking.status) || orders.length === 0) {
    const state = NO_PAYMENT_STATUSES.has(booking.status) ? 'not_due' : 'unpaid'
    return { state, captured: 0, due, refundDue: 0 }
  }

  if (refunded) return { state: 'refunded', captured: 0, due, refundDue: 0 }

  const captured = Math.max(paidIn - refundDue, 0)
  // Fully captured means every order says so and the money covers the value —
  // a rounding cent short of the total is still short.
  const fullyCaptured = due > 0
    && captured >= due
    && orders.every(o => o.payment_status === 'paid')
  if (fullyCaptured) return { state: 'paid', captured, due, refundDue: 0 }
  if (captured > 0) return { state: 'partial', captured, due, refundDue: 0 }
  return { state: 'unpaid', captured: 0, due, refundDue: 0 }
}

/** Money was taken for this booking at some point — so it must not simply be
 *  re-confirmed: the payment has been (or is being) given back. */
export function hadCapturedPayment(p: BookingPayment): boolean {
  return p.state === 'refund_due' || p.state === 'refunded' || p.state === 'credited'
}

/** Group orders by the booking they belong to. */
export function ordersByBooking<T extends { booking_id: string | null }>(orders: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const o of orders) {
    if (!o.booking_id) continue
    const list = map.get(o.booking_id)
    if (list) list.push(o)
    else map.set(o.booking_id, [o])
  }
  return map
}

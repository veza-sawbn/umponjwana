import { supabase } from './auth'
import { getPropertyById, type Property } from './properties'
import type { SavedBooking } from './bookings'

// Request-to-book stays.
//
// A property switched to bookingMode='request' (ops/admin, on /admin/listings)
// does not sell instantly: the operator holds the real availability and has to
// confirm the dates before the guest is charged. The booking follows the same
// shape as a custom-trip request —
//
//   requested → (operator approves) → pending → (guest pays) → confirmed
//            └→ (operator declines) → declined
//            └→ (nobody answers)    → expired
//
// — and, like one, a 'requested' booking is not a sale: no inventory hold, no
// Master Order, no invoice, no ledger entries, no transport dispatch. See
// supabase/migrations/20260902_stay_booking_requests.sql.

/** Absent means instant: every property that predates this field books normally. */
export function isRequestMode(property: Pick<Property, 'bookingMode'> | null | undefined): boolean {
  return property?.bookingMode === 'request'
}

export async function propertyRequiresRequest(propertyId: string | undefined | null): Promise<boolean> {
  if (!propertyId || !propertyId.startsWith('prop-')) return false
  try {
    return isRequestMode(await getPropertyById(propertyId))
  } catch {
    // A lookup failure must not silently downgrade a request-only property
    // into an instant sale the operator never agreed to.
    throw new Error('Could not check this property’s booking rules. Please try again.')
  }
}

/**
 * How long an approved request has to be paid, in hours.
 *
 * Mirrors vd_stay_payment_deadline() in the migration — the database owns the
 * real deadline, this is for telling the guest what to expect *before* they
 * commit. A room six days out cannot sit reserved overnight for someone who
 * may never pay, so the window tightens as check-in approaches.
 */
export function paymentWindowHours(checkIn: string): number {
  if (!checkIn) return 24
  const days = Math.floor(
    (new Date(`${checkIn}T00:00:00Z`).getTime() - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime())
    / 86_400_000,
  )
  return Number.isFinite(days) && days < 7 ? 12 : 24
}

/** "24 hours" / "12 hours" — for checkout and confirmation copy. */
export function paymentWindowLabel(checkIn: string): string {
  return `${paymentWindowHours(checkIn)} hours`
}

export function holdDeadlineLabel(iso: string | undefined): string {
  if (!iso) return ''
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function holdHasLapsed(iso: string | undefined): boolean {
  if (!iso) return false
  const at = new Date(iso).getTime()
  return Number.isFinite(at) && at < Date.now()
}

export type StayRequestDecision = { status: 'pending' | 'declined'; holdExpiresAt: string | null }

/**
 * The operator's answer. Goes through vd_decide_stay_request rather than a
 * direct write: the decision has to touch the parent booking, which suppliers
 * deliberately cannot reach (20260705 revoked their vd_bookings access — they
 * see only their own order slice). The RPC authorises against the stay order
 * they own, re-checks capacity on approval, sets the payment deadline and
 * notifies the guest.
 */
export async function decideStayRequest(
  bookingId: string,
  approve: boolean,
  reason = '',
): Promise<StayRequestDecision> {
  const { data, error } = await supabase.rpc('vd_decide_stay_request', {
    p_booking_id: bookingId,
    p_approve: approve,
    p_reason: reason,
  })
  if (error) throw new Error(error.message || 'Could not record your decision')
  return data as StayRequestDecision
}

/** Bookings still waiting on this operator, newest first. */
export function pendingRequests<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter(r => r.status === 'requested')
}

export function isAwaitingPayment(booking: Pick<SavedBooking, 'status' | 'holdExpiresAt'>): boolean {
  return booking.status === 'pending' && !!booking.holdExpiresAt
}

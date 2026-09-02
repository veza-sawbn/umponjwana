import { supabase } from './auth'
import type { BookingAddon, BookingStay, ShuttleOption } from './booking-context'
import { getPropertyById } from './properties'
import { notify } from './notifications'
import { createOrdersForBooking, cancelOrdersForBooking } from './booking-orders'
import { createOrderForBooking, cancelOrderForBooking } from './orders'
import { createTransportRequestForBooking } from './transport-dispatch'
import { trackEvent, AnalyticsEvent } from './analytics'

export type SavedBooking = {
  id: string
  reference: string
  userId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  specialRequests: string
  region: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  stay: BookingStay | null
  addons: BookingAddon[]
  shuttles: ShuttleOption[]
  subtotal: number
  serviceFee: number
  vat: number
  total: number
  /**
   * The service-fee / VAT rates actually applied to this booking's amounts
   * above, straight from vd_finance_settings at checkout time — not
   * hardcoded, and not re-derived later from the rounded money amounts
   * (which distorts a configured fractional rate, e.g. 12.5%). Optional:
   * bookings saved before this existed don't carry it; callers that display
   * a rate should fall back to omitting the percentage rather than
   * guessing. */
  serviceFeeRate?: number
  vatRate?: number
  /**
   * 'requested' is a question, not a sale: a request-to-book stay waiting on
   * its operator (see lib/stay-requests.ts). It holds no inventory and has no
   * Master Order, invoice or ledger entries — those come into being only when
   * the operator approves and the booking becomes 'pending'. 'declined' and
   * 'expired' are its two dead ends.
   */
  status: 'requested' | 'pending' | 'confirmed' | 'cancelled' | 'declined' | 'expired'
  createdAt: string
  /** The visitor session that created this booking (§21), carried through
   *  to payment confirmation so the server-side iKhokha webhook — which has
   *  no browser session of its own — can still fire booking_completed
   *  against the right session once payment actually clears. Optional:
   *  bookings saved before this existed simply don't get attributed. */
  analyticsAnonId?: string
  analyticsSessionId?: string | null
  /** Set when this booking was created from an accepted custom-trip quote
   *  (see lib/custom-trips.ts acceptQuote()) rather than at checkout. Carried
   *  through the same way as the analytics ids above, so the iKhokha
   *  webhook — no browser session there either — can flip the originating
   *  vd_trip_requests row to 'confirmed' alongside this booking once payment
   *  actually clears. */
  tripRequestId?: string
  /** When an approved stay request's inventory hold lapses, ISO-8601. Set by
   *  vd_decide_stay_request on approval; absent on an instant booking, which
   *  the flat abandoned-checkout TTL covers instead. */
  holdExpiresAt?: string
  /** Why the operator turned a stay request down — shown to the guest. */
  declineReason?: string
}

type Row = {
  id: string
  reference: string
  user_id: string
  supplier_ids: string[]
  status: string
  value: Record<string, unknown>
  created_at: string
}

function rowToBooking(r: Row): SavedBooking {
  const value = r.value as unknown as SavedBooking & { shuttle?: ShuttleOption }
  return {
    ...value,
    stay: value?.stay ?? null,
    addons: value?.addons ?? [],
    // Bookings saved before multi-shuttle support stored a single `shuttle`
    // field instead of `shuttles` — same legacy shape migrated in
    // booking-context.tsx. Preserve it instead of dropping the transfer.
    shuttles: value?.shuttles ?? (value?.shuttle ? [value.shuttle] : []),
    id: r.id,
    reference: r.reference,
    userId: r.user_id,
    status: (r.status as SavedBooking['status']) || 'confirmed',
    createdAt: r.created_at,
  }
}

function genRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `DBK-${part}-KZN`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Every supplier involved in the booking, denormalised so RLS can grant
// suppliers access to exactly the bookings that concern them.
async function collectSupplierIds(booking: Pick<SavedBooking, 'stay' | 'addons'>): Promise<string[]> {
  const ids = new Set<string>()
  for (const addon of booking.addons) {
    if (addon.supplierId && UUID_RE.test(addon.supplierId)) ids.add(addon.supplierId)
  }
  if (booking.stay?.id?.startsWith('prop-')) {
    try {
      const prop = await getPropertyById(booking.stay.id)
      if (prop?.supplierId && UUID_RE.test(prop.supplierId)) ids.add(prop.supplierId)
    } catch {}
  }
  return [...ids]
}

// RLS scopes results automatically: visitors get their own bookings,
// suppliers get bookings that involve them, admins get everything.
export async function getBookings(): Promise<SavedBooking[]> {
  try {
    const { data } = await supabase
      .from('vd_bookings')
      .select('*')
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return (data as Row[]).map(rowToBooking)
  } catch {}
  return []
}

export async function addBooking(
  booking: Omit<SavedBooking, 'id' | 'reference' | 'createdAt'>,
): Promise<{ booking: SavedBooking; invoiceId: string | null }> {
  const supplierIds = await collectSupplierIds(booking)
  const newBooking: SavedBooking = {
    ...booking,
    id: `bk-${crypto.randomUUID()}`,
    reference: genRef(),
    createdAt: new Date().toISOString(),
  }

  // Created via an atomic RPC that checks room inventory and supplier
  // availability blocks under a lock, so the last unit can't be double-sold.
  // Retry once with a fresh reference on the (rare) unique-constraint hit.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.rpc('vd_create_booking', {
      p_id: newBooking.id,
      p_reference: newBooking.reference,
      p_supplier_ids: supplierIds,
      p_status: newBooking.status,
      p_value: newBooking,
    })
    if (!error) break
    if (/duplicate key/i.test(error.message ?? '') && attempt === 0) {
      newBooking.reference = genRef()
      continue
    }
    throw new Error(error.message || 'Booking failed')
  }

  // Split into per-supplier orders: each supplier receives only their own
  // items and the guest details needed to deliver the service. A request-to-
  // book stay needs this too — the operator's own order row is both how they
  // see the request and what vd_decide_stay_request authorises them against.
  try {
    await createOrdersForBooking(newBooking)
  } catch (err) {
    console.error('Order fan-out failed (booking saved):', err)
  }

  // Everything below turns a booking into a sale, and a 'requested' booking
  // is not one yet: the operator has not agreed to the dates. No Master
  // Order, no invoice, no ledger entries and no transport dispatched for a
  // trip that may be declined. All of it happens once the request is
  // approved and the guest pays (see ensureOrderForBooking in lib/orders.ts).
  if (newBooking.status === 'requested') {
    // The operator has to actually hear about it — a request nobody is told
    // about is just a guest waiting in silence. This is the one notification
    // that fires before payment, because the whole point of the request flow
    // is that the operator answers first.
    await Promise.all(supplierIds.map(sid =>
      notify(sid, 'approval', `Booking request ${newBooking.reference}`,
        `${newBooking.customerName} is asking about ${newBooking.checkIn} → ${newBooking.checkOut} `
        + `(${newBooking.guests} guest${newBooking.guests !== 1 ? 's' : ''}). `
        + 'They cannot pay until you confirm the dates are available.',
        '/supplier/bookings')
    ))
    return { booking: newBooking, invoiceId: null }
  }

  // Master Order: the trip's single financial source of truth — line items
  // with supplier allocations, the customer's single invoice (unpaid until
  // iKhokha confirms payment), and balanced ledger entries.
  let invoiceId: string | null = null
  try {
    const result = await createOrderForBooking(newBooking)
    invoiceId = result.invoiceId
  } catch (err) {
    console.error('Master order creation failed (booking saved):', err)
  }

  // Shuttle on the itinerary → transport request into the supplier
  // marketplace, so the transfer ultimately belongs to a real transport
  // company (dispatch scores and offers it to the best-ranked suppliers).
  //
  // NOTE: this still fires immediately, before payment is confirmed — same
  // as the supplier notification below used to. Moving it to fire only on
  // confirmation (from the iKhokha webhook, like the notification now does)
  // would require the whole dispatch/ranking pipeline (rankSuppliers,
  // getTransportCompanies, lib/entities.ts) to run under the service role
  // instead of the browser-session client it's built on — lib/entities.ts is
  // shared by most of the catalog, so that's a wider refactor than this pass
  // covers. Left as a known, deliberately deferred follow-up.
  try {
    await createTransportRequestForBooking(newBooking)
  } catch (err) {
    console.error('Transport request creation failed (booking saved):', err)
  }

  // Only notify suppliers once the booking is actually confirmed — for a
  // 'pending' booking (the checkout default now) that happens later, from
  // the iKhokha webhook once payment is verified, not here.
  if (newBooking.status === 'confirmed') {
    await Promise.all(supplierIds.map(sid =>
      notify(sid, 'booking', `New booking ${newBooking.reference}`,
        `${newBooking.customerName} booked with you (${newBooking.guests} guest${newBooking.guests !== 1 ? 's' : ''}). Open your bookings for details.`,
        '/supplier/bookings')
    ))

    // Booking funnel completion (§3/§5) only fires here, immediately, for a
    // booking created already-confirmed (no payment step to wait on — same
    // condition that gates the supplier notification above). A checkout
    // booking is created 'pending' instead and isn't actually paid for yet;
    // for that path booking_completed fires from the iKhokha webhook once
    // payment is verified (see app/api/payments/ikhokha/webhook/route.ts) —
    // firing it here unconditionally would count every abandoned or
    // declined payment as a completed booking.
    trackEvent(AnalyticsEvent.BOOKING_COMPLETED, {
      booking_id: newBooking.id, reference: newBooking.reference,
      region: newBooking.region, guests: newBooking.guests, total: newBooking.total,
    })
  }

  return { booking: newBooking, invoiceId }
}

export async function getBookingById(id: string): Promise<SavedBooking | null> {
  try {
    const { data } = await supabase.from('vd_bookings').select('*').eq('id', id).maybeSingle()
    if (data) return rowToBooking(data as Row)
  } catch {}
  return null
}

export async function getBookingsByUser(userId: string): Promise<SavedBooking[]> {
  try {
    const { data } = await supabase
      .from('vd_bookings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return (data as Row[]).map(rowToBooking)
  } catch {}
  return []
}

export async function updateBookingStatus(
  id: string,
  status: SavedBooking['status'],
  opts?: { notifyUser?: boolean; notifySuppliers?: boolean },
): Promise<void> {
  const booking = await getBookingById(id)
  if (!booking) return
  const value = { ...booking, status }
  const { error } = await supabase
    .from('vd_bookings')
    .update({ status, value })
    .eq('id', id)
  if (error) throw error

  if (status === 'cancelled') {
    // Keep the per-supplier orders in sync with the parent booking.
    await cancelOrdersForBooking(id)
    // Reverse the Master Order's financials (refund liability, ledger).
    await cancelOrderForBooking(id)
    if (opts?.notifyUser) {
      await notify(booking.userId, 'cancellation', `Booking ${booking.reference} cancelled`,
        'Your booking has been cancelled by the supplier. If you were charged, a refund will follow within 5 business days.',
        '/account')
    }
    if (opts?.notifySuppliers) {
      const supplierIds = await collectSupplierIds(booking)
      await Promise.all(supplierIds.map(sid =>
        notify(sid, 'cancellation', `Booking ${booking.reference} cancelled`,
          `${booking.customerName} cancelled their booking.`, '/supplier/bookings')
      ))
    }
  }
}

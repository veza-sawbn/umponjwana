import { supabase } from './auth'
import { getEffectiveSupplierId } from './effective-supplier'
import type { SavedBooking } from './bookings'
import { getPropertyById } from './properties'
import { notify } from './notifications'

// One order per supplier per booking. The visitor keeps the full itinerary
// in vd_bookings; each supplier only ever sees their own order — their items,
// the guest contact details, party size, dates and special requests. No
// platform totals, no other suppliers' services.

export type OrderItem = {
  id: string
  type: 'stay' | 'activity' | 'hike' | 'tour' | 'event'
  title: string
  roomId?: string
  date?: string
  guests: number
  unitPrice: number
  total: number
  // Carried through from BookingAddon (lib/booking-context.tsx) for an
  // activity booked on a configured timeslot — lets the supplier's own
  // cancellation flow release the seats it holds. Absent for every other
  // item type and for activities with no timeslots configured.
  activityId?: string
  timeslotId?: string
}

export type SupplierOrder = {
  id: string
  bookingId: string
  reference: string
  supplierId: string
  userId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  specialRequests: string
  guests: number
  checkIn?: string
  checkOut?: string
  nights?: number
  items: OrderItem[]
  orderTotal: number
  /**
   * Mirrors the parent booking's status. 'requested' is a request-to-book
   * stay waiting on this supplier's answer — the one state where the
   * supplier is being asked something rather than told (see
   * vd_decide_stay_request and lib/stay-requests.ts); 'pending' means they
   * confirmed the dates and the guest is paying.
   */
  status: 'requested' | 'pending' | 'confirmed' | 'cancelled' | 'declined' | 'expired'
  createdAt: string
}

type Row = {
  id: string
  booking_id: string
  reference: string
  supplier_id: string
  user_id: string
  status: string
  value: Record<string, unknown>
  created_at: string
}

function rowToOrder(r: Row): SupplierOrder {
  return {
    ...(r.value as unknown as SupplierOrder),
    id: r.id,
    bookingId: r.booking_id,
    reference: r.reference,
    supplierId: r.supplier_id,
    userId: r.user_id,
    status: (r.status as SupplierOrder['status']) || 'confirmed',
    createdAt: r.created_at,
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Split a saved booking into per-supplier orders and insert them.
 * Called right after the booking itself is saved at checkout.
 */
export async function createOrdersForBooking(booking: SavedBooking): Promise<void> {
  const shared = {
    bookingId: booking.id,
    reference: booking.reference,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    specialRequests: booking.specialRequests,
    guests: booking.guests,
  }

  // Group addon items by supplier
  const bySupplier = new Map<string, OrderItem[]>()
  for (const a of booking.addons) {
    if (!a.supplierId || !UUID_RE.test(a.supplierId)) continue
    const item: OrderItem = {
      id: a.id,
      type: a.type,
      title: a.title,
      date: a.date,
      guests: a.guests,
      unitPrice: a.price_per_person,
      total: a.price_per_person * a.guests,
      ...(a.activityId && a.timeslotId ? { activityId: a.activityId, timeslotId: a.timeslotId } : {}),
    }
    bySupplier.set(a.supplierId, [...(bySupplier.get(a.supplierId) ?? []), item])
  }

  const rows: Array<Record<string, unknown>> = []

  for (const [supplierId, items] of bySupplier) {
    const orderTotal = items.reduce((s, i) => s + i.total, 0)
    rows.push({
      id: `ord-${crypto.randomUUID()}`,
      booking_id: booking.id,
      reference: booking.reference,
      supplier_id: supplierId,
      user_id: booking.userId,
      status: booking.status,
      value: { ...shared, items, orderTotal },
    })
  }

  // Stay → its own order for the property owner (dates + nights included)
  if (booking.stay?.id?.startsWith('prop-')) {
    try {
      const prop = await getPropertyById(booking.stay.id)
      if (prop?.supplierId && UUID_RE.test(prop.supplierId)) {
        const total = booking.stay.price_per_night * booking.nights
        rows.push({
          id: `ord-${crypto.randomUUID()}`,
          booking_id: booking.id,
          reference: booking.reference,
          supplier_id: prop.supplierId,
          user_id: booking.userId,
          status: booking.status,
          value: {
            ...shared,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            nights: booking.nights,
            items: [{
              id: booking.stay.id,
              type: 'stay',
              title: booking.stay.roomName ? `${booking.stay.title} — ${booking.stay.roomName}` : booking.stay.title,
              roomId: booking.stay.roomId,
              guests: booking.guests,
              unitPrice: booking.stay.price_per_night,
              total,
            }],
            orderTotal: total,
          },
        })
      }
    } catch {}
  }

  if (rows.length === 0) return
  const { error } = await supabase.from('vd_booking_orders').insert(rows)
  if (error) throw error
}

/**
 * Orders for the supplier whose portal this is.
 *
 * WHY THE EXPLICIT FILTER — IT USED TO SAY "RLS SCOPES ROWS AUTOMATICALLY"
 *   That was true of a supplier and false of an operations employee, and the
 *   difference produced a reported "data breach" that wasn't one.
 *   20260902_stay_booking_requests.sql added:
 *
 *     create policy "Managed ops agents read booking orders"
 *       for select using (is_managed_supplier(supplier_id)
 *                         and has_supplier_permission(supplier_id, 'view_bookings'));
 *
 *   so this unfiltered query returned the UNION of every supplier that
 *   employee manages — and /supplier rendered that union under whichever
 *   supplier's name the console said it had entered. Two different managed
 *   suppliers showed identical dashboards.
 *
 *   No RLS change fixes that, because RLS is answering the question it was
 *   asked ("may this caller see this row?") correctly. The query simply has to
 *   say WHICH supplier it means. supabase/tests/cross_supplier_isolation_test
 *   .sql pins both halves down: no supplier can ever see another's rows, and
 *   filtering by the effective id is what makes the employee's view right.
 */
export async function getMyOrders(): Promise<SupplierOrder[]> {
  try {
    const supplierId = await getEffectiveSupplierId()
    if (!supplierId) return []
    const { data } = await supabase
      .from('vd_booking_orders')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return (data as Row[]).map(rowToOrder)
  } catch {}
  return []
}

/** Supplier cancels their portion of a booking; guest is notified. */
export async function cancelOrderAsSupplier(order: SupplierOrder): Promise<void> {
  const { error } = await supabase
    .from('vd_booking_orders')
    .update({ status: 'cancelled' })
    .eq('id', order.id)
  if (error) throw error
  await notify(order.userId, 'cancellation',
    `Service cancelled — ${order.reference}`,
    `${order.items.map(i => i.title).join(', ')} has been cancelled by the provider. If you were charged, a refund will follow within 5 business days. The rest of your itinerary is unaffected.`,
    '/account')
}

/** Cancel all orders belonging to a booking (visitor cancels the trip). */
export async function cancelOrdersForBooking(bookingId: string): Promise<void> {
  try {
    await supabase
      .from('vd_booking_orders')
      .update({ status: 'cancelled' })
      .eq('booking_id', bookingId)
  } catch {}
}

import { supabase } from './auth'
import type { BookingAddon, BookingStay, ShuttleOption } from './booking-context'
import { getPropertyById } from './properties'
import { notify } from './notifications'
import { createOrdersForBooking, cancelOrdersForBooking } from './booking-orders'
import { createOrderForBooking, cancelOrderForBooking } from './orders'
import { createTransportRequestForBooking } from './transport-dispatch'

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
  status: 'pending' | 'confirmed' | 'cancelled'
  createdAt: string
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
  return {
    ...(r.value as unknown as SavedBooking),
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
  // items and the guest details needed to deliver the service.
  try {
    await createOrdersForBooking(newBooking)
  } catch (err) {
    console.error('Order fan-out failed (booking saved):', err)
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
  try {
    await createTransportRequestForBooking(newBooking)
  } catch (err) {
    console.error('Transport request creation failed (booking saved):', err)
  }

  // Tell each involved supplier a new order arrived — no itinerary details
  // beyond their own service in the notification.
  await Promise.all(supplierIds.map(sid =>
    notify(sid, 'booking', `New booking ${newBooking.reference}`,
      `${newBooking.customerName} booked with you (${newBooking.guests} guest${newBooking.guests !== 1 ? 's' : ''}). Open your bookings for details.`,
      '/supplier/bookings')
  ))

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

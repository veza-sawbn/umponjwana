import { supabase } from './auth'
import type { BookingAddon, BookingStay, ShuttleOption } from './booking-context'
import { getPropertyById } from './properties'
import { notify } from './notifications'

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
  shuttle: ShuttleOption | null
  subtotal: number
  serviceFee: number
  vat: number
  total: number
  status: 'confirmed' | 'cancelled'
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

export async function addBooking(booking: Omit<SavedBooking, 'id' | 'reference' | 'createdAt'>): Promise<SavedBooking> {
  const supplierIds = await collectSupplierIds(booking)
  const newBooking: SavedBooking = {
    ...booking,
    id: `bk-${crypto.randomUUID()}`,
    reference: genRef(),
    createdAt: new Date().toISOString(),
  }

  // Retry once with a fresh reference on the (rare) unique-constraint hit.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.from('vd_bookings').insert({
      id: newBooking.id,
      reference: newBooking.reference,
      user_id: newBooking.userId,
      supplier_ids: supplierIds,
      status: newBooking.status,
      value: newBooking,
    })
    if (!error) break
    if (error.code === '23505' && attempt === 0) {
      newBooking.reference = genRef()
      continue
    }
    throw error
  }

  // Tell every involved supplier about the new booking.
  const summary = [
    newBooking.stay ? `Stay: ${newBooking.stay.title}` : null,
    newBooking.addons.length ? `${newBooking.addons.length} activity/tour item(s)` : null,
    newBooking.checkIn ? `${newBooking.checkIn} → ${newBooking.checkOut}` : null,
  ].filter(Boolean).join(' · ')
  await Promise.all(supplierIds.map(sid =>
    notify(sid, 'booking', `New booking ${newBooking.reference}`,
      `${newBooking.customerName} booked. ${summary}`, '/supplier/bookings')
  ))

  return newBooking
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
  status: 'confirmed' | 'cancelled',
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

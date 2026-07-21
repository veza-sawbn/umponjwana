import { getOrders, type MasterOrder } from './orders'
import { getBookings, type SavedBooking } from './bookings'

/* ────────────────────────────────────────────────────────────────────────────
 * Communications Hub — customer CRM aggregation.
 *
 * Builds a single customer view from the platform's existing modules
 * (Master Orders + Bookings) keyed by email, so the conversation workspace
 * can show trip history, lifetime spend, outstanding balance and contact
 * details alongside the chat without a separate CRM table. Data stays bound
 * to its live source — this is a read-only projection, not a copy.
 * ──────────────────────────────────────────────────────────────────────────── */

export type CustomerTrip = {
  orderId: string | null
  orderNumber: string
  bookingRef: string
  tripName: string
  destination: string
  status: string
  paymentStatus: string
  total: number
  paid: number
  outstanding: number
  travelStart: string | null
  travelEnd: string | null
  createdAt: string
}

export type CustomerProfile = {
  email: string
  name: string
  phones: string[]
  emails: string[]
  regionsVisited: string[]
  tripCount: number
  lifetimeSpend: number
  totalPaid: number
  outstandingBalance: number
  firstSeen: string | null
  lastActivity: string | null
  trips: CustomerTrip[]
  /** true when no order/booking exists yet — a pure lead. */
  isLead: boolean
}

const money = (n: unknown) => (typeof n === 'number' && isFinite(n) ? n : 0)

function eq(a?: string, b?: string) {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Aggregate everything we know about a customer by email (falling back to
 *  name when email is missing, e.g. walk-in enquiries). */
export async function buildCustomerProfile(
  email: string,
  fallbackName?: string,
  fallbackPhone?: string,
): Promise<CustomerProfile> {
  const [orders, bookings] = await Promise.all([
    getOrders().catch(() => [] as MasterOrder[]),
    getBookings().catch(() => [] as SavedBooking[]),
  ])

  const myOrders = orders.filter(o => eq(o.customer_email, email))
  const myBookings = bookings.filter(b => eq(b.customerEmail, email))

  const phones = new Set<string>()
  const emails = new Set<string>()
  const regions = new Set<string>()
  if (fallbackPhone) phones.add(fallbackPhone)
  if (email) emails.add(email)
  myBookings.forEach(b => { if (b.customerPhone) phones.add(b.customerPhone); if (b.region) regions.add(b.region) })
  myOrders.forEach(o => { if (o.destination) regions.add(o.destination) })

  // Trips: prefer orders (they carry financial truth); add bookings that have
  // no matching order so nothing is lost.
  const trips: CustomerTrip[] = myOrders.map(o => ({
    orderId: o.id,
    orderNumber: o.order_number,
    bookingRef: (o.value as any)?.bookingRef ?? o.booking_id ?? '—',
    tripName: o.trip_name || 'Trip',
    destination: o.destination || '',
    status: o.trip_status || o.booking_status || 'open',
    paymentStatus: o.payment_status || 'unpaid',
    total: money(o.total_value),
    paid: money(o.amount_paid),
    outstanding: money(o.outstanding_balance),
    travelStart: o.travel_start,
    travelEnd: o.travel_end,
    createdAt: o.created_at,
  }))

  const orderBookingIds = new Set(myOrders.map(o => o.booking_id).filter(Boolean))
  for (const b of myBookings) {
    if (orderBookingIds.has(b.id)) continue
    trips.push({
      orderId: null,
      orderNumber: '—',
      bookingRef: b.reference,
      tripName: b.stay?.title || b.region || 'Trip',
      destination: b.region || '',
      status: b.status,
      paymentStatus: b.status === 'confirmed' ? 'paid' : 'unpaid',
      total: money(b.total),
      paid: b.status === 'confirmed' ? money(b.total) : 0,
      outstanding: b.status === 'confirmed' ? 0 : money(b.total),
      travelStart: b.checkIn || null,
      travelEnd: b.checkOut || null,
      createdAt: b.createdAt,
    })
  }

  trips.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  const lifetimeSpend = trips.reduce((s, t) => s + t.total, 0)
  const totalPaid = trips.reduce((s, t) => s + t.paid, 0)
  const outstandingBalance = trips.reduce((s, t) => s + t.outstanding, 0)
  const dates = trips.map(t => t.createdAt).filter(Boolean).sort()
  const name = fallbackName || myOrders[0]?.customer_name || myBookings[0]?.customerName || email || 'Customer'

  return {
    email,
    name,
    phones: [...phones],
    emails: [...emails],
    regionsVisited: [...regions],
    tripCount: trips.length,
    lifetimeSpend,
    totalPaid,
    outstandingBalance,
    firstSeen: dates[0] ?? null,
    lastActivity: dates[dates.length - 1] ?? null,
    trips,
    isLead: trips.length === 0,
  }
}

import { supabase } from './auth'
import { notify } from './notifications'
import type { MarketplacePackage } from './packages'
import type { SavedBooking } from './bookings'
import { createOrder, type OrderLineInput } from './orders'

// Package booking workflow: the customer completes ONE booking; the platform
// creates the master booking (vd_bookings) and automatically fans it out into
// per-supplier fulfilment records (vd_booking_orders). Each supplier receives
// only their assigned services, the customer contact details, the dates and
// the operational notes — never the whole itinerary or the platform margin.

export type PackageBookingInput = {
  pkg: MarketplacePackage
  userId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  specialRequests: string
  startDate: string
  guests: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function genRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `DPK-${part}-KZN`
}

function addDays(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function bookPackage(input: PackageBookingInput): Promise<SavedBooking> {
  const { pkg, guests } = input
  const endDate = addDays(input.startDate, pkg.durationNights)
  const subtotal = pkg.pricePerPerson * guests
  const serviceFee = Math.round(subtotal * 0.03)
  const vat = Math.round((subtotal + serviceFee) * 0.15)

  // Master booking — shaped like a SavedBooking so /account and the admin
  // bookings console render it without special-casing.
  const booking: SavedBooking & { packageId: string; fulfilment: Array<{ supplierId: string; supplierName: string; service: string; status: string }> } = {
    id: `bk-${crypto.randomUUID()}`,
    reference: genRef(),
    userId: input.userId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    specialRequests: input.specialRequests,
    region: pkg.region,
    checkIn: input.startDate,
    checkOut: endDate,
    nights: pkg.durationNights,
    guests,
    stay: null,
    addons: [{
      id: pkg.id,
      type: 'tour',
      title: `Package — ${pkg.title}`,
      date: input.startDate,
      price_per_person: pkg.pricePerPerson,
      guests,
    }],
    shuttle: null,
    subtotal,
    serviceFee,
    vat,
    total: subtotal + serviceFee + vat,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    packageId: pkg.id,
    fulfilment: pkg.components.map(c => ({
      supplierId: c.supplierId,
      supplierName: c.supplierName,
      service: c.title,
      status: UUID_RE.test(c.supplierId) ? 'pending_confirmation' : 'manual',
    })),
  }

  const supplierIds = [...new Set(pkg.components.map(c => c.supplierId).filter(id => UUID_RE.test(id)))]

  const { error } = await supabase.from('vd_bookings').insert({
    id: booking.id,
    reference: booking.reference,
    user_id: booking.userId,
    supplier_ids: supplierIds,
    status: booking.status,
    value: booking,
  })
  if (error) throw new Error(error.message || 'Package booking failed')

  // Supplier fulfilment records: one order per supplier, containing only
  // that supplier's assigned components (at cost price — the platform margin
  // is not disclosed to suppliers).
  const rows: Array<Record<string, unknown>> = []
  for (const supplierId of supplierIds) {
    const components = pkg.components.filter(c => c.supplierId === supplierId)
    const items = components.map(c => ({
      id: c.id,
      type: c.type === 'accommodation' ? 'stay' : c.type === 'activity' ? 'activity' : 'tour',
      title: c.title,
      date: input.startDate,
      guests,
      unitPrice: c.costPrice,
      total: c.costPrice,
    }))
    rows.push({
      id: `ord-${crypto.randomUUID()}`,
      booking_id: booking.id,
      reference: booking.reference,
      supplier_id: supplierId,
      user_id: booking.userId,
      status: 'confirmed',
      value: {
        bookingId: booking.id,
        reference: booking.reference,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        specialRequests: [
          booking.specialRequests,
          ...components.map(c => (c.notes ? `${c.title}: ${c.notes}` : '')),
        ].filter(Boolean).join(' · '),
        guests,
        checkIn: input.startDate,
        checkOut: endDate,
        nights: pkg.durationNights,
        items,
        orderTotal: items.reduce((s, i) => s + i.total, 0),
        packageTitle: pkg.title,
      },
    })
  }
  if (rows.length > 0) {
    const { error: orderError } = await supabase.from('vd_booking_orders').insert(rows)
    if (orderError) console.error('Fulfilment fan-out failed (booking saved):', orderError)
  }

  // Master Order: per-supplier allocation at cost price (commission 0 — the
  // platform margin is the difference between sell and cost, carried by a
  // platform-owned packaging line). The customer's invoice shows a single
  // package line at the sell price, so the internal cost structure is never
  // exposed on customer documents.
  try {
    const componentCost = pkg.components.reduce((s, c) => s + (c.costPrice || 0), 0)
    const orderLines: OrderLineInput[] = pkg.components.map(c => ({
      supplierId: UUID_RE.test(c.supplierId) ? c.supplierId : null,
      supplierName: c.supplierName,
      category: c.type === 'accommodation' ? 'accommodation' : c.type === 'activity' ? 'activity' : 'package',
      productId: c.id,
      title: `${pkg.title} — ${c.title}`,
      serviceDate: input.startDate,
      endDate,
      guests,
      quantity: 1,
      unitLabel: 'service',
      unitPrice: c.costPrice || 0,
      grossAmount: c.costPrice || 0,
      commissionRate: 0,
    }))
    if (subtotal - componentCost !== 0) {
      orderLines.push({
        supplierName: 'Visit Drakensberg',
        category: 'package',
        productId: pkg.id,
        title: `${pkg.title} — packaging & coordination`,
        serviceDate: input.startDate,
        endDate,
        quantity: 1,
        unitLabel: 'package',
        unitPrice: subtotal - componentCost,
        grossAmount: subtotal - componentCost,
      })
    }
    await createOrder(
      {
        bookingId: booking.id,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        tripName: `Package — ${pkg.title}`,
        travelStart: input.startDate,
        travelEnd: endDate,
        subtotal,
        serviceFee,
        taxAmount: vat,
        total: booking.total,
        value: { reference: booking.reference, packageId: pkg.id, guests },
      },
      orderLines,
      {
        invoiceLines: [{
          title: `Package — ${pkg.title} (${guests} guest${guests !== 1 ? 's' : ''})`,
          category: 'package',
          quantity: guests,
          unitLabel: 'guest',
          unitPrice: pkg.pricePerPerson,
          total: subtotal,
        }],
        payment: { amount: booking.total, type: 'payment', method: 'card', reference: booking.reference },
      },
    )
  } catch (err) {
    console.error('Master order creation failed (package booking saved):', err)
  }

  // Each supplier is asked to confirm availability for their service.
  await Promise.all(supplierIds.map(sid =>
    notify(sid, 'booking', `Package booking ${booking.reference}`,
      `${booking.customerName} booked "${pkg.title}" (${guests} guest${guests !== 1 ? 's' : ''}, ${input.startDate} → ${endDate}). Please confirm availability for your assigned services in your bookings.`,
      '/supplier/bookings')
  ))

  return booking
}

import { supabase } from './auth'
import { notify } from './notifications'
import { resolveItinerary, type Tour } from './tours'
import type { Departure } from './departures'
import type { Trail } from './trails'
import type { TripRequest } from './custom-trips'
import { resolveLivePackages } from '@/components/tours/PackageEditor'

// The itinerary a guest sees for one booked tour/hike — and the operator's
// own edits to it (vd_booking_itineraries, see
// supabase/migrations/20261007_booking_itineraries.sql).
//
// Three screens show this itinerary: the guest's /account/itinerary, the
// printable /itinerary/[id]/print, and the operator's /supplier/bookings.
// They all resolve it here so the operator is looking at exactly what the
// guest is shown.

/** One day of the itinerary as the guest sees it. */
export type ItineraryDay = {
  /** Calendar date (YYYY-MM-DD). Empty when the booking carries no date. */
  date: string
  label: string
  description?: string
  accommodation?: string
  transport?: string
  meals?: string
}

/** The operator's itinerary for one booked item. Replaces the computed plan. */
export type BookingItinerary = {
  bookingId: string
  itemId: string
  supplierId: string
  days: ItineraryDay[]
  meetingPoint?: string
  meetingTime?: string
  guide?: string
  /** A note shown to the guest above the day-by-day plan. */
  notes?: string
  updatedAt: string
  updatedByName?: string
}

/** The minimal shape of a booked item both BookingAddon and OrderItem satisfy. */
export type ItineraryItem = {
  id: string
  title: string
  date?: string
  operator?: string
  supplierId?: string
  packageId?: string
}

export type ResolvedItinerary = {
  departure: Departure | null
  tour: Tour | null
  trail: Trail | null
  packageName?: string
  /** The catalog plan, dated. [] when nothing is authored for this item. */
  days: ItineraryDay[]
}

const TRIP_REQUEST_PREFIX = 'trip-request-'

/** The vd_trip_requests id behind a private-trip line item, if it is one. */
export function tripRequestIdForItem(itemId: string): string | null {
  return itemId.startsWith(TRIP_REQUEST_PREFIX) ? itemId.slice(TRIP_REQUEST_PREFIX.length) : null
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The catalog itinerary for one booked item: departure → tour → trail,
 * narrowed by the rate package the guest booked. A private trip request has
 * no departure; it resolves through the request's own trail and operator.
 */
export function resolveDefaultItinerary(
  item: ItineraryItem,
  ctx: { departures: Departure[]; tours: Tour[]; trails: Trail[]; tripRequest?: TripRequest | null },
): ResolvedItinerary {
  const { departures, tours, trails, tripRequest } = ctx
  let departure: Departure | null = null
  let tour: Tour | null = null
  let trail: Trail | null = null

  if (tripRequestIdForItem(item.id)) {
    if (tripRequest) {
      trail = trails.find(t => t.id === tripRequest.trailId) ?? null
      tour = tours.find(t => t.trailId === tripRequest.trailId && t.supplierId === tripRequest.operatorId) ?? null
    }
  } else {
    departure = departures.find(d => d.id === item.id) ?? null
    if (departure) {
      tour = tours.find(t => t.id === departure!.tourId) ?? null
    } else {
      // Legacy bookings with no departure link: match by name, or by the
      // operator only when they run a single tour. "Any tour by this
      // operator" showed guests the wrong tour's plan.
      tour = tours.find(t => t.name === item.title) ?? null
      if (!tour && item.operator) {
        const theirs = tours.filter(t => t.supplierName === item.operator)
        if (theirs.length === 1) tour = theirs[0]
      }
    }
    if (tour) trail = trails.find(t => t.id === (departure?.trailId || tour!.trailId)) ?? null
  }

  const pkg = departure?.packages
    ? resolveLivePackages(departure.packages, tour ?? undefined).find(p => p.id === item.packageId)
    : undefined
  const composed = resolveItinerary(trail?.days, tour?.pricingTiers, pkg)
  const days = composed.map(d => ({
    date: item.date ? addDaysIso(item.date, d.dateOffset) : '',
    label: d.label,
    description: d.description,
    accommodation: d.accommodation,
    transport: d.transport,
    meals: d.meals,
  }))
  return { departure, tour, trail, packageName: pkg?.name, days }
}

/** A day title worth showing — not one that just repeats "Day 2". */
export function meaningfulDayLabel(label: string | undefined): string {
  return label && !/^\s*day\s*\d+\s*$/i.test(label) ? label : ''
}

/** What the guest actually sees: the operator's version when there is one. */
export function effectiveItineraryDays(resolved: ResolvedItinerary, override?: BookingItinerary | null): ItineraryDay[] {
  return override && override.days.length > 0 ? override.days : resolved.days
}

type Row = {
  booking_id: string
  item_id: string
  supplier_id: string
  value: Record<string, unknown>
  updated_at: string
}

function rowToItinerary(r: Row): BookingItinerary {
  const v = r.value as Partial<BookingItinerary>
  return {
    ...v,
    days: Array.isArray(v.days) ? v.days : [],
    bookingId: r.booking_id,
    itemId: r.item_id,
    supplierId: r.supplier_id,
    updatedAt: r.updated_at,
  }
}

/** Operator itineraries on one booking. RLS scopes to the guest or the supplier. */
export async function getBookingItineraries(bookingId: string): Promise<BookingItinerary[]> {
  try {
    const { data } = await supabase.from('vd_booking_itineraries').select('*').eq('booking_id', bookingId)
    if (Array.isArray(data)) return (data as Row[]).map(rowToItinerary)
  } catch {}
  return []
}

/**
 * The booked item's date and package, read for the supplier who delivers it
 * (vd_supplier_booking_item). Supplier orders don't carry the package, and
 * the supplier can't read the guest's booking, so this is how the portal
 * computes the same plan the guest sees.
 */
export async function getSupplierBookingItem(bookingId: string, itemId: string): Promise<Partial<ItineraryItem> | null> {
  try {
    const { data } = await supabase.rpc('vd_supplier_booking_item', { p_booking_id: bookingId, p_item_id: itemId })
    return (data as Partial<ItineraryItem> | null) ?? null
  } catch {
    return null
  }
}

/** Save the operator's itinerary for one booked item and tell the guest. */
export async function saveBookingItinerary(
  itinerary: Omit<BookingItinerary, 'updatedAt'>,
  guest: { userId: string; reference: string; serviceTitle: string },
): Promise<BookingItinerary> {
  const updatedAt = new Date().toISOString()
  const days = itinerary.days
    .map(d => ({ ...d, label: d.label.trim() }))
    .filter(d => d.label || d.description?.trim())
  const value = { ...itinerary, days, updatedAt }
  const { error } = await supabase.from('vd_booking_itineraries').upsert({
    booking_id: itinerary.bookingId,
    item_id: itinerary.itemId,
    supplier_id: itinerary.supplierId,
    value,
    updated_at: updatedAt,
  }, { onConflict: 'booking_id,item_id' })
  if (error) throw new Error(error.message || 'Could not save the itinerary')

  await notify(guest.userId, 'booking',
    `Itinerary updated — ${guest.reference}`,
    `Your operator updated the itinerary for ${guest.serviceTitle}. Please review the latest day-by-day plan.`,
    `/account/itinerary?id=${encodeURIComponent(itinerary.bookingId)}`)
  return value
}

/** Drop the operator's version; the guest sees the catalog plan again. */
export async function resetBookingItinerary(bookingId: string, itemId: string): Promise<void> {
  const { error } = await supabase.from('vd_booking_itineraries').delete()
    .eq('booking_id', bookingId).eq('item_id', itemId)
  if (error) throw new Error(error.message || 'Could not reset the itinerary')
}

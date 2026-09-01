import { supabase } from './auth'
import { notify } from './notifications'
import { formatMoney } from './allocation'
import { addBooking, updateBookingStatus } from './bookings'

// Custom-date private trip requests (vd_trip_requests — see
// supabase/migrations/20260707_marketplace.sql). A visitor requests a private
// departure on a hiking trail; the tour operator first confirms the guide's
// availability, then gives operational approval and issues a quote; the
// visitor accepts the quote and pays. Never an instant booking.
//
// Accepting a quote stands up a real vd_bookings row (+ Master Order +
// Invoice) via the same pipeline checkout uses — held 'pending' until iKhokha
// actually confirms a payment. That booking is what /account shows under
// "upcoming trips" and what the customer pays via the real payment gateway;
// this file never marks a request paid itself (see the iKhokha webhook,
// which is the only place vd_bookings — and, through it, this request — is
// ever flipped to 'confirmed').

export type TripRequestStatus =
  | 'draft'
  | 'pending_guide'
  | 'pending_operator'
  | 'quote_ready'
  | 'awaiting_payment'
  | 'confirmed'
  | 'cancelled'
  | 'rejected'

export const TRIP_STATUS_LABELS: Record<TripRequestStatus, string> = {
  draft: 'Draft',
  pending_guide: 'Pending Guide Approval',
  pending_operator: 'Pending Operator Approval',
  quote_ready: 'Quote Ready',
  awaiting_payment: 'Awaiting Payment',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
}

export type TripQuote = {
  pricePerPerson: number
  total: number
  notes: string
  validUntil: string
  // Operators may respond with alternatives instead of a plain approval.
  alternativeStartDate?: string
  alternativeEndDate?: string
  alternativeGuide?: string
  alternativeItinerary?: string
}

export type TripTimelineEntry = {
  at: string
  status: TripRequestStatus
  note?: string
}

export type TripRequest = {
  id: string
  reference: string
  userId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  trailId: string
  trailName: string
  region: string
  startDate: string
  endDate: string
  groupSize: number
  preferredGuideId: string
  preferredGuideName: string
  specialRequests: string
  operatorId: string | null   // auth uuid of the tour operator (null → unassigned, admin routes it)
  operatorName: string
  guideApprovedAt?: string
  operatorApprovedAt?: string
  quote?: TripQuote
  /** The real vd_bookings row this request is paid against, created when the
   *  quote is accepted (see acceptQuote()). Absent for a request still short
   *  of that step, or one accepted before this booking pipeline existed. */
  bookingId?: string
  invoiceId?: string
  timeline: TripTimelineEntry[]
  status: TripRequestStatus
  createdAt: string
}

type Row = {
  id: string
  user_id: string
  operator_id: string | null
  trail_id: string
  status: string
  value: Record<string, unknown>
  created_at: string
}

function rowToRequest(r: Row): TripRequest {
  return {
    ...(r.value as unknown as TripRequest),
    id: r.id,
    userId: r.user_id,
    operatorId: r.operator_id,
    trailId: r.trail_id,
    status: (r.status as TripRequestStatus) || 'draft',
    createdAt: r.created_at,
  }
}

function genRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `TRQ-${part}`
}

export async function createTripRequest(
  req: Omit<TripRequest, 'id' | 'reference' | 'timeline' | 'status' | 'createdAt'>,
): Promise<TripRequest> {
  const now = new Date().toISOString()
  const request: TripRequest = {
    ...req,
    id: `trq-${crypto.randomUUID()}`,
    reference: genRef(),
    status: 'pending_guide',
    timeline: [{ at: now, status: 'pending_guide', note: 'Request submitted' }],
    createdAt: now,
  }
  const { error } = await supabase.from('vd_trip_requests').insert({
    id: request.id,
    user_id: request.userId,
    operator_id: request.operatorId,
    trail_id: request.trailId,
    status: request.status,
    value: request,
  })
  if (error) throw new Error(error.message || 'Could not submit the request')

  if (request.operatorId) {
    await notify(request.operatorId, 'approval',
      `Custom trip request ${request.reference}`,
      `${request.customerName} requested a private ${request.trailName} trip (${request.groupSize} guest${request.groupSize !== 1 ? 's' : ''}, ${request.startDate} → ${request.endDate})${request.preferredGuideName ? ` with ${request.preferredGuideName}` : ''}. Guide availability approval needed.`,
      '/supplier/requests')
  }
  return request
}

// RLS scopes rows automatically: visitors see their own requests, operators
// see requests assigned to them, admins see everything.
export async function getTripRequests(): Promise<TripRequest[]> {
  try {
    const { data } = await supabase
      .from('vd_trip_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return (data as Row[]).map(rowToRequest)
  } catch {}
  return []
}

export async function getTripRequestById(id: string): Promise<TripRequest | null> {
  try {
    const { data } = await supabase.from('vd_trip_requests').select('*').eq('id', id).maybeSingle()
    if (data) return rowToRequest(data as Row)
  } catch {}
  return null
}

async function saveTransition(
  request: TripRequest,
  status: TripRequestStatus,
  patch: Partial<TripRequest>,
  note?: string,
): Promise<TripRequest> {
  const updated: TripRequest = {
    ...request,
    ...patch,
    status,
    timeline: [...(request.timeline ?? []), { at: new Date().toISOString(), status, note }],
  }
  const { error } = await supabase
    .from('vd_trip_requests')
    .update({ status, value: updated, updated_at: new Date().toISOString() })
    .eq('id', request.id)
  if (error) throw new Error(error.message || 'Could not update the request')
  return updated
}

/** Operator step 1: confirm the guide is available on the requested dates. */
export async function approveGuideAvailability(request: TripRequest, guideName: string): Promise<TripRequest> {
  const updated = await saveTransition(request, 'pending_operator',
    { guideApprovedAt: new Date().toISOString(), preferredGuideName: guideName || request.preferredGuideName },
    `Guide availability confirmed${guideName ? ` — ${guideName}` : ''}`)
  await notify(request.userId, 'approval',
    `Guide confirmed — ${request.reference}`,
    `${guideName || 'A guide'} is available for your ${request.trailName} trip. Operational approval is next.`,
    '/account/requests')
  return updated
}

/** Operator step 2: operational approval + quote (may carry alternatives). */
export async function issueQuote(request: TripRequest, quote: TripQuote): Promise<TripRequest> {
  const updated = await saveTransition(request, 'quote_ready',
    { operatorApprovedAt: new Date().toISOString(), quote },
    'Operational approval — quote issued')
  await notify(request.userId, 'approval',
    `Quote ready — ${request.reference}`,
    `${request.operatorName || 'The operator'} approved your ${request.trailName} trip and sent a quote of ${formatMoney(quote.total)}.`,
    '/account/requests')
  return updated
}

/** Operator declines the request at either approval step. */
export async function rejectTripRequest(request: TripRequest, reason: string): Promise<TripRequest> {
  const updated = await saveTransition(request, 'rejected', {}, reason || 'Request declined')
  await notify(request.userId, 'info',
    `Request declined — ${request.reference}`,
    reason || `${request.operatorName || 'The operator'} cannot accommodate your ${request.trailName} trip on these dates.`,
    '/account/requests')
  return updated
}

/**
 * Customer accepts the quote → payment step. This is the moment a real
 * financial object comes into existence: a vd_bookings row (held 'pending'),
 * fanned out into per-supplier orders, and a Master Order + Invoice — the
 * exact pipeline checkout uses (see lib/bookings.ts addBooking()). There is
 * no inventory to reserve here (a guide's own availability was already
 * confirmed in the earlier approval step), so this never fails on a "sold
 * out" race the way a room or seat booking can.
 *
 * The trip request itself only stores the resulting bookingId/invoiceId —
 * paying, and confirming payment, both happen against that booking from here
 * on (see handlePay() in app/account/requests/page.tsx and the iKhokha
 * webhook, which is the only place this ever reaches 'confirmed').
 */
export async function acceptQuote(request: TripRequest): Promise<TripRequest> {
  if (!request.quote) throw new Error('This request has no quote to accept yet.')

  const { booking, invoiceId } = await addBooking({
    userId: request.userId,
    customerName: request.customerName,
    customerEmail: request.customerEmail,
    customerPhone: request.customerPhone,
    specialRequests: request.specialRequests,
    region: request.region,
    checkIn: request.startDate,
    checkOut: request.endDate,
    nights: 0,
    guests: request.groupSize,
    stay: null,
    addons: [{
      // Deliberately not request.trailId: that id belongs to a Trail entity,
      // not a bookable Departure, and vd_create_order re-prices a 'hike'/
      // 'tour' line from a matching Departure's own listed price when the
      // productId happens to resolve to one. This quote's negotiated total
      // must never be overwritten by the trail's default listed price.
      id: `trip-request-${request.id}`,
      type: 'hike',
      title: `Private trip — ${request.trailName}`,
      operator: request.operatorName,
      supplierId: request.operatorId ?? undefined,
      date: request.startDate,
      price_per_person: request.quote.pricePerPerson,
      guests: request.groupSize,
    }],
    shuttles: [],
    subtotal: request.quote.total,
    serviceFee: 0,
    vat: 0,
    total: request.quote.total,
    status: 'pending',
    // Carried through to the iKhokha webhook (no browser session there) so
    // it can flip this request to 'confirmed' alongside the booking once
    // payment actually clears.
    tripRequestId: request.id,
  })

  const updated = await saveTransition(request, 'awaiting_payment',
    { bookingId: booking.id, invoiceId: invoiceId ?? undefined },
    'Quote accepted by customer')
  if (request.operatorId) {
    await notify(request.operatorId, 'approval',
      `Quote accepted — ${request.reference}`,
      `${request.customerName} accepted the quote for their ${request.trailName} trip (${request.startDate} → ${request.endDate}). Awaiting payment.`,
      '/supplier/requests')
  }
  return updated
}

/** Customer withdraws the request. */
export async function cancelTripRequest(request: TripRequest): Promise<TripRequest> {
  const updated = await saveTransition(request, 'cancelled', {}, 'Cancelled by customer')
  // A quote already accepted stood up a real booking/order — cancel that
  // financial side too (reverses the ledger, releases the Master Order).
  // Suppliers aren't double-notified: this function tells the operator
  // itself, right below.
  if (request.bookingId) {
    await updateBookingStatus(request.bookingId, 'cancelled', { notifySuppliers: false }).catch(() => {})
  }
  if (request.operatorId) {
    await notify(request.operatorId, 'cancellation',
      `Request cancelled — ${request.reference}`,
      `${request.customerName} withdrew their custom trip request for ${request.trailName}.`,
      '/supplier/requests')
  }
  return updated
}

/**
 * Guide availability check used before approval: the guide must have no
 * blocked dates and no other confirmed/pending trip overlapping the window.
 */
export function isGuideAvailable(
  guide: { name: string; blocked?: string[] },
  startDate: string,
  endDate: string,
  requests: TripRequest[],
): boolean {
  for (const day of guide.blocked ?? []) {
    if (day >= startDate && day <= endDate) return false
  }
  return !requests.some(r =>
    r.preferredGuideName === guide.name &&
    ['pending_operator', 'quote_ready', 'awaiting_payment', 'confirmed'].includes(r.status) &&
    r.startDate <= endDate && r.endDate >= startDate,
  )
}

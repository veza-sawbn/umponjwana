import { supabase } from './auth'
import { notify } from './notifications'

// Custom-date private trip requests (vd_trip_requests — see
// supabase/migrations/20260707_marketplace.sql). A visitor requests a private
// departure on a hiking trail; the tour operator first confirms the guide's
// availability, then gives operational approval and issues a quote; the
// visitor accepts the quote and pays. Never an instant booking.

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
    `${request.operatorName || 'The operator'} approved your ${request.trailName} trip and sent a quote of R ${quote.total.toLocaleString()}.`,
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

/** Customer accepts the quote → payment step. */
export async function acceptQuote(request: TripRequest): Promise<TripRequest> {
  return saveTransition(request, 'awaiting_payment', {}, 'Quote accepted by customer')
}

/** Customer pays → booking confirmed; operator is notified. */
export async function confirmTripPayment(request: TripRequest): Promise<TripRequest> {
  const updated = await saveTransition(request, 'confirmed', {}, 'Payment received — booking confirmed')
  if (request.operatorId) {
    await notify(request.operatorId, 'booking',
      `Custom trip confirmed — ${request.reference}`,
      `${request.customerName} paid for the private ${request.trailName} trip (${request.startDate} → ${request.endDate}).`,
      '/supplier/requests')
  }
  return updated
}

/** Customer withdraws the request. */
export async function cancelTripRequest(request: TripRequest): Promise<TripRequest> {
  const updated = await saveTransition(request, 'cancelled', {}, 'Cancelled by customer')
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

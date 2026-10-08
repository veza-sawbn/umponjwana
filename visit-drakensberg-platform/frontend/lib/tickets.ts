import { supabase } from './auth'
import { getEffectiveSupplierId } from './effective-supplier'

// Individual issued tickets — for a supplier_events session/tier, or for a
// seat on one departure of a timeslotted activity (a Grand Tour day tour's
// bus, lib/grand-tour.ts). See supabase/migrations/20261008_event_ticketing.sql
// and 20261008_grand_tour_boarding.sql for the vd_tickets table and the
// issue/release/redeem RPCs this wraps. Unlike vd_entities, minting and redeeming a ticket always goes
// through those SECURITY DEFINER RPCs (capacity checks, idempotent
// redemption) — this module never writes vd_tickets directly.

export type TicketStatus = 'issued' | 'redeemed' | 'void'

export type Ticket = {
  id: string
  /** Event tickets: the event, session and tier. Null on a day-tour ticket. */
  eventId: string | null
  sessionId: string | null
  ticketTypeId: string | null
  /** Day-tour tickets: the activity, departure date and timeslot. Null on an event ticket. */
  activityId: string | null
  slotDate: string | null
  timeslotId: string | null
  /** Printed at issue time — what the guest was told, even if the listing changes later. */
  departureTime: string | null
  pickupPointId: string | null
  pickupLabel: string | null
  pickupTime: string | null
  holderName: string | null
  supplierId: string | null
  bookingId: string | null
  orderId: string | null
  orderLineId: string | null
  code: string
  token: string
  status: TicketStatus
  redeemedAt: string | null
  redeemedBy: string | null
  redeemedVia: 'scan' | 'manual' | null
  createdAt: string
}

type TicketRow = {
  id: string
  event_id: string | null
  session_id: string | null
  ticket_type_id: string | null
  activity_id?: string | null
  slot_date?: string | null
  timeslot_id?: string | null
  departure_time?: string | null
  pickup_point_id?: string | null
  pickup_label?: string | null
  pickup_time?: string | null
  holder_name?: string | null
  supplier_id: string | null
  booking_id: string | null
  order_id: string | null
  order_line_id: string | null
  code: string
  token: string
  status: TicketStatus
  redeemed_at: string | null
  redeemed_by: string | null
  redeemed_via: 'scan' | 'manual' | null
  created_at: string
}

function rowToTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    eventId: row.event_id,
    sessionId: row.session_id,
    ticketTypeId: row.ticket_type_id,
    activityId: row.activity_id ?? null,
    slotDate: row.slot_date ?? null,
    timeslotId: row.timeslot_id ?? null,
    departureTime: row.departure_time ?? null,
    pickupPointId: row.pickup_point_id ?? null,
    pickupLabel: row.pickup_label ?? null,
    pickupTime: row.pickup_time ?? null,
    holderName: row.holder_name ?? null,
    supplierId: row.supplier_id,
    bookingId: row.booking_id,
    orderId: row.order_id,
    orderLineId: row.order_line_id,
    code: row.code,
    token: row.token,
    status: row.status,
    redeemedAt: row.redeemed_at,
    redeemedBy: row.redeemed_by,
    redeemedVia: row.redeemed_via,
    createdAt: row.created_at,
  }
}

/**
 * Mints `qty` tickets for one event session/tier, atomically checked against
 * capacity by vd_issue_tickets. Called by the payment webhook once a booking
 * is confirmed (service-role context, one call per event order line), and by
 * suppliers recording a walk-in/offline sale from their own portal.
 */
export async function issueTickets(input: {
  eventId: string
  sessionId: string
  ticketTypeId: string
  qty: number
  bookingId?: string
  orderId?: string
  orderLineId?: string
}): Promise<Ticket[]> {
  const { data, error } = await supabase.rpc('vd_issue_tickets', {
    p_event_id: input.eventId,
    p_session_id: input.sessionId,
    p_ticket_type_id: input.ticketTypeId,
    p_qty: input.qty,
    p_booking_id: input.bookingId ?? null,
    p_order_id: input.orderId ?? null,
    p_order_line_id: input.orderLineId ?? null,
  })
  if (error) throw new Error(error.message || 'Could not issue tickets.')
  return ((data ?? []) as TicketRow[]).map(rowToTicket)
}

/**
 * Records a walk-in/offline sale (e.g. a supplier migrating an event's
 * existing guest list from elsewhere) — same "migrating from Wix Events"
 * rationale as addManualGuest() in lib/departure-guests.ts, just for events.
 * These tickets carry no booking, so they won't appear in a customer's
 * /account/tickets — the supplier hands them to the guest directly.
 */
export async function addManualTicket(input: {
  eventId: string
  sessionId: string
  ticketTypeId: string
  qty?: number
}): Promise<Ticket[]> {
  const supplierId = await getEffectiveSupplierId()
  if (!supplierId) throw new Error('You need to be signed in to record a ticket.')
  return issueTickets({
    eventId: input.eventId,
    sessionId: input.sessionId,
    ticketTypeId: input.ticketTypeId,
    qty: Math.max(1, Math.floor(input.qty ?? 1)),
  })
}

/** Voids every unredeemed ticket for a cancelled booking and frees their capacity. */
export async function releaseTicketsForBooking(bookingId: string): Promise<void> {
  const { error } = await supabase.rpc('vd_release_tickets', { p_booking_id: bookingId })
  if (error) throw new Error(error.message || 'Could not release these tickets.')
}

export type RedeemResult =
  | { ok: true; ticket: Ticket }
  | {
      ok: false
      /** wrong_date: a day-tour ticket scanned on a day other than its departure. */
      reason: 'not_found' | 'invalid_token' | 'void' | 'already_redeemed' | 'wrong_date'
      redeemedAt?: string
      /** Present once the token checked out, so the scanner can say whose ticket it refused. */
      ticket?: Ticket
    }

/** Scans/checks in a ticket. Idempotent — redeeming twice reports `already_redeemed` rather than erroring. */
export async function redeemTicket(ticketId: string, token: string, via: 'scan' | 'manual' = 'scan'): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('vd_redeem_ticket', {
    p_ticket_id: ticketId,
    p_token: token,
    p_via: via,
  })
  if (error) throw new Error(error.message || 'Could not check in this ticket.')
  if (data?.ok) return { ok: true, ticket: rowToTicket(data.ticket as TicketRow) }
  return {
    ok: false,
    reason: data?.reason ?? 'not_found',
    redeemedAt: data?.redeemed_at ?? undefined,
    ticket: data?.ticket ? rowToTicket(data.ticket as TicketRow) : undefined,
  }
}

/** The signed-in visitor's own tickets, newest first. */
export async function getMyTickets(): Promise<Ticket[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: bookings } = await supabase.from('vd_bookings').select('id').eq('user_id', user.id)
  const bookingIds = (bookings ?? []).map(b => b.id as string)
  if (bookingIds.length === 0) return []

  const { data } = await supabase
    .from('vd_tickets')
    .select('*')
    .in('booking_id', bookingIds)
    .order('created_at', { ascending: false })
  return ((data ?? []) as TicketRow[]).map(rowToTicket)
}

/** All tickets for one event, across every session — the supplier guest-list view. */
export async function getEventTickets(eventId: string): Promise<Ticket[]> {
  const { data } = await supabase
    .from('vd_tickets')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  return ((data ?? []) as TicketRow[]).map(rowToTicket)
}

/** Tickets for one specific session of an event — used by the check-in scanner's guest list. */
export async function getSessionTickets(eventId: string, sessionId: string): Promise<Ticket[]> {
  const { data } = await supabase
    .from('vd_tickets')
    .select('*')
    .eq('event_id', eventId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  return ((data ?? []) as TicketRow[]).map(rowToTicket)
}

/** Every ticket on one departure of a day tour — the operator's boarding manifest. */
export async function getDepartureTickets(activityId: string, slotDate: string, timeslotId: string): Promise<Ticket[]> {
  const { data } = await supabase
    .from('vd_tickets')
    .select('*')
    .eq('activity_id', activityId)
    .eq('slot_date', slotDate)
    .eq('timeslot_id', timeslotId)
    .order('pickup_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  return ((data ?? []) as TicketRow[]).map(rowToTicket)
}

/** Looks up one ticket by id, for the scanner to display before/without redeeming. */
export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  const { data } = await supabase.from('vd_tickets').select('*').eq('id', ticketId).maybeSingle()
  return data ? rowToTicket(data as TicketRow) : null
}

/**
 * Looks up a ticket by its human-readable code, for the check-in scanner's
 * manual fallback (staff typing in what a guest reads out, no camera
 * needed). RLS already restricts this to tickets the caller's own events
 * issued, so a guessed code from an unrelated event returns nothing.
 */
export async function getTicketByCode(code: string): Promise<Ticket | null> {
  const { data } = await supabase.from('vd_tickets').select('*').eq('code', code.trim().toUpperCase()).maybeSingle()
  return data ? rowToTicket(data as TicketRow) : null
}

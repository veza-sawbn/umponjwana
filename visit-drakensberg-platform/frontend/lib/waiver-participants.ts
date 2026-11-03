// The people on a departure, as a waiver send list: guests who booked online
// (paid) and guests the operator added by hand, merged so one person appears
// once — a hand-entered guest who also booked online (same email, or the
// booking reference in their notes) is the same guest.
//
// Unpaid online bookings are left out: they may never turn into a guest, and
// their seat is released if they don't pay (20261102_checkout_seat_cleanup).

import type { DepartureBooking, DepartureGuest } from './departure-guests'

export type WaiverParticipant = {
  key: string
  name: string
  email: string | null
  seats: number
  source: 'online' | 'manual'
  reference: string | null
}

const norm = (e: string | null | undefined) => (e ?? '').trim().toLowerCase()

export function departureParticipants(bookings: DepartureBooking[], guests: DepartureGuest[]): WaiverParticipant[] {
  const out: WaiverParticipant[] = []
  const seenEmails = new Set<string>()
  const seenRefs = new Set<string>()

  for (const b of bookings) {
    if (b.status !== 'confirmed') continue
    const email = norm(b.customerEmail)
    if (email) seenEmails.add(email)
    if (b.reference) seenRefs.add(b.reference.toUpperCase())
    out.push({ key: `b:${b.bookingId}`, name: b.customerName, email: email || null, seats: b.seats, source: 'online', reference: b.reference })
  }
  for (const g of guests) {
    const email = norm(g.email)
    const notes = (g.notes ?? '').toUpperCase()
    if (email && seenEmails.has(email)) continue
    if ([...seenRefs].some(r => notes.includes(r))) continue
    if (email) seenEmails.add(email)
    out.push({ key: `g:${g.id}`, name: g.name, email: email || null, seats: g.seats, source: 'manual', reference: null })
  }
  return out
}

/** Whether this guest already has a live (not withdrawn) waiver for this trip. */
export function alreadySentTo(
  email: string | null,
  serviceDate: string | null,
  activityName: string,
  requests: { participant_email: string; service_date: string | null; activity_name: string; status: string }[],
): boolean {
  const e = norm(email)
  if (!e) return false
  const act = activityName.trim().toLowerCase()
  return requests.some(r =>
    norm(r.participant_email) === e
    && (r.service_date ?? null) === (serviceDate || null)
    && (r.activity_name ?? '').trim().toLowerCase() === act
    && r.status !== 'void')
}

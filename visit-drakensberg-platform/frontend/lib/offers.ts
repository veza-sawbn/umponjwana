// Scheduled supplier offers — a price reduction a supplier sets up in advance
// that runs between two dates. Pure logic only (no Supabase client), so the
// scheduling and commission rules can be unit-tested; the supplier dashboard
// persists offers through lib/supplier-entities like every other entity.
//
// Commission is never waived by an offer. vd_create_order() computes
// commission on the line's net (gross − discount), so an offer lowers the
// amount commission is charged on, but the supplier's rate still applies to
// every booking made at the offer price. The dashboard repeats this wherever
// an offer is created or shown, and the supplier must acknowledge it before
// an offer can be scheduled.

import { allocateLine, type Allocation } from './allocation'
import { todayISO } from './upcoming'

export type OfferType = 'percent' | 'flat'

export type OfferFields = {
  title: string
  description: string
  type: OfferType
  value: number
  listing: string          // listing name, '' = all listings
  startsOn: string         // yyyy-mm-dd, first day the offer runs (SA time)
  endsOn: string           // yyyy-mm-dd, last day the offer runs (inclusive)
}

export type Offer = OfferFields & {
  id: string
  supplierId: string
  createdAt: string
  updatedAt?: string
  status: 'active' | 'paused'
  // Recorded at creation so there's a trail that the supplier was told.
  commissionAcknowledged: true
  commissionAcknowledgedAt: string
  commissionRateAtCreation: number
}

export type OfferState = 'scheduled' | 'live' | 'ended' | 'paused'

export const OFFER_STATE_LABEL: Record<OfferState, string> = {
  scheduled: 'Scheduled',
  live: 'Live',
  ended: 'Ended',
  paused: 'Paused',
}

/** Where an offer sits in its schedule on `today` (yyyy-mm-dd, SA time). An
 *  ended offer reads as ended even if it was paused — pausing can't revive it. */
export function offerState(
  o: Pick<Offer, 'status' | 'startsOn' | 'endsOn'>,
  today: string = todayISO(),
): OfferState {
  if (o.endsOn < today) return 'ended'
  if (o.status === 'paused') return 'paused'
  if (o.startsOn > today) return 'scheduled'
  return 'live'
}

/** Why a new offer can't be scheduled, or null when it can. */
export function validateOffer(
  f: OfferFields & { commissionAcknowledged: boolean },
  today: string = todayISO(),
): string | null {
  if (!f.title.trim()) return 'Give the offer a name.'
  if (!Number.isFinite(f.value) || f.value <= 0) return 'Enter how much the offer takes off.'
  if (f.type === 'percent' && f.value >= 100) return 'A percentage offer must be less than 100%.'
  if (!f.startsOn) return 'Choose the date the offer starts.'
  if (!f.endsOn) return 'Choose the date the offer ends.'
  if (f.startsOn < today) return 'The start date can’t be in the past.'
  if (f.endsOn < f.startsOn) return 'The end date must be on or after the start date.'
  if (!f.commissionAcknowledged) return 'Please confirm you understand commission still applies to this offer.'
  return null
}

/** Amount the offer takes off a given price, never more than the price. */
export function offerDiscount(o: Pick<OfferFields, 'type' | 'value'>, price: number): number {
  if (!(price > 0) || !(o.value > 0)) return 0
  const off = o.type === 'percent' ? price * (o.value / 100) : o.value
  return Math.round(Math.min(off, price) * 100) / 100
}

/** What a booking at `price` looks like with the offer applied: the guest's
 *  price, the commission still charged on it, and what the supplier keeps.
 *  Preview only — the authoritative split is computed server-side. */
export function offerCommissionPreview(
  o: Pick<OfferFields, 'type' | 'value'>,
  price: number,
  commissionRate: number,
): Allocation & { discountAmount: number } {
  const discountAmount = offerDiscount(o, price)
  return { ...allocateLine({ grossAmount: price, discountAmount, commissionRate }), discountAmount }
}

/** One-line reminder shown on every offer surface. */
export function commissionReminder(rateLabel: string): string {
  return `Commission still applies: ${rateLabel} is charged on every booking made with this offer, calculated on the offer price the guest pays.`
}

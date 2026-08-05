import type { InvoiceLine } from './invoices'

// Gratuities on activity invoices.
//
// A guest who booked something guided can add a tip when they pay online. The
// tip is not a service the platform sells: it carries no commission and no
// VAT, and every cent is allocated to the operator who ran the activity.
// The authoritative split lives in vd_apply_order_tip(); everything here is
// for showing the guest what they're about to pay.

/**
 * Categories a guest can tip on — the people who guided, drove or hosted
 * them, not a chalet or a park levy.
 * Mirrored in SQL by vd_tippable_categories(); change both together.
 */
export const TIPPABLE_CATEGORIES = ['activity', 'tour', 'hike', 'shuttle'] as const

export const DEFAULT_TIP_PRESETS = [10, 15, 20]

const r2 = (n: number) => Math.round(n * 100) / 100

export function isTippableCategory(category?: string | null): boolean {
  return TIPPABLE_CATEGORIES.includes(String(category ?? '').toLowerCase() as typeof TIPPABLE_CATEGORIES[number])
}

/**
 * What the tip is calculated on: the guided portion of the invoice, before
 * the service fee and VAT. Tipping 15% of a bill that includes four nights of
 * accommodation would be a nasty surprise.
 */
export function tippableTotal(lines: InvoiceLine[] | undefined | null): number {
  if (!Array.isArray(lines)) return 0
  return r2(lines.reduce((sum, l) => sum + (isTippableCategory(l.category) ? Number(l.total) || 0 : 0), 0))
}

/** Rand amount for a preset percentage of the guided portion. */
export function tipForPercent(tippable: number, percent: number): number {
  return r2(Math.max(tippable, 0) * (percent / 100))
}

/**
 * A tip can't exceed what was tipped on — the same ceiling the payment route
 * enforces before it charges anything.
 */
export function maxTip(tippable: number): number {
  return r2(Math.max(tippable, 0))
}

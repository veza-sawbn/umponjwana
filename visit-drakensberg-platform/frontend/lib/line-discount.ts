// Per-line discounts on invoices — used to bill a bundled package as its
// real components, writing off (or reducing) the ones that are included.
// E.g. a Northern Mini Traverse hike with the shuttle back to the start
// included: the shuttle is its own line, routed to the transport supplier,
// discounted 100% with the reason "Included in the … package".
//
// The authoritative arithmetic is vd_create_order / vd_update_order
// (20261101_invoice_line_discounts.sql). Everything here is the same maths
// for the form's live preview and for the documents, with no I/O.

export type DiscountType = 'amount' | 'percent'
export type DiscountFunding = 'supplier' | 'platform'

export const DEFAULT_DISCOUNT_REASON = 'Included in package'

const r2 = (n: number) => Math.round(n * 100) / 100

/** Parses a typed number, treating blanks and junk as 0. */
function num(v: string | number | undefined | null): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * The rand discount on a line worth `gross`, from what was typed: an amount,
 * or a percentage of the line. Never negative and never more than the line.
 */
export function lineDiscountAmount(gross: number, type: DiscountType | undefined, value: string | number | undefined): number {
  const g = Math.max(num(gross), 0)
  const v = Math.max(num(value), 0)
  const raw = type === 'percent' ? g * Math.min(v, 100) / 100 : v
  return r2(Math.min(raw, g))
}

/** What's wrong with a typed discount, or null when it's fine. */
export function discountProblem(gross: number, type: DiscountType | undefined, value: string | undefined): string | null {
  const s = String(value ?? '').trim()
  if (!s) return null
  const v = parseFloat(s.replace(',', '.'))
  if (!Number.isFinite(v)) return 'Enter a number'
  if (v < 0) return 'Cannot be negative'
  if (type === 'percent' && v > 100) return 'At most 100%'
  if (type !== 'percent' && v > gross) return 'More than the line\'s price'
  return null
}

/** True when the line is free to the customer: written off in full. */
export function isWrittenOff(gross: number, discount: number): boolean {
  return gross > 0 && discount >= gross
}

/**
 * What the supplier is paid on (their "gross" on a statement): the full price
 * when the platform funded the discount, the discounted price otherwise.
 */
export function supplierBilledAmount(line: {
  gross_amount: number | string
  discount_amount: number | string
  discount_funded_by?: string | null
}): number {
  const gross = Number(line.gross_amount) || 0
  const discount = Number(line.discount_amount) || 0
  return line.discount_funded_by === 'platform' ? gross : gross - discount
}

export type DocLine = { total: number | string; grossTotal?: number | string; discount?: number | string }

/** The line's price before its discount, as recorded on the invoice document. */
export function docLineGross(l: DocLine): number {
  const total = Number(l.total) || 0
  if (l.grossTotal != null && l.grossTotal !== '') return Number(l.grossTotal) || 0
  return total + (Number(l.discount) || 0)
}

/** Everything an invoice's line discounts take off — the customer's saving. */
export function invoiceSavings(lines: DocLine[] | null | undefined): number {
  if (!Array.isArray(lines)) return 0
  return r2(lines.reduce((s, l) => s + Math.max(Number(l.discount) || 0, 0), 0))
}

/** Sum of the lines before any discount. */
export function invoiceGrossItems(lines: DocLine[] | null | undefined): number {
  if (!Array.isArray(lines)) return 0
  return r2(lines.reduce((s, l) => s + docLineGross(l), 0))
}

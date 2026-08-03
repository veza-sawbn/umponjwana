// Supplier Allocation Engine — pure client-side math used for previews and
// statements. The authoritative allocation is computed server-side inside
// vd_create_order() / vd_update_line_allocation() from vd_supplier_terms and
// vd_finance_settings, so nothing here is a source of truth.

export type AllocationInput = {
  grossAmount: number
  discountAmount?: number
  commissionRate: number   // e.g. 0.12
  platformFeeRate?: number
  taxRate?: number
  platformOwned?: boolean  // line delivered by Visit Drakensberg itself
}

export type Allocation = {
  netAmount: number         // gross − discount
  commissionAmount: number
  platformFee: number
  taxAmount: number
  supplierShare: number     // net supplier amount
  platformShare: number     // Visit Drakensberg share
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function allocateLine(input: AllocationInput): Allocation {
  const net = Math.max((input.grossAmount || 0) - (input.discountAmount || 0), 0)
  const taxAmount = r2(net * (input.taxRate ?? 0))
  if (input.platformOwned) {
    return { netAmount: net, commissionAmount: 0, platformFee: 0, taxAmount, supplierShare: 0, platformShare: net }
  }
  const commissionAmount = r2(net * (input.commissionRate || 0))
  const platformFee = r2(net * (input.platformFeeRate || 0))
  const supplierShare = r2(net - commissionAmount - platformFee)
  return {
    netAmount: net,
    commissionAmount,
    platformFee,
    taxAmount,
    supplierShare,
    platformShare: r2(commissionAmount + platformFee),
  }
}

/**
 * The single money formatter for the whole platform — screens, invoices,
 * statements and emails all render through this, so figures never disagree
 * between a document and the console that produced it.
 *
 * South African accounting presentation: space-grouped thousands, period
 * decimal, exactly two decimals, negatives in parentheses rather than carrying
 * a minus sign so credits and refunds read the way they do on a statement.
 *
 *   1288.5      →  R 1 288.50
 *   -450.25     →  (R 450.25)
 *   1234567.891 →  R 1 234 567.89
 *
 * Grouping is applied manually rather than via the en-ZA locale, which pairs
 * space grouping with a COMMA decimal separator — mixing the two conventions
 * is what makes a figure ambiguous. The separator is a non-breaking space so a
 * number never wraps across lines mid-value.
 */
const GROUP_SEPARATOR = ' '

const MONEY_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(amount: number, currency = 'ZAR'): string {
  const symbol = currency === 'ZAR' ? 'R ' : `${currency} `
  const value = Number.isFinite(amount) ? amount : 0
  const digits = MONEY_FORMAT.format(Math.abs(value)).replace(/,/g, GROUP_SEPARATOR)
  const body = `${symbol}${digits}`
  return value < 0 ? `(${body})` : body
}

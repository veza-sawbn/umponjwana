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

export function formatMoney(amount: number, currency = 'ZAR'): string {
  const symbol = currency === 'ZAR' ? 'R ' : `${currency} `
  return `${symbol}${(amount ?? 0).toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`
}

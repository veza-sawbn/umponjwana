// An order's customer as staff edit it, and the checks the database repeats.
//
// Kept free of any Supabase import so it can be used (and unit-tested) without
// creating a client — lib/orders.ts re-exports both for the app's callers.

export type OrderCustomerDetails = {
  name: string
  email: string
  phone: string
  isCompany: boolean
  company: string
  vatNumber: string
  registrationNumber: string
  address: string
}

/**
 * The checks vd_update_order_customer makes, run in the browser first so
 * staff see the problem before anything is saved. Returns a message, or null.
 */
export function validateCustomerDetails(d: OrderCustomerDetails): string | null {
  if (!d.name.trim()) return 'Enter the customer name.'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) return 'Enter a valid customer email.'
  if (d.isCompany) {
    if (!d.company.trim()) return 'Enter the company name.'
    const vat = d.vatNumber.replace(/\s+/g, '')
    // An all-digit VAT number is South African: ten digits starting with 4.
    // Anything with letters is foreign and is taken as typed.
    if (/^\d+$/.test(vat) && !/^4\d{9}$/.test(vat)) return 'A South African VAT number is 10 digits starting with 4.'
  }
  return null
}

/** The billing columns an order carries (see 20261014_order_customer_details.sql). */
export type OrderBilling = {
  customer_is_company?: boolean | null
  customer_company?: string | null
  customer_vat_number?: string | null
  customer_registration_number?: string | null
}

/**
 * The company rows a receipt shows for a company customer — who the money
 * came from (or, on a refund, went to), then VAT and registration numbers
 * when they are on file. Empty for an individual, so a personal receipt
 * reads exactly as before.
 */
export function companyBillingRows(order: OrderBilling, opts: { refund?: boolean } = {}): [string, string][] {
  const company = (order.customer_company ?? '').trim()
  if (!order.customer_is_company || !company) return []
  const rows: [string, string][] = [[opts.refund ? 'Refunded to' : 'Received from', company]]
  const vat = (order.customer_vat_number ?? '').trim()
  const reg = (order.customer_registration_number ?? '').trim()
  if (vat) rows.push(['VAT number', vat])
  if (reg) rows.push(['Registration number', reg])
  return rows
}

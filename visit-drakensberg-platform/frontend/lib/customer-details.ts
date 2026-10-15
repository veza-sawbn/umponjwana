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

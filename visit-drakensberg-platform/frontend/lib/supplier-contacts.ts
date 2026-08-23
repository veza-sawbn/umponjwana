import { supabase } from './auth'
import { fetchAllRows } from './customers-admin'

/* ────────────────────────────────────────────────────────────────────────────
 * Supplier contacts — every customer a supplier has actually transacted with,
 * automatically kept up to date from vd_order_lines/vd_orders (see
 * vd_recompute_supplier_contacts() in
 * supabase/migrations/20260826_supplier_contacts.sql). There is no manual-
 * entry path: a contact only ever exists because a real booking created it.
 *
 * RLS scopes vd_supplier_contacts to the signed-in supplier's own rows —
 * getMyContacts() relies on that, the same way lib/orders.ts's
 * getMyOrderLines() does, rather than filtering client-side.
 * ──────────────────────────────────────────────────────────────────────────── */

export type SupplierContact = {
  id: string
  customerUserId: string
  name: string | null
  email: string | null
  phone: string | null
  firstBookingAt: string | null
  lastBookingAt: string | null
  bookingCount: number
  lifetimeSpend: number
}

function rowToContact(r: any): SupplierContact {
  return {
    id: r.id, customerUserId: r.customer_user_id, name: r.name, email: r.email, phone: r.phone,
    firstBookingAt: r.first_booking_at, lastBookingAt: r.last_booking_at,
    bookingCount: r.booking_count, lifetimeSpend: Number(r.lifetime_spend) || 0,
  }
}

/** The signed-in supplier's own contacts only — RLS enforces this even if
 *  the query below didn't filter explicitly. Paginated via fetchAllRows:
 *  a busy supplier can have more contacts than PostgREST's single-response
 *  row cap (1000 by default), same reasoning as the admin cross-supplier
 *  read in lib/admin-supplier-contacts.ts. */
export async function getMyContacts(): Promise<SupplierContact[]> {
  const rows = await fetchAllRows<any>(
    (from, to) => supabase
      .from('vd_supplier_contacts')
      .select('*')
      .order('last_booking_at', { ascending: false, nullsFirst: false })
      .range(from, to),
    'vd_supplier_contacts',
  )
  return rows.map(rowToContact)
}

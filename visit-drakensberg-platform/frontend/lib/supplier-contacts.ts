import { supabase } from './auth'
import { fetchAllRows } from './customers-admin'

/* ────────────────────────────────────────────────────────────────────────────
 * Supplier contacts — every customer a supplier has actually transacted with,
 * automatically kept up to date from vd_order_lines/vd_orders (see
 * vd_recompute_supplier_contacts() in
 * supabase/migrations/20260826_supplier_contacts.sql). There is still no
 * manual-entry path for these: a `source: 'booking'` contact only ever
 * exists because a real booking created it. Admin can additionally bulk-
 * import a `source: 'imported'` contact list into a supplier's address book
 * (see supabase/migrations/20260827_supplier_contacts_import.sql) — those
 * rows carry no booking stats and are never touched by the recompute above.
 *
 * RLS scopes vd_supplier_contacts to the signed-in supplier's own rows —
 * getMyContacts() relies on that, the same way lib/orders.ts's
 * getMyOrderLines() does, rather than filtering client-side.
 *
 * A third source, 'manual', was added in the 20260828 migration: a guest
 * the supplier recorded by hand on a departure (lib/departure-guests.ts,
 * "migrating from Wix Events") via vd_add_supplier_contact() — never
 * touched by vd_recompute_supplier_contacts(), same isolation as 'imported'.
 * ──────────────────────────────────────────────────────────────────────────── */

export type SupplierContact = {
  id: string
  customerUserId: string | null
  name: string | null
  email: string | null
  phone: string | null
  firstBookingAt: string | null
  lastBookingAt: string | null
  bookingCount: number
  lifetimeSpend: number
  source: 'booking' | 'imported' | 'manual'
}

function rowToContact(r: any): SupplierContact {
  return {
    id: r.id, customerUserId: r.customer_user_id, name: r.name, email: r.email, phone: r.phone,
    firstBookingAt: r.first_booking_at, lastBookingAt: r.last_booking_at,
    bookingCount: r.booking_count, lifetimeSpend: Number(r.lifetime_spend) || 0,
    source: r.source === 'imported' ? 'imported' : r.source === 'manual' ? 'manual' : 'booking',
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

import { supabase } from './auth'
import { getAdminSuppliers } from './admin-supabase'
import { fetchAllRows } from './customers-admin'
import type { SupplierContact } from './supplier-contacts'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin, cross-supplier view of vd_supplier_contacts (see
 * supabase/migrations/20260826_supplier_contacts.sql). Admin RLS allows
 * reading every supplier's contacts, unlike a supplier session which only
 * ever sees its own — this module is admin-only by virtue of what it reads,
 * same as the rest of /admin.
 * ──────────────────────────────────────────────────────────────────────────── */

export type AdminSupplierContact = SupplierContact & {
  supplierId: string
  supplierName: string
}

function rowToContact(r: any): SupplierContact & { supplierId: string } {
  return {
    id: r.id, supplierId: r.supplier_id, customerUserId: r.customer_user_id,
    name: r.name, email: r.email, phone: r.phone,
    firstBookingAt: r.first_booking_at, lastBookingAt: r.last_booking_at,
    bookingCount: r.booking_count, lifetimeSpend: Number(r.lifetime_spend) || 0,
  }
}

export async function getAllSupplierContacts(): Promise<AdminSupplierContact[]> {
  const [rows, suppliers] = await Promise.all([
    fetchAllRows<any>(
      (from, to) => supabase.from('vd_supplier_contacts').select('*').range(from, to),
      'vd_supplier_contacts',
    ),
    getAdminSuppliers(),
  ])
  const nameById = new Map(suppliers.map(s => [s.id, s.business_name]))
  return rows.map(r => {
    const c = rowToContact(r)
    return { ...c, supplierName: nameById.get(c.supplierId) ?? 'Unknown supplier' }
  })
}

export async function recomputeSupplierContacts(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('vd_recompute_supplier_contacts', {})
  return { error: error?.message ?? null }
}

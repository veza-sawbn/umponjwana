import { supabase } from './auth'
import type { SupplierType } from './supplier-config'

/**
 * Adds a supplier type to a supplier's profile, revealing that type's tools in
 * the portal nav (mergeNavForTypes(), lib/supplier-config.ts).
 *
 * Only ever adds — vd_add_supplier_type() cannot remove a type, so a supplier
 * can never lose tools they already had, and the types they registered with
 * stay exactly as the listing application recorded them.
 *
 * Returns true only when the type was newly added. Callers usually want a hard
 * navigation in that case: SupplierProvider reads the profile once on mount, so
 * a client-side route change would leave the new nav items hidden until the
 * next full page load.
 */
export async function addSupplierType(supplierId: string, type: SupplierType): Promise<boolean> {
  const { data, error } = await supabase.rpc('vd_add_supplier_type', {
    p_supplier_id: supplierId,
    p_type: type,
  })
  if (error) throw new Error(error.message || 'Could not update supplier type')
  return data === true
}

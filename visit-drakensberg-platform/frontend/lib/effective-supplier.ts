import { supabase } from './auth'

/**
 * Resolves which supplier the current screen is operating on.
 *
 * For a supplier signed into their own portal this is simply their user id.
 * For a VD Operations employee who has entered a managed supplier, it is the
 * *managed supplier's* id — otherwise their screens would query the employee's
 * own (empty) catalog rather than the supplier's.
 *
 * The sessionStorage value is a navigation hint, not an authorisation claim:
 * every read it feeds is still filtered by owner_id and evaluated under RLS,
 * where is_managed_supplier() decides whether the employee may see that
 * supplier's rows at all. Forging the value yields an empty result set, not
 * access.
 */
const SESSION_KEY = 'vd_managed_supplier_id'

export function readManagedSupplierId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

/**
 * The owner id that supplier-portal reads should scope to.
 * Returns null when nobody is signed in.
 */
export async function getEffectiveSupplierId(): Promise<string | null> {
  const managed = readManagedSupplierId()
  if (managed) return managed
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Synchronous form for call sites that already hold the signed-in user id.
 *
 * A supplier in their own portal gets their own id back. An operations
 * employee who has entered a managed supplier gets that supplier's id, so
 * the screen loads the supplier's catalog rather than the employee's empty one.
 */
export function effectiveSupplierId(signedInUserId: string): string {
  return readManagedSupplierId() ?? signedInUserId
}

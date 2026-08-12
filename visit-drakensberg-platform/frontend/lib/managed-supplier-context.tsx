'use client'

/**
 * Managed Supplier Context
 *
 * Extends the supplier system to allow authorised VD Operations employees to
 * "act as" a specific supplier — entering the existing supplier tools with
 * delegated access. The supplier type continues to determine WHAT tools are
 * available; the management assignment determines WHO is allowed to use them.
 *
 * Usage:
 *   - Wrap the supplier area with <ManagedSupplierProvider>
 *   - Components use useManagedSupplier() to get the active context
 *   - The context is stored in sessionStorage so it survives page navigation
 *     but is cleared when the browser tab closes (preventing cross-session leakage)
 *
 * Security:
 *   - sessionStorage is used client-side for navigation context only
 *   - Every server-side query uses the user's real auth session
 *   - RLS policies verify is_managed_supplier() on every data access
 *   - The middleware passes managedSupplierId as a request header after
 *     verifying the assignment exists in the database
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { supabase } from './auth'
import type { SupplierType, SupplierTypeConfig } from './supplier-config'
import { getSupplierConfig, mergeNavForTypes } from './supplier-config'
import type { ManagedSupplierSummary } from './ops-assignments'
import { getMyManagedSuppliers, isManagedSupplier } from './ops-assignments'

const SESSION_KEY = 'vd_managed_supplier_id'

export interface ManagedSupplierContextValue {
  /** Whether this session is running in "acting-as" mode for a managed supplier */
  isActingAs: boolean
  /** The supplier being managed (null if not acting as anyone) */
  activeSupplierId: string | null
  activeSupplierName: string | null
  activeSupplierType: SupplierType | null
  activeSupplierConfig: SupplierTypeConfig | null
  /** The nav items for the active supplier type */
  nav: ReturnType<typeof mergeNavForTypes>
  /** All suppliers this employee can manage */
  assignedSuppliers: ManagedSupplierSummary[]
  /** Whether the current user is a VD Operations employee (not a normal supplier) */
  isOpsEmployee: boolean
  loading: boolean
  /** Select a supplier to manage — validates the assignment exists server-side */
  selectSupplier: (supplierId: string | null) => Promise<void>
  /** Clear the active managed supplier selection */
  clearSelection: () => void
}

const ManagedSupplierContext = createContext<ManagedSupplierContextValue>({
  isActingAs: false,
  activeSupplierId: null,
  activeSupplierName: null,
  activeSupplierType: null,
  activeSupplierConfig: null,
  nav: [],
  assignedSuppliers: [],
  isOpsEmployee: false,
  loading: true,
  selectSupplier: async () => {},
  clearSelection: () => {},
})

export function ManagedSupplierProvider({ children }: { children: ReactNode }) {
  const [assignedSuppliers, setAssignedSuppliers] = useState<ManagedSupplierSummary[]>([])
  const [activeSupplierId, setActiveSupplierId] = useState<string | null>(null)
  const [isOpsEmployee, setIsOpsEmployee] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Check if this user is an ops employee
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, staff_role, ops_role, organisation')
        .eq('id', user.id)
        .maybeSingle()

      const isOps = (
        profile?.organisation === 'vd_operations' &&
        profile?.ops_role != null
      )
      setIsOpsEmployee(isOps)

      if (!isOps) { setLoading(false); return }

      // Load this employee's managed suppliers
      const suppliers = await getMyManagedSuppliers()
      setAssignedSuppliers(suppliers)

      // Restore persisted selection from sessionStorage
      try {
        const saved = sessionStorage.getItem(SESSION_KEY)
        if (saved && suppliers.some(s => s.supplier_id === saved)) {
          setActiveSupplierId(saved)
        }
      } catch {
        // sessionStorage may be unavailable in some environments
      }

      setLoading(false)
    }
    load()
  }, [])

  const selectSupplier = useCallback(async (supplierId: string | null) => {
    if (!supplierId) {
      setActiveSupplierId(null)
      try { sessionStorage.removeItem(SESSION_KEY) } catch {}
      return
    }
    // Verify the assignment still exists server-side before accepting the selection
    const valid = await isManagedSupplier(supplierId)
    if (!valid) {
      console.warn('[ManagedSupplierContext] Assignment not found for', supplierId)
      return
    }
    setActiveSupplierId(supplierId)
    try { sessionStorage.setItem(SESSION_KEY, supplierId) } catch {}
  }, [])

  const clearSelection = useCallback(() => {
    setActiveSupplierId(null)
    try { sessionStorage.removeItem(SESSION_KEY) } catch {}
  }, [])

  // Derive the active supplier's type and config from the assigned suppliers list
  const activeSupplier = activeSupplierId
    ? assignedSuppliers.find(s => s.supplier_id === activeSupplierId) ?? null
    : null

  const activeSupplierType = activeSupplier?.supplier_type as SupplierType | null
  const activeSupplierConfig = activeSupplierType ? getSupplierConfig(activeSupplierType) : null

  // Support multi-type suppliers (comma-separated in supplier_type)
  const types: SupplierType[] = activeSupplier?.supplier_type
    ? (activeSupplier.supplier_type.split(',').map(s => s.trim()) as SupplierType[])
    : []

  const nav = mergeNavForTypes(types)

  const value: ManagedSupplierContextValue = {
    isActingAs: isOpsEmployee && activeSupplierId !== null,
    activeSupplierId,
    activeSupplierName: activeSupplier?.supplier_name ?? null,
    activeSupplierType,
    activeSupplierConfig,
    nav,
    assignedSuppliers,
    isOpsEmployee,
    loading,
    selectSupplier,
    clearSelection,
  }

  return (
    <ManagedSupplierContext.Provider value={value}>
      {children}
    </ManagedSupplierContext.Provider>
  )
}

export function useManagedSupplier() {
  return useContext(ManagedSupplierContext)
}

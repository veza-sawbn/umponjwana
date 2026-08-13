'use client'

/**
 * Operations Context — the /operations working environment.
 *
 * This is the VD Operations employee's own workspace. It is NOT the admin
 * console and carries none of its authority: everything an employee can see
 * or do here is derived from their vd_ops_assignments rows, one supplier at
 * a time.
 *
 * Provides:
 *   - the employee's assigned suppliers, each with its permission-filtered
 *     tool list (so a supplier where they only hold view_bookings shows
 *     exactly one tool)
 *   - the consolidated cross-supplier tools they qualify for
 *   - helpers to test a permission against a specific supplier
 *
 * Security: this context is a *rendering* concern only. Hiding a tool here
 * does not protect data — the RLS policies added by the delegated-management
 * migration (is_managed_supplier / has_supplier_permission) are what actually
 * enforce access, on every query, regardless of what the UI shows.
 */

import {
  createContext, useContext, useEffect, useState, useCallback,
  type ReactNode,
} from 'react'
import { supabase } from './auth'
import type { NavItem } from './supplier-config'
import type { ManagedSupplierSummary, OpsRole } from './ops-assignments'
import { getMyManagedSuppliers } from './ops-assignments'
import {
  navForPermissions, parseSupplierTypes, consolidatedToolsFor,
  type ConsolidatedTool,
} from './ops-permissions'

/** One assigned supplier, resolved into everything the UI needs to render it. */
export interface OperationsSupplier extends ManagedSupplierSummary {
  /** Tools this employee may open for this supplier (type ∩ permissions). */
  tools: NavItem[]
  /** supplier_type parsed into an array (suppliers may carry several). */
  types: ReturnType<typeof parseSupplierTypes>
}

export interface OperationsContextValue {
  loading: boolean
  /** True when the signed-in user is a configured VD Operations employee. */
  isOpsEmployee: boolean
  opsRole: OpsRole | null
  fullName: string
  /** Every supplier assigned to this employee, with tools resolved. */
  suppliers: OperationsSupplier[]
  /** Cross-supplier tools this employee qualifies for. */
  consolidated: (ConsolidatedTool & { supplierIds: string[] })[]
  /** Does the employee hold `permission` on this specific supplier? */
  can: (supplierId: string, permission: string) => boolean
  /** Look up one assigned supplier. */
  getSupplier: (supplierId: string) => OperationsSupplier | null
  reload: () => Promise<void>
}

const OperationsContext = createContext<OperationsContextValue>({
  loading: true,
  isOpsEmployee: false,
  opsRole: null,
  fullName: '',
  suppliers: [],
  consolidated: [],
  can: () => false,
  getSupplier: () => null,
  reload: async () => {},
})

export function OperationsProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [isOpsEmployee, setIsOpsEmployee] = useState(false)
  const [opsRole, setOpsRole] = useState<OpsRole | null>(null)
  const [fullName, setFullName] = useState('')
  const [suppliers, setSuppliers] = useState<OperationsSupplier[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role, staff_role, ops_role, organisation')
      .eq('id', user.id)
      .maybeSingle()

    const isOps = Boolean(
      profile?.organisation === 'vd_operations' && profile?.ops_role,
    )
    setIsOpsEmployee(isOps)
    setOpsRole((profile?.ops_role as OpsRole) ?? null)
    setFullName(profile?.full_name ?? user.user_metadata?.full_name ?? '')

    if (!isOps) { setSuppliers([]); setLoading(false); return }

    // vd_managed_suppliers_summary is already scoped to auth.uid() and to
    // active, unexpired assignments — no client-side filtering needed.
    const rows = await getMyManagedSuppliers()

    setSuppliers(rows.map(row => {
      const types = parseSupplierTypes(row.supplier_type)
      return {
        ...row,
        types,
        tools: navForPermissions(types, row.permissions ?? []),
      }
    }))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const can = useCallback((supplierId: string, permission: string) => {
    const s = suppliers.find(x => x.supplier_id === supplierId)
    return Boolean(s?.permissions?.includes(permission))
  }, [suppliers])

  const getSupplier = useCallback((supplierId: string) => {
    return suppliers.find(x => x.supplier_id === supplierId) ?? null
  }, [suppliers])

  const consolidated = consolidatedToolsFor(
    suppliers.map(s => ({ supplier_id: s.supplier_id, permissions: s.permissions ?? [] })),
  )

  return (
    <OperationsContext.Provider
      value={{
        loading, isOpsEmployee, opsRole, fullName,
        suppliers, consolidated, can, getSupplier, reload: load,
      }}
    >
      {children}
    </OperationsContext.Provider>
  )
}

export function useOperations() {
  return useContext(OperationsContext)
}

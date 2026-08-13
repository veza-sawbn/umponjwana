'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './auth'
import { effectiveSupplierId } from './effective-supplier'
import type { SupplierType, SupplierTypeConfig } from './supplier-config'
import { getSupplierConfig, SUPPLIER_CONFIG, mergeNavForTypes } from './supplier-config'

interface SupplierContextValue {
  supplierType: SupplierType | null
  config: SupplierTypeConfig | null
  supplierTypes: SupplierType[]
  nav: ReturnType<typeof mergeNavForTypes>
  isApproved: boolean
  fullName: string
  loading: boolean
}

const SupplierContext = createContext<SupplierContextValue>({
  supplierType: null,
  config: null,
  supplierTypes: [],
  nav: [],
  isApproved: false,
  fullName: '',
  loading: true,
})

export function SupplierProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<SupplierContextValue>({
    supplierType: null,
    config: null,
    supplierTypes: [],
    nav: [],
    isApproved: false,
    fullName: '',
    loading: true,
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setValue(v => ({ ...v, loading: false })); return }

      // Whose portal this is. When an operations employee is acting-as a
      // managed supplier, this resolves to the SUPPLIER's id — using the raw
      // signed-in user id here would read the employee's own (non-supplier)
      // profile instead, reporting their role/approval/nav as if it were the
      // supplier's. This context feeds every /supplier/* page, so getting it
      // wrong here is the single highest-impact version of that bug.
      const ownerId = effectiveSupplierId(user.id)
      const meta = user.user_metadata ?? {}

      // profiles is the authoritative record — auth metadata is a copy that can
      // drift (accounts created by admins/operations set supplier_type on the
      // profile row only). Read the profile first and fall back to metadata.
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, supplier_type, is_approved, approval_status')
        .eq('id', ownerId)
        .maybeSingle()

      const rawType = (profile?.supplier_type ?? meta.supplier_type) as string | undefined
      const fullName = profile?.full_name || meta.full_name || ''

      // Support comma-separated multi-type e.g. "Accommodation,Activity"
      const types = rawType
        ? (rawType.split(',').map(s => s.trim()) as SupplierType[]).filter(t => SUPPLIER_CONFIG[t])
        : []

      const primaryType = types[0] ?? null
      const config = primaryType ? getSupplierConfig(primaryType) : null

      // is_approved is the operative flag: is_active_supplier() reads only
      // this, and that function gates every catalog write through RLS. Showing
      // approval based on anything else would tell a supplier they are live
      // while every save is silently refused.
      //
      // 20260815_approval_consistency.sql reconciles is_approved with
      // approval_status and keeps them in sync, so reading the operative flag
      // no longer risks stranding a supplier the admin has approved.
      const isApproved = Boolean(profile?.is_approved)

      setValue({
        supplierType: primaryType,
        config,
        supplierTypes: types,
        nav: mergeNavForTypes(types),
        isApproved,
        fullName,
        loading: false,
      })
    }
    load()
  }, [])

  return <SupplierContext.Provider value={value}>{children}</SupplierContext.Provider>
}

export function useSupplier() {
  return useContext(SupplierContext)
}

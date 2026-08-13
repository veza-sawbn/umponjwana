'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './auth'
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

      const meta = user.user_metadata ?? {}

      // profiles is the authoritative record — auth metadata is a copy that can
      // drift (accounts created by admins/operations set supplier_type on the
      // profile row only). Read the profile first and fall back to metadata.
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, supplier_type, is_approved, approval_status')
        .eq('id', user.id)
        .maybeSingle()

      const rawType = (profile?.supplier_type ?? meta.supplier_type) as string | undefined
      const fullName = profile?.full_name || meta.full_name || ''

      // Support comma-separated multi-type e.g. "Accommodation,Activity"
      const types = rawType
        ? (rawType.split(',').map(s => s.trim()) as SupplierType[]).filter(t => SUPPLIER_CONFIG[t])
        : []

      const primaryType = types[0] ?? null
      const config = primaryType ? getSupplierConfig(primaryType) : null

      // Treat either representation as approved. They are meant to stay in
      // sync, and honouring both means a drift in one column can't strand an
      // approved supplier behind the "pending approval" notice.
      const isApproved = Boolean(
        profile?.is_approved || profile?.approval_status === 'approved',
      )

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

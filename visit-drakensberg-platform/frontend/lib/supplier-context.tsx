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
      const rawType = meta.supplier_type as string | undefined
      const fullName = meta.full_name ?? ''

      // Support comma-separated multi-type e.g. "Accommodation,Activity"
      const types = rawType
        ? (rawType.split(',').map(s => s.trim()) as SupplierType[]).filter(t => SUPPLIER_CONFIG[t])
        : []

      const primaryType = types[0] ?? null
      const config = primaryType ? getSupplierConfig(primaryType) : null

      // is_approved comes from profiles table
      const { data: profile } = await supabase.from('profiles').select('is_approved').eq('id', user.id).maybeSingle()
      const isApproved = profile?.is_approved ?? false

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

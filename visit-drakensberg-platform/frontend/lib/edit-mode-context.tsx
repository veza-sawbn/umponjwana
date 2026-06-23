'use client'
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

export type FieldType = 'text' | 'textarea' | 'image' | 'number' | 'range' | 'color'

export interface EditFieldConfig {
  section: string
  fieldKey: string
  value: string | number
  label: string
  type: FieldType
  min?: number
  max?: number
}

interface EditModeContextType {
  isEditMode: true
  pending: Record<string, Record<string, any>>
  openField: (field: EditFieldConfig) => void
  getValue: (section: string, fieldKey: string, fallback: any) => any
}

const EditModeContext = createContext<EditModeContextType | null>(null)

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Record<string, Record<string, any>>>({})

  const openField = useCallback((field: EditFieldConfig) => {
    window.parent.postMessage({ type: 'vd:field_click', payload: field }, '*')
  }, [])

  const getValue = useCallback((section: string, fieldKey: string, fallback: any) => {
    return pending[section]?.[fieldKey] ?? fallback
  }, [pending])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'vd:field_update') {
        const { section, fieldKey, value } = e.data.payload
        setPending(p => ({ ...p, [section]: { ...p[section], [fieldKey]: value } }))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <EditModeContext.Provider value={{ isEditMode: true, pending, openField, getValue }}>
      {children}
    </EditModeContext.Provider>
  )
}

export function useEditMode() {
  return useContext(EditModeContext)
}

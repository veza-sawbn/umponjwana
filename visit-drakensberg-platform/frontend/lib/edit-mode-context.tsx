'use client'
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

export type FieldType = 'text' | 'textarea' | 'image' | 'number' | 'range' | 'color' | 'link'

export interface EditFieldConfig {
  section: string
  fieldKey: string
  value: string | number
  label: string
  type: FieldType
  min?: number
  max?: number
}

export interface SectionClickPayload {
  sectionId: string
  label: string
}

export interface CardClickPayload {
  contentKey: string
  fieldKey: string
  index: number
  label: string
}

interface EditModeContextType {
  isEditMode: true
  pending: Record<string, Record<string, any>>
  openField: (field: EditFieldConfig) => void
  openSection: (payload: SectionClickPayload) => void
  openCard: (payload: CardClickPayload) => void
  /** Live inline-typing notification (parent records it; no echo back). */
  inlineInput: (section: string, fieldKey: string, value: string) => void
  /** Commit an inline edit: apply locally + notify the parent editor. */
  commitInline: (section: string, fieldKey: string, value: string) => void
  getValue: (section: string, fieldKey: string, fallback: any) => any
}

const EditModeContext = createContext<EditModeContextType | null>(null)

function post(type: string, payload?: any) {
  window.parent.postMessage({ type, payload }, '*')
}

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Record<string, Record<string, any>>>({})

  const openField = useCallback((field: EditFieldConfig) => post('vd:field_click', field), [])
  const openSection = useCallback((payload: SectionClickPayload) => post('vd:section_click', payload), [])
  const openCard = useCallback((payload: CardClickPayload) => post('vd:card_click', payload), [])
  const inlineInput = useCallback((section: string, fieldKey: string, value: string) => {
    post('vd:inline_input', { section, fieldKey, value })
  }, [])
  const commitInline = useCallback((section: string, fieldKey: string, value: string) => {
    setPending(p => ({ ...p, [section]: { ...p[section], [fieldKey]: value } }))
    post('vd:inline_commit', { section, fieldKey, value })
  }, [])

  const getValue = useCallback((section: string, fieldKey: string, fallback: any) => {
    return pending[section]?.[fieldKey] ?? fallback
  }, [pending])

  useEffect(() => {
    // Receive live-preview updates + full-state syncs from the parent editor
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'vd:field_update') {
        const { section, fieldKey, value } = e.data.payload
        setPending(p => ({ ...p, [section]: { ...p[section], [fieldKey]: value } }))
      }
      if (e.data?.type === 'vd:state') {
        setPending(e.data.payload?.pending ?? {})
      }
      if (e.data?.type === 'vd:scroll_to') {
        const el = document.getElementById(`vd-sec-${e.data.payload?.sectionId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          el.classList.add('vd-flash')
          setTimeout(() => el.classList.remove('vd-flash'), 1600)
        }
      }
    }
    window.addEventListener('message', handler)
    // Tell the parent editor we're mounted so it can push draft state.
    post('vd:ready')
    return () => window.removeEventListener('message', handler)
  }, [])

  useEffect(() => {
    // Intercept all link clicks so the iframe doesn't navigate away
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a')
      if (anchor) e.preventDefault()
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  return (
    <EditModeContext.Provider value={{ isEditMode: true, pending, openField, openSection, openCard, inlineInput, commitInline, getValue }}>
      {children}
    </EditModeContext.Provider>
  )
}

export function useEditMode() {
  return useContext(EditModeContext)
}

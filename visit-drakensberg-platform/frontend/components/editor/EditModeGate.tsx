'use client'
import { useEffect, useState, ReactNode } from 'react'
import { EditModeProvider } from '@/lib/edit-mode-context'

export default function EditModeGate({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    setEditMode(new URLSearchParams(window.location.search).get('edit') === '1')
  }, [])

  if (editMode) return <EditModeProvider>{children}</EditModeProvider>
  return <>{children}</>
}

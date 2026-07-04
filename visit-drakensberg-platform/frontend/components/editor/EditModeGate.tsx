'use client'
import { useEffect, useState, ReactNode } from 'react'
import { EditModeProvider } from '@/lib/edit-mode-context'
import { supabase } from '@/lib/auth'

export default function EditModeGate({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('edit') !== '1') return
    // Edit mode intercepts navigation and exposes CMS controls — admins only.
    supabase.auth.getUser().then(({ data: { user } }) => {
      const role = user?.app_metadata?.role ?? user?.user_metadata?.role
      if (role === 'admin') setEditMode(true)
    })
  }, [])

  if (editMode) return <EditModeProvider>{children}</EditModeProvider>
  return <>{children}</>
}

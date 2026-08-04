'use client'
import { useEffect, useState, ReactNode } from 'react'
import { EditModeProvider } from '@/lib/edit-mode-context'
import { resolveStaffAccess } from '@/lib/auth'

export default function EditModeGate({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('edit') !== '1') return
    // Edit mode intercepts navigation and exposes CMS controls — admins only.
    // Resolved through profiles as well as auth metadata (see
    // resolveStaffAccess), so the same admins the middleware lets into
    // /admin/editor can actually edit inside its preview iframe.
    resolveStaffAccess().then(({ isAdmin }) => {
      if (isAdmin) setEditMode(true)
    })
  }, [])

  if (editMode) return <EditModeProvider>{children}</EditModeProvider>
  return <>{children}</>
}

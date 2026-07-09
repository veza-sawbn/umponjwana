'use client'
import { useEffect, useMemo, useState } from 'react'
import { getSiteContent, SITE_CONTENT_DEFAULTS, type SiteContent, type SiteContentKey } from './site-content'
import { useEditMode } from './edit-mode-context'

// Loads one site-content section and, inside the visual editor, overlays any
// pending (unsaved) values so the iframe preview updates live as the admin types.
export function useSiteSection<K extends SiteContentKey>(key: K): SiteContent[K] {
  const [content, setContent] = useState<SiteContent[K]>(SITE_CONTENT_DEFAULTS[key])
  const editMode = useEditMode()
  const pending = editMode?.pending

  useEffect(() => {
    let cancelled = false
    getSiteContent(key).then(c => { if (!cancelled) setContent(c) })
    return () => { cancelled = true }
  }, [key])

  return useMemo(() => {
    if (!editMode) return content
    const merged = { ...content } as Record<string, unknown>
    for (const field of Object.keys(merged)) {
      merged[field] = editMode.getValue(key, field, merged[field])
    }
    return merged as SiteContent[K]
  }, [content, editMode, pending, key])
}

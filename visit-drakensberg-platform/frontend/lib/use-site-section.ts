'use client'
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSiteContentOrNull, SITE_CONTENT_DEFAULTS, type SiteContent, type SiteContentKey } from './site-content'
import { useEditMode } from './edit-mode-context'

// Many components on a page can request the same section (every
// EditableSection reads `home_layout`); share one in-flight/recent fetch per
// key instead of hitting Supabase once per component.
const cache = new Map<SiteContentKey, { at: number; promise: Promise<any> }>()
const CACHE_TTL = 30_000

function fetchSectionShared<K extends SiteContentKey>(key: K): Promise<SiteContent[K] | null> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.promise
  const promise = getSiteContentOrNull(key)
  cache.set(key, { at: Date.now(), promise })
  return promise
}

// Server-loaded sections (see app/page.tsx). A hook under this provider
// starts from the real stored content instead of SITE_CONTENT_DEFAULTS, so
// the first paint never shows the placeholder copy and stock photos.
const SiteContentSeedContext = createContext<Partial<SiteContent> | null>(null)

export function SiteContentSeedProvider({ value, children }: { value: Partial<SiteContent> | null | undefined; children: ReactNode }) {
  return createElement(SiteContentSeedContext.Provider, { value: value ?? null }, children)
}

// Loads one site-content section and, inside the visual editor, overlays any
// pending (unsaved) values so the iframe preview updates live as the admin types.
export function useSiteSection<K extends SiteContentKey>(key: K): SiteContent[K] {
  const seed = useContext(SiteContentSeedContext)
  const [content, setContent] = useState<SiteContent[K]>(() => (seed?.[key] as SiteContent[K] | undefined) ?? SITE_CONTENT_DEFAULTS[key])
  const editMode = useEditMode()
  const pending = editMode?.pending

  useEffect(() => {
    let cancelled = false
    // Refresh in the background; a failed read (null) keeps what is shown
    // rather than reverting a seeded section to the defaults.
    fetchSectionShared(key).then(c => { if (!cancelled && c) setContent(c) })
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

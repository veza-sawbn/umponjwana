'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackPageView } from '@/lib/analytics'

/**
 * Mounts once in AppShell. Fires a page_view event (§3) on every route
 * change. Deliberately renders nothing — this is a tracking-only component.
 *
 * Back-office routes (/admin, /supplier, /operations) are excluded: those
 * are staff using the platform to run it, not visitor behaviour, and mixing
 * the two would understate bounce rate / overstate returning-visitor counts
 * on every funnel and traffic report built on top of this table.
 */
const EXCLUDED_PREFIXES = ['/admin', '/supplier', '/operations']

export default function AnalyticsProvider() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return
    trackPageView(pathname)
  }, [pathname])

  return null
}

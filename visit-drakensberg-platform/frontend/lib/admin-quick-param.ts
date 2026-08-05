'use client'

import { useEffect } from 'react'

// The mobile quick-action sheet links to pages with a query flag —
// /admin/invoices?new=invoice, /admin/bookings?filter=pending — so a tap lands
// on the page with the right form open or the right filter applied.
//
// It reads window.location rather than useSearchParams on purpose: these admin
// pages are client components that Next still prerenders, and useSearchParams
// would force a Suspense boundary around every one of them.

/**
 * Applies a one-shot query flag on mount, then strips it from the URL so a
 * refresh (or a back/forward) doesn't re-fire the action.
 */
export function useQuickParam(name: string, apply: (value: string) => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const value = url.searchParams.get(name)
    if (value === null) return
    url.searchParams.delete(name)
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    apply(value)
    // Runs once per mount: the flag is consumed immediately, so re-running on
    // an `apply` identity change would be a no-op at best.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

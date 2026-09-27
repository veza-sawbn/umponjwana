'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { BookingProvider } from '@/lib/booking-context'
import { SavedListingsProvider } from '@/lib/saved-listings-context'
import BookingBar from '@/components/booking/BookingBar'
import EditModeGate from '@/components/editor/EditModeGate'
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider'

const PORTAL_ROOTS = ['/admin', '/supplier', '/operations', '/account']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Portal shells (admin/supplier/operations/account) render their own
  // chrome — sidebar, own logo, own sign-out — so the public site
  // Navbar/BookingBar would just be a second, conflicting header stacked on
  // top of it. /account in particular is the visitor's own dashboard: its
  // sidebar already covers account navigation, so it doesn't need the
  // public Navbar's mega-menu of every destination page on the site too.
  //
  // Matched as whole path segments: a bare startsWith('/supplier') also caught
  // the public /supplier-terms and /supplier-code-of-conduct pages and left
  // them with no site navigation at all.
  const isAdmin = PORTAL_ROOTS.some(r => pathname === r || pathname.startsWith(r + '/')) || pathname === '/maintenance'
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <BookingProvider>
        {/* Wraps the portals too, not just the public site: /account/saved
            reads the same store the heart buttons on /stays write to. */}
        <SavedListingsProvider>
          <EditModeGate>
            <AnalyticsProvider />
            {!isAdmin && <Navbar />}
            {children}
            {!isAdmin && <BookingBar />}
            <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
          </EditModeGate>
        </SavedListingsProvider>
      </BookingProvider>
    </QueryClientProvider>
  )
}

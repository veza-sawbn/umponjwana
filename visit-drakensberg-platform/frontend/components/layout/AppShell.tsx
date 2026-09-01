'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { BookingProvider } from '@/lib/booking-context'
import BookingBar from '@/components/booking/BookingBar'
import EditModeGate from '@/components/editor/EditModeGate'
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Portal shells (admin/supplier/operations) render their own chrome —
  // sidebar, own logo, own sign-out — so the public site Navbar/BookingBar
  // would just be a second, conflicting header stacked on top of it.
  const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/supplier') || pathname.startsWith('/operations') || pathname === '/maintenance'
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <BookingProvider>
        <EditModeGate>
          <AnalyticsProvider />
          {!isAdmin && <Navbar />}
          {children}
          {!isAdmin && <BookingBar />}
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </EditModeGate>
      </BookingProvider>
    </QueryClientProvider>
  )
}

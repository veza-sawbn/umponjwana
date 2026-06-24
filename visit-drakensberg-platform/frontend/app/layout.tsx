'use client'
import './globals.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import { BookingProvider } from '@/lib/booking-context'
import BookingBar from '@/components/booking/BookingBar'
import EditModeGate from '@/components/editor/EditModeGate'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  }))

  return (
    <html lang="en">
      <head>
        <title>Visit Drakensberg | Book Your Mountain Escape</title>
        <meta name="description" content="Discover and book stays, activities, hikes, shuttles and holiday packages in the breathtaking Drakensberg mountains of South Africa." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <BookingProvider>
            <EditModeGate>
            <Navbar />
            {children}
            <BookingBar />
            <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
            </EditModeGate>
          </BookingProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}

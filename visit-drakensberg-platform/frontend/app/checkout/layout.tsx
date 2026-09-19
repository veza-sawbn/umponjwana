import type { Metadata } from 'next'

// Booking checkout — per-session pages with nothing to rank for, and they
// carry booking context in their URLs. Disallowed in robots.ts as well; see
// the note in app/auth/layout.tsx for why both are set.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children
}

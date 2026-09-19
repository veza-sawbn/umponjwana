import type { Metadata } from 'next'

// Tokenised per-guest waiver links, sent by email before a departure. Same
// reasoning as app/unsubscribe/layout.tsx: noindex rather than a robots
// disallow, so the directive is actually readable.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function WaiverLayout({ children }: { children: React.ReactNode }) {
  return children
}

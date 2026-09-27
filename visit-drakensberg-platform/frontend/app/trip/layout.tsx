import type { Metadata } from 'next'

// Not indexed (a per-visitor or query-driven page), but it still needs a
// real title, and must not inherit the homepage canonical from the root layout.
export const metadata: Metadata = {
  title: 'Your Trip',
  description: 'Review the stays, hikes and activities in your Drakensberg trip and check out.',
  robots: { index: false },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

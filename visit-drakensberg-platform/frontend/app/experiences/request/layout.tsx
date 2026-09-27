import type { Metadata } from 'next'

// Not indexed (a per-visitor or query-driven page), but it still needs a
// real title, and must not inherit the homepage canonical from the root layout.
export const metadata: Metadata = {
  title: 'Request a Private Experience',
  description: 'Ask a Drakensberg guide or operator for a private hike, tour or experience on your dates.',
  robots: { index: false },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

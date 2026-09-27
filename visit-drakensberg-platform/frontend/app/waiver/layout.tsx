import type { Metadata } from 'next'

// Per-guest signing links carry a private token in the URL.
export const metadata: Metadata = {
  title: 'Sign Your Waiver',
  description: 'Review and sign the participation waiver for your Drakensberg booking.',
  robots: { index: false, follow: false },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

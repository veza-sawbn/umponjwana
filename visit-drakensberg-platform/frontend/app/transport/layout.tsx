import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shuttle Routes',
  description: 'Fixed-price shuttle routes between Drakensberg towns, trailheads and valleys, run by verified transport partners — book a seat or request a private transfer.',
  alternates: { canonical: '/transport' },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

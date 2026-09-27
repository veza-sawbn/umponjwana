import type { Metadata } from 'next'
import { withSocial } from '@/lib/seo'

export const metadata: Metadata = withSocial({
  title: "Guided Tours",
  description: "Multi-day guided treks and tours across the Drakensberg, led by verified local operators, with scheduled departures you can join or book privately.",
  alternates: { canonical: '/tours' },
})

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

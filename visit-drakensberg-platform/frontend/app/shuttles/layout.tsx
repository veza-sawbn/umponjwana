import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Shuttles & Transfers",
  description: "Airport transfers, trailhead drops and 4x4 Sani Pass shuttles across the Drakensberg region.",
  alternates: { canonical: '/shuttles' },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

import type { Metadata } from 'next'
import { withSocial } from '@/lib/seo'

export const metadata: Metadata = withSocial({
  title: "Shuttles & Transfers",
  description: "Airport transfers, trailhead drops and 4x4 Sani Pass shuttles across the Drakensberg region.",
  alternates: { canonical: '/shuttles' },
})

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

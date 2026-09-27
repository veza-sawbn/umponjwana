import type { Metadata } from 'next'
import { withSocial } from '@/lib/seo'

export const metadata: Metadata = withSocial({
  title: "Holiday Packages",
  description: "Curated Drakensberg holiday packages combining stays, hikes, activities and transfers.",
  alternates: { canonical: '/packages' },
})

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

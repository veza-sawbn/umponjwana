import type { Metadata } from 'next'
import { withSocial } from '@/lib/seo'

export const metadata: Metadata = withSocial({
  title: "Mountain Guides",
  description: "Book registered, experienced mountain guides for hikes and summits across the Drakensberg.",
  alternates: { canonical: '/guides' },
})

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

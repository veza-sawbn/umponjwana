import type { Metadata } from 'next'
import { withSocial } from '@/lib/seo'

export const metadata: Metadata = withSocial({
  title: "Search the Drakensberg",
  description: "Search accommodation, hikes, activities, events and dining across every Drakensberg region.",
  alternates: { canonical: '/search' },
  robots: { index: false },
})

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

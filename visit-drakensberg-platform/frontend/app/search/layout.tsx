import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Search the Drakensberg",
  description: "Search accommodation, hikes, activities, events and dining across every Drakensberg region.",
  alternates: { canonical: '/search' },
  robots: { index: false },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

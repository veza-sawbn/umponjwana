import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Holiday Packages",
  description: "Curated Drakensberg holiday packages combining stays, hikes, activities and transfers.",
  alternates: { canonical: '/packages' },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

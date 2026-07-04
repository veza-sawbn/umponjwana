import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Plan Your Trip",
  description: "Everything you need to plan a Drakensberg holiday: when to go, how to get there, what to pack and where to stay.",
  alternates: { canonical: '/plan' },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

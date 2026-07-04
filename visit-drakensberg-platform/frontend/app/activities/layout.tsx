import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Activities & Experiences",
  description: "Rock climbing, San rock art tours, fly fishing, horse riding and more adventures in the Drakensberg mountains.",
  alternates: { canonical: '/activities' },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

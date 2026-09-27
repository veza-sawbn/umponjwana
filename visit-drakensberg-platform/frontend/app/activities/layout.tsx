import type { Metadata } from 'next'
import { withSocial } from '@/lib/seo'

export const metadata: Metadata = withSocial({
  title: "Activities & Experiences",
  description: "Rock climbing, San rock art tours, fly fishing, horse riding and more adventures in the Drakensberg mountains.",
  alternates: { canonical: '/activities' },
})

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

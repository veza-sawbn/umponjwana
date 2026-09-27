import type { Metadata } from 'next'
import { withSocial } from '@/lib/seo'

export const metadata: Metadata = withSocial({
  title: "Drakensberg Hikes & Trails",
  description: "Day walks to multi-day traverses: Tugela Falls, the Amphitheatre Chain Ladder, Cathedral Peak and more. Trail lengths, difficulty and guided options.",
  alternates: { canonical: '/hikes' },
})

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

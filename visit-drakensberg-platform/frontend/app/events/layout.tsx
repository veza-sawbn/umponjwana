import type { Metadata } from 'next'
import { withSocial } from '@/lib/seo'

export const metadata: Metadata = withSocial({
  title: "Events & Specials",
  description: "What's on in the Drakensberg: stargazing nights, wildflower walks, concerts and seasonal specials.",
  alternates: { canonical: '/events' },
})

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

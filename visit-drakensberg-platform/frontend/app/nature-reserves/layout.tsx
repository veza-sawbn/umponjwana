import type { Metadata } from 'next'
import { withSocial } from '@/lib/seo'

export const metadata: Metadata = withSocial({
  title: "Nature Reserves",
  description: "Explore the protected reserves of the uKhahlamba-Drakensberg Park, a UNESCO World Heritage Site.",
  alternates: { canonical: '/nature-reserves' },
})

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

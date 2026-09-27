import type { Metadata } from 'next'
import { withSocial } from '@/lib/seo'

export const metadata: Metadata = withSocial({
  title: "Drakensberg Regions",
  description: "Choose your Drakensberg: Northern Drakensberg and Royal Natal, Central Drakensberg and Champagne Valley, Southern Drakensberg and Sani Pass.",
  alternates: { canonical: '/regions' },
})

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

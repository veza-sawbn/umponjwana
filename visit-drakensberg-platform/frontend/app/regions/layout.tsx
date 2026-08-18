import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Drakensberg Regions",
  description: "Choose your Drakensberg: Northern Drakensberg and Royal Natal, Central Drakensberg and Champagne Valley, Southern Drakensberg and Sani Pass.",
  alternates: { canonical: '/regions' },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

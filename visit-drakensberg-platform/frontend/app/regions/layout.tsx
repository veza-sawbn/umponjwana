import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Drakensberg Regions",
  description: "Choose your Berg: Northern Berg and Royal Natal, Central Berg and Champagne Valley, Southern Berg and Sani Pass.",
  alternates: { canonical: '/regions' },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

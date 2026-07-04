import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Events & Specials",
  description: "What's on in the Drakensberg: stargazing nights, wildflower walks, concerts and seasonal specials.",
  alternates: { canonical: '/events' },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

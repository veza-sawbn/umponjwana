import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Places to Stay in the Drakensberg",
  description: "Lodges, guesthouses, backpackers and self-catering accommodation across the Drakensberg \u2014 Northern Drakensberg, Central Drakensberg, Southern Drakensberg and Royal Natal.",
  alternates: { canonical: '/stays' },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

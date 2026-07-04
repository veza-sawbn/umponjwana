import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Stories from the Berg",
  description: "Culture, heritage, wildlife and hiking stories from the Drakensberg \u2014 written by local guides and specialists.",
  alternates: { canonical: '/mydrakensberg' },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

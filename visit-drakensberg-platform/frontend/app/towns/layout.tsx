import type { Metadata } from 'next'
import { withSocial } from '@/lib/seo'

export const metadata: Metadata = withSocial({
  title: "Towns & Villages",
  description: "Gateway towns of the Drakensberg: Bergville, Winterton, Underberg, Himeville and more, each the base for a different part of the range.",
  alternates: { canonical: '/towns' },
})

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Email Preferences',
  description: 'Unsubscribe from Visit Drakensberg emails.',
  robots: { index: false, follow: false },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

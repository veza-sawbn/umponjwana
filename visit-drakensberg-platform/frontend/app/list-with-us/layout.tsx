import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'List With Us',
  description:
    'List your Drakensberg lodge, activity, guided tour, shuttle service or experience on Visit Drakensberg. Free to apply — our team reviews every operator within two business days.',
  alternates: { canonical: '/list-with-us' },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

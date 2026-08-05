import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'List Your Property',
  description:
    'List your Drakensberg lodge, guesthouse, cottage or campsite on Visit Drakensberg. Free to apply — our team reviews every establishment within two business days.',
  alternates: { canonical: '/list-your-property' },
}

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

import type { Metadata } from 'next'
import { withSocial } from '@/lib/seo'

// page.tsx is a client component (the form), so its metadata lives here.
// Indexed and in the sitemap on purpose — see app/sitemap.ts.
export const metadata: Metadata = withSocial({
  title: 'Report a Concern',
  description:
    'Tell Visit Drakensberg about a safety, conduct or welfare concern involving a listed business. Reports can be made anonymously and are reviewed by our team.',
  alternates: { canonical: '/report-a-concern' },
})

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return children
}

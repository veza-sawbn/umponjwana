import type { Metadata } from 'next'

// This page is in the sitemap (see lib/seo-routes.ts). Without its own
// canonical it inherited `alternates: { canonical: '/' }` from the root
// layout — Next merges metadata down the segment tree — so it was submitting
// itself for indexing while telling Google it was a duplicate of the
// homepage. Every other indexable route sets its own; this one had been
// missed.
export const metadata: Metadata = {
  title: 'Report a Concern',
  description:
    'Raise a safety, conduct or accuracy concern about a business listed on Visit Drakensberg. Reports reach the platform team directly and can be made anonymously.',
  alternates: { canonical: '/report-a-concern' },
}

export default function ReportAConcernLayout({ children }: { children: React.ReactNode }) {
  return children
}

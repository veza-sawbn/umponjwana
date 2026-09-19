import type { Metadata } from 'next'

// Reached from a link in an email, with the recipient's token in the query
// string. Not disallowed in robots.ts on purpose: a crawler has to be able to
// fetch the page to read this noindex.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return children
}

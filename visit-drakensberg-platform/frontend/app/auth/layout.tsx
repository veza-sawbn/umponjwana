import type { Metadata } from 'next'

// Sign-in, registration and password flows. robots.ts disallows /auth/, but a
// disallowed URL can still be indexed URL-only when something links to it —
// Search Console reports those as "Indexed, though blocked by robots.txt".
// The noindex here is what actually keeps them out of the index if the
// disallow is ever narrowed, and it costs nothing while it stands.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}

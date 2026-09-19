import './globals.css'
import type { Metadata, Viewport } from 'next'
import AppShell from '@/components/layout/AppShell'
import JsonLd from '@/components/seo/JsonLd'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Visit Drakensberg | Book Your Mountain Escape',
    template: '%s | Visit Drakensberg',
  },
  description:
    'Discover and book stays, activities, hikes, shuttles and holiday packages in the breathtaking Drakensberg mountains of South Africa.',
  keywords: [
    'Drakensberg', 'South Africa', 'accommodation', 'hiking', 'uKhahlamba',
    'KwaZulu-Natal', 'mountain holidays', 'Tugela Falls', 'Sani Pass',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Visit Drakensberg',
    title: 'Visit Drakensberg | Book Your Mountain Escape',
    description:
      'Discover and book stays, activities, hikes, shuttles and holiday packages in the breathtaking Drakensberg mountains of South Africa.',
    url: SITE_URL,
    locale: 'en_ZA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Visit Drakensberg | Book Your Mountain Escape',
    description:
      'Discover and book stays, activities, hikes, shuttles and holiday packages in the Drakensberg mountains of South Africa.',
  },
  robots: {
    index: true,
    follow: true,
    // Explicit googleBot block: max-image-preview:large is what allows a
    // full-width photo beside the result in Google Images and Discover —
    // without it, listing photos are capped at a thumbnail. The snippet and
    // video caps are the documented defaults, restated so a future robots
    // edit has to make a deliberate choice about them.
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  // Site-ownership tokens for the search consoles. Both are optional: Next
  // omits the meta tag entirely when the variable is unset, so an unconfigured
  // environment (preview deploys, local) emits nothing rather than a broken
  // tag. Verifying the property is the step that makes the sitemap
  // submittable and indexing reportable — see
  // docs/seo-audit/SEARCH_CONSOLE_SETUP.md.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

// Two nodes in one graph rather than two loose blocks, so the WebSite can
// point at the organisation by @id instead of repeating it.
//
// The WebSite node is not decoration: Google reads it for the *site name*
// shown above a result on mobile, which otherwise gets guessed from the
// domain or the <title>. The SearchAction is honoured by other engines and
// costs one line; Google retired its sitelinks search box rich result in
// 2024, so nothing here depends on that rendering.
const SITE_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'TravelAgency',
      '@id': `${SITE_URL}/#organization`,
      name: 'Visit Drakensberg',
      url: SITE_URL,
      logo: `${SITE_URL}/logo.svg`,
      image: `${SITE_URL}/opengraph-image`,
      description:
        'Tourism discovery and booking platform for the uKhahlamba-Drakensberg Park, a UNESCO World Heritage Site.',
      areaServed: { '@type': 'Place', name: 'Drakensberg, KwaZulu-Natal, South Africa' },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'Visit Drakensberg',
      url: SITE_URL,
      inLanguage: 'en-ZA',
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <JsonLd data={SITE_JSONLD} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}

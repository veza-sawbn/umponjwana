import './globals.css'
import type { Metadata, Viewport } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import AppShell from '@/components/layout/AppShell'
import JsonLd from '@/components/seo/JsonLd'
import { DEFAULT_OG_IMAGE, SITE_NAME } from '@/lib/seo'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// Self-hosted at build time: no request to Google on page load, no
// render-blocking stylesheet, and nothing for the CSP to allow-list.
// Same families, weights and styles the old @import in globals.css loaded.
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-dm-sans',
})
const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-dm-serif',
})

// Vercel preview and branch deploys (*.vercel.app) serve the same pages as
// production. Left indexable, Google finds them through shared links and
// ranks the preview copy against the real site. Only the production deploy is
// indexable; outside Vercel (local, Render) VERCEL_ENV is unset and nothing
// changes. middleware.ts sends the matching X-Robots-Tag header.
const IS_INDEXABLE_DEPLOY = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production'

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
  // No `alternates.canonical` here on purpose: it would be inherited by every
  // page that doesn't set its own. The homepage sets '/' in app/page.tsx.
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: 'Visit Drakensberg | Book Your Mountain Escape',
    description:
      'Discover and book stays, activities, hikes, shuttles and holiday packages in the breathtaking Drakensberg mountains of South Africa.',
    url: SITE_URL,
    locale: 'en_ZA',
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Visit Drakensberg | Book Your Mountain Escape',
    description:
      'Discover and book stays, activities, hikes, shuttles and holiday packages in the Drakensberg mountains of South Africa.',
    images: [DEFAULT_OG_IMAGE.url],
  },
  // Search Console / Bing Webmaster ownership by HTML tag. Paste only the
  // token from the tag Google shows (content="…"), e.g. in Vercel's env vars.
  // DNS verification (a TXT record) works too and needs neither variable.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
  robots: IS_INDEXABLE_DEPLOY ? { index: true, follow: true } : { index: false, follow: false },
  // Icons come from the file conventions: app/icon.svg (a mountain mark that
  // stays legible at 16px, which the full wordmark in public/favicon.svg did
  // not), app/favicon.ico and app/apple-icon.tsx.
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2d6a4f',
}

const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'TravelAgency',
  name: 'Visit Drakensberg',
  url: SITE_URL,
  description:
    'Tourism discovery and booking platform for the uKhahlamba-Drakensberg Park, a UNESCO World Heritage Site.',
  areaServed: { '@type': 'Place', name: 'Drakensberg, KwaZulu-Natal, South Africa' },
}

// Names the site for Google's search results (the site name shown above the
// title), alongside the organisation block above.
const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body>
        <JsonLd data={ORG_JSONLD} />
        <JsonLd data={WEBSITE_JSONLD} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}

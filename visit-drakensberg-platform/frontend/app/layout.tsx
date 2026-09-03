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
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <JsonLd data={ORG_JSONLD} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}

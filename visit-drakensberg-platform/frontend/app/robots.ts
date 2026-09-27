import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

export default function robots(): MetadataRoute.Robots {
  // Vercel preview/branch deploys must never be crawled — they duplicate the
  // production site (see also the X-Robots-Tag header in next.config.mjs).
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/supplier/',
          '/account/',
          '/dashboard/',
          '/checkout/',
          '/api/',
          '/auth/',
          '/invoices/',
          '/itinerary/',
          '/quotes/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

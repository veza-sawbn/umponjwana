import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private surfaces only. Anything that is public but shouldn't rank
        // — /search, /trip, the experience compare/request forms, the
        // maintenance page, unsubscribe and waiver links — is handled with
        // `robots: { index: false }` in its own metadata instead, because a
        // crawler has to be allowed to fetch a page to read a noindex off it.
        // Disallowing those would leave them eligible for URL-only indexing.
        disallow: [
          '/admin/',
          '/supplier/',
          // The VD Operations working environment (delegated supplier
          // management). Auth-gated in middleware.ts like /admin and
          // /supplier, and it was the one console prefix missing here.
          '/operations/',
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
    // Read by Bing and Yandex to settle which hostname is the canonical one.
    // Google ignores it and uses the per-page canonical tags instead.
    host: SITE_URL,
  }
}

import type { Metadata } from 'next'

export const SITE_NAME = 'Visit Drakensberg'

// The generated share card (app/opengraph-image.tsx). Pages that have a photo
// of their own pass it instead; everything else falls back to this so a shared
// link never renders as a bare text card.
export const DEFAULT_OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'Visit Drakensberg: stays, hikes and experiences in the uKhahlamba-Drakensberg',
}

/**
 * Adds Open Graph and Twitter tags built from a page's own title, description
 * and canonical path.
 *
 * Next merges `openGraph` and `twitter` shallowly from the nearest layout that
 * sets them, so a page that only sets `title`/`description` used to inherit the
 * root layout's — every listing page shared on WhatsApp or Facebook previewed
 * as the homepage, with og:url pointing at the homepage too. Wrapping a page's
 * metadata in this keeps its social card in step with its <title>.
 */
export function withSocial(meta: Metadata): Metadata {
  const pageTitle = typeof meta.title === 'string' ? meta.title : undefined
  // The root layout's "%s | Visit Drakensberg" template only applies to
  // <title>, so the social title carries the site name explicitly.
  const title = pageTitle && !pageTitle.includes(SITE_NAME) ? `${pageTitle} | ${SITE_NAME}` : pageTitle
  const description = meta.description ?? undefined
  const canonical = meta.alternates?.canonical
  const url = typeof canonical === 'string' || canonical instanceof URL ? canonical : undefined

  return {
    ...meta,
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_ZA',
      title: title && { absolute: title },
      description,
      url,
      images: [DEFAULT_OG_IMAGE],
      ...meta.openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      title: title && { absolute: title },
      description,
      images: [DEFAULT_OG_IMAGE.url],
      ...meta.twitter,
    },
  }
}

/** A photo URL as an Open Graph image list, or the default share card. */
export function ogImages(image?: string | null) {
  return image ? [{ url: image }] : [DEFAULT_OG_IMAGE]
}

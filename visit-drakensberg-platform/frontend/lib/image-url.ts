/**
 * Requests a device-appropriate, modern-format rendition of a photo from
 * hosts that support on-the-fly resizing via query params, instead of
 * always shipping whatever full-size original was pasted/uploaded.
 *
 * Used by the couple of spots (the hero carousel) that manage their own
 * `<img>` src directly rather than going through next/image — everywhere
 * else next/image's own optimizer already does this automatically.
 *
 * Unsplash is the only host we rewrite: it's the one external image CDN
 * used across the catalogue (see next.config.mjs remotePatterns) and its
 * `w`/`q`/`auto=format` params are documented and stable. Supabase Storage
 * public URLs and anything else are returned unchanged — rewriting those
 * would need Storage image transformations to be enabled on the project,
 * which isn't something we can assume, and a wrong guess there would break
 * the image outright rather than just leave it unoptimized.
 */
export function optimizedImageUrl(url: string, { width, quality = 75 }: { width: number; quality?: number }): string {
  if (!url) return url
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  if (parsed.hostname !== 'images.unsplash.com' && parsed.hostname !== 'plus.unsplash.com') {
    return url
  }
  parsed.searchParams.set('w', String(Math.max(1, Math.round(width))))
  parsed.searchParams.set('q', String(quality))
  parsed.searchParams.set('auto', 'format')
  parsed.searchParams.set('fit', 'crop')
  return parsed.toString()
}

/** Viewport-aware target width, capped so a huge desktop monitor doesn't ask for an absurd render. */
export function viewportImageWidth(max = 1920): number {
  if (typeof window === 'undefined') return max
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  return Math.min(max, Math.ceil(window.innerWidth * dpr))
}

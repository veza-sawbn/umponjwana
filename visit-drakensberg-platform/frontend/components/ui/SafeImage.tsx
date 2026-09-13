import Image, { type ImageProps } from 'next/image'
import { isOptimizableImageHost } from '@/lib/image-url'

/* ────────────────────────────────────────────────────────────────────────────
 * next/image that cannot take the page down.
 *
 * next/image throws a hard render error — killing the whole page, not just
 * the one photo — for any src whose hostname isn't in next.config.mjs's
 * `images.remotePatterns`. Photos on this site are pasted or uploaded by
 * admins and suppliers, so the hosts are whatever they happen to be: live
 * content already sits on wildmanranch.com, static.wixstatic.com,
 * encrypted-tbn0.gstatic.com and others that were never allow-listed.
 *
 * So: optimize through next/image where the host is configured, and fall
 * back to a plain <img> where it isn't. An unoptimized photo is a small
 * cost; a blank page is not.
 *
 * `fill` and `sizes` behave as they do on next/image. On the fallback path
 * `fill` becomes absolute inset-0 with object-fit, so the same parent
 * (relative + a fixed aspect/height) lays both branches out identically.
 * ──────────────────────────────────────────────────────────────────────────── */

type SafeImageProps = Omit<ImageProps, 'src'> & {
  /** May be empty/undefined — nothing renders rather than a broken frame. */
  src?: string | null
}

export default function SafeImage({ src, alt, className, fill, sizes, priority, loading, style, ...rest }: SafeImageProps) {
  if (!src) return null

  if (isOptimizableImageHost(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        className={className}
        fill={fill}
        sizes={sizes}
        priority={priority}
        loading={loading}
        style={style}
        {...rest}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={typeof alt === 'string' ? alt : ''}
      // priority is next/image's preload hint; the closest plain-img
      // equivalent is simply not deferring the fetch.
      loading={priority ? 'eager' : (loading ?? 'lazy')}
      decoding="async"
      className={fill ? `absolute inset-0 w-full h-full ${className ?? ''}` : className}
      style={fill ? { objectFit: 'cover', ...style } : style}
    />
  )
}

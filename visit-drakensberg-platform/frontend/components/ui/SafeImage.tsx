'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { isOptimizableImageHost } from '@/lib/image-url'

/* ────────────────────────────────────────────────────────────────────────────
 * An <Image> that degrades instead of showing a broken frame.
 *
 * Photos here are pasted or uploaded by admins and suppliers, so their hosts
 * are whatever those people happened to use — live content already sits on
 * wildmanranch.com, static.wixstatic.com, encrypted-tbn0.gstatic.com and
 * others that were never added to next.config.mjs's `images.remotePatterns`.
 *
 * What next/image does with a host that isn't allow-listed depends on the
 * build, and it is worth being precise because the two behave nothing alike
 * (see next/dist/shared/lib/image-loader.js):
 *
 *   development — the loader throws "hostname is not configured", which takes
 *                 down the whole React tree, not just the photo.
 *   production  — the loader skips that check entirely and emits
 *                 /_next/image?url=…, and the optimizer endpoint answers 400.
 *                 The page is fine; the image is simply blank.
 *
 * So on the live site the symptom is a missing photo, not a crash. Either way
 * the cure is the same: don't send an un-allow-listed host through the
 * optimizer at all.
 *
 * Three fallbacks, in order:
 *   1. host is allow-listed  → next/image, optimized.
 *   2. host is not, or the optimizer failed anyway (400/500, a deployment
 *      whose config differs from this build) → plain <img>, unoptimized.
 *   3. that fails too — a dead link, a host refusing hotlinks → render
 *      nothing, so the parent's own placeholder or background shows through
 *      rather than a broken-image icon.
 *
 * `fill` and `sizes` behave as on next/image. On the plain-img path `fill`
 * becomes absolute inset-0 with object-fit, so the same parent (relative,
 * with a fixed aspect or height) lays every branch out identically.
 * ──────────────────────────────────────────────────────────────────────────── */

type SafeImageProps = Omit<ImageProps, 'src'> & {
  /** May be empty/undefined — nothing renders rather than a broken frame. */
  src?: string | null
}

export default function SafeImage({
  src, alt, className, fill, sizes, priority, loading, style, ...rest
}: SafeImageProps) {
  // Set once next/image fails, to retry the same URL unoptimized.
  const [optimizerFailed, setOptimizerFailed] = useState(false)
  // Set once the raw URL fails too — nothing left to try.
  const [broken, setBroken] = useState(false)

  if (!src || broken) return null

  if (isOptimizableImageHost(src) && !optimizerFailed) {
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
        onError={() => setOptimizerFailed(true)}
        {...rest}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={typeof alt === 'string' ? alt : ''}
      // priority is next/image's preload hint; the nearest plain-img
      // equivalent is simply not deferring the fetch.
      loading={priority ? 'eager' : (loading ?? 'lazy')}
      decoding="async"
      onError={() => setBroken(true)}
      className={fill ? `absolute inset-0 w-full h-full ${className ?? ''}` : className}
      style={fill ? { objectFit: 'cover', ...style } : style}
    />
  )
}

'use client'
import { useState } from 'react'

// Decorative photo for the auth split layout. Remote images can 404 or be
// blocked; rather than leave a broken-image glyph on the panel, drop the
// <img> and let the panel's own background colour carry the side. The ref
// check covers a failure that happened before hydration, when onError had
// no handler attached yet.
export default function AuthPhoto({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      ref={img => { if (img?.complete && img.naturalWidth === 0) setFailed(true) }}
      onError={() => setFailed(true)}
      className="absolute inset-0 w-full h-full object-cover"
    />
  )
}

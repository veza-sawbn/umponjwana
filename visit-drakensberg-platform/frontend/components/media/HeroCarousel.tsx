'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { optimizedImageUrl, viewportImageWidth } from '@/lib/image-url'
import { usePrefersReducedMotion } from '@/lib/carousel-autoplay'

// Shared with the homepage hero — a slow cross-fading, gently panning
// full-bleed image carousel. Renders absolutely positioned by default, so
// it drops into any `relative`+`overflow-hidden` box (the homepage hero,
// a listing's mobile photo strip, …) and fills it edge to edge.

const HERO_SLIDE_SECONDS = 7
const HERO_FADE_SECONDS = 1.5
const HERO_OVERSCALE = 1.12

export default function HeroCarousel({
  images,
  alt = '',
  className = 'absolute inset-0',
  onIndexChange,
}: {
  images: string[]
  alt?: string
  className?: string
  /** Fires with the slide index whenever it changes — lets a parent show its own "2 / 6" counter or dots in sync. */
  onIndexChange?: (index: number) => void
}) {
  const reduced = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState<Record<number, boolean>>({})
  const hasCycledRef = useRef(false)
  // Computed once per mount rather than tracked live: good enough to size
  // requests for this device, and stable so the preload effect below and
  // the rendered <img> below always agree on the same URL (same browser
  // cache entry) instead of racing a resize into a second fetch.
  const [targetWidth] = useState(() => viewportImageWidth())

  useEffect(() => {
    setIndex(0)
    hasCycledRef.current = false
    setLoaded({})
  }, [images])

  useEffect(() => { onIndexChange?.(index) }, [index, onIndexChange])

  // Preload only the slide on screen plus the one coming up next — not the
  // whole gallery at once — so slower connections aren't asked to fetch
  // every hero image up front. The interval below still feels seamless
  // because the next slide is always warmed in the background.
  useEffect(() => {
    if (images.length === 0) return
    const upcoming = [index, (index + 1) % images.length]
    upcoming.forEach(i => {
      if (loaded[i]) return
      const img = new window.Image()
      img.onload = () => setLoaded(prev => (prev[i] ? prev : { ...prev, [i]: true }))
      img.src = optimizedImageUrl(images[i], { width: targetWidth })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, images, targetWidth])

  // Advances on its own, but only while the tab is actually in front of the
  // visitor: a slideshow left running in a background tab is pure waste (it
  // decodes images nobody is looking at) and means coming back to a hero
  // half a gallery further along than where it was left.
  useEffect(() => {
    if (images.length < 2) return
    let timer: ReturnType<typeof setInterval> | undefined

    const stop = () => {
      if (timer) clearInterval(timer)
      timer = undefined
    }
    const sync = () => {
      stop()
      if (document.hidden) return
      timer = setInterval(() => {
        hasCycledRef.current = true
        setIndex(i => (i + 1) % images.length)
      }, HERO_SLIDE_SECONDS * 1000)
    }

    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [images])

  if (images.length === 0) return null

  const panFromLeft = index % 2 === 0
  const isFirstSlide = !hasCycledRef.current
  const currentLoaded = Boolean(loaded[index])

  // Reduced motion keeps the slideshow itself — there are no arrows here, so
  // stopping it would put the rest of the gallery out of reach — but drops
  // the slow ken-burns zoom and pan that carries it. The image just fades in,
  // already sitting where it belongs.
  const panStart = reduced
    ? { scale: 1, x: 0, y: 0 }
    : { scale: HERO_OVERSCALE, x: panFromLeft ? '-3%' : '3%', y: '-2%' }
  const panEnd = reduced
    ? { scale: 1, x: 0, y: 0 }
    : { scale: HERO_OVERSCALE, x: panFromLeft ? '3%' : '-3%', y: '2%' }

  return (
    <AnimatePresence>
      <motion.div
        key={index}
        className={`${className} overflow-hidden bg-slate-900`}
        initial={{ opacity: isFirstSlide ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: HERO_FADE_SECONDS, ease: 'easeInOut' }}
      >
        {/* Soft placeholder until the slide's image has actually decoded —
            avoids a blank/black flash on slower connections; the pan
            animation itself only starts once the image is ready. */}
        {!currentLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-700/60 to-slate-900/80" />
        )}
        <motion.img
          src={optimizedImageUrl(images[index], { width: targetWidth })}
          alt={alt}
          className="w-full h-full object-cover"
          fetchPriority={isFirstSlide ? 'high' : 'auto'}
          loading={isFirstSlide ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(prev => (prev[index] ? prev : { ...prev, [index]: true }))}
          initial={{ ...panStart, opacity: 0 }}
          animate={currentLoaded ? { ...panEnd, opacity: 1 } : { ...panStart, opacity: 0 }}
          transition={{
            default: { duration: HERO_SLIDE_SECONDS + HERO_FADE_SECONDS, ease: 'linear' },
            opacity: { duration: 0.6, ease: 'easeOut' },
          }}
        />
      </motion.div>
    </AnimatePresence>
  )
}

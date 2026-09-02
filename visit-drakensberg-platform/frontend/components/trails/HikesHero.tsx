'use client'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Editable from '@/components/editor/Editable'
import EditableSection from '@/components/editor/EditableSection'
import NewsletterSignup from '@/components/marketing/NewsletterSignup'
import RouteArtwork from '@/components/trails/RouteArtwork'
import { useSiteSection } from '@/lib/use-site-section'
import type { Trail } from '@/lib/trails'

// Same cadence as the homepage hero (app/page.tsx) so the two read as one
// system: a slow cross-fade with a gentle Ken Burns pan underneath.
const SLIDE_SECONDS = 7
const FADE_SECONDS = 1.5
const OVERSCALE = 1.12

// The reel is a sample, not the whole catalogue — nobody watches 160+ slides,
// and a bounded list keeps preloading cheap. Featured trails go first.
const MAX_SLIDES = 12

/**
 * /hikes hero: cycles the hero images uploaded against the trails themselves,
 * and surfaces each trail's GPX route artwork in the bottom-right corner as it
 * comes around. Falls back to the plain forest band when no trail carries an
 * image (fresh install, or trails still loading).
 */
export default function HikesHero({ trails }: { trails: Trail[] }) {
  const c = useSiteSection('hikes_page') as unknown as Record<string, string>
  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})

  const slides = [...trails]
    .filter(t => t.image)
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, MAX_SLIDES)

  // Count line is read off the published catalogue rather than hardcoded, so
  // it keeps itself honest as trails are added. Rounded down to the nearest
  // ten ("+160" at 168 trails); under ten the exact figure reads better.
  const trailCount = trails.length
  const countLabel = trailCount >= 10 ? `+${Math.floor(trailCount / 10) * 10}` : `+${trailCount}`

  useEffect(() => {
    setIndex(0)
  }, [slides.length])

  useEffect(() => {
    if (slides.length < 2) return
    const id = setInterval(() => setIndex(i => (i + 1) % slides.length), SLIDE_SECONDS * 1000)
    return () => clearInterval(id)
  }, [slides.length])

  // Warm the slide on screen plus the one coming up next — never the whole
  // reel — so the cross-fade stays seamless without a burst of requests.
  useEffect(() => {
    if (slides.length === 0) return
    for (const i of [index, (index + 1) % slides.length]) {
      const src = slides[i]?.image
      if (!src || loaded[src]) continue
      const img = new window.Image()
      img.onload = () => setLoaded(prev => (prev[src] ? prev : { ...prev, [src]: true }))
      img.src = src
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides.length])

  const current = slides[index]
  const panFromLeft = index % 2 === 0
  const currentLoaded = Boolean(current && loaded[current.image])

  return (
    <EditableSection id="hikes_page" label="Page Header" className="relative overflow-hidden bg-forest text-white">
      {current && (
        <AnimatePresence>
          <motion.div
            key={current.id}
            className="absolute inset-0 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: FADE_SECONDS, ease: 'easeInOut' }}
          >
            <motion.img
              src={current.image}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
              onLoad={() => setLoaded(prev => (prev[current.image] ? prev : { ...prev, [current.image]: true }))}
              initial={{ scale: OVERSCALE, x: panFromLeft ? '-3%' : '3%', y: '-2%' }}
              animate={{ scale: OVERSCALE, x: panFromLeft ? '3%' : '-3%', y: '2%' }}
              transition={{ duration: SLIDE_SECONDS + FADE_SECONDS, ease: 'linear' }}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Legibility wash. Directional rather than flat: the copy sits on the
          left and needs a guaranteed floor of contrast over arbitrary photos,
          while the right stays open enough for the photograph to read. */}
      <div className="absolute inset-0 bg-gradient-to-r from-forest/95 via-forest/80 to-forest/45" />

      <div className="relative max-w-[1440px] mx-auto px-6 lg:px-12 py-16 lg:py-20 min-h-[420px] flex flex-col justify-center">
        <Editable section="hikes_page" fieldKey="eyebrow" value={c.eyebrow} label="Eyebrow" type="text">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-3">{c.eyebrow}</p>
        </Editable>
        <Editable section="hikes_page" fieldKey="heading" value={c.heading} label="Heading" type="text">
          <h1 className="font-display text-5xl lg:text-6xl text-white leading-none mb-4">
            {trailCount > 0 && <span className="text-gold">{countLabel} </span>}{c.heading}
          </h1>
        </Editable>
        <Editable section="hikes_page" fieldKey="subheading" value={c.subheading} label="Subheading" type="textarea">
          <p className="font-sans text-sm text-white/60 max-w-xl">{c.subheading}</p>
        </Editable>

        <div className="mt-8 max-w-md">
          <p className="font-sans text-sm text-white/70 mb-3">
            New trails are added all the time. Join the mailing list and we’ll email you as they land.
          </p>
          <NewsletterSignup
            source="hikes_hero"
            inputId="hikes-notify-email"
            label="Email address for new trail alerts"
            buttonLabel="Notify me"
            successMessage="You’re on the list — we’ll email you as new trails are added."
            tone="dark"
          />
        </div>
      </div>

      {/* Route artwork for the slide currently on screen. Decorative and
          non-interactive, so it never competes with the signup form. */}
      {current?.analytics?.routeArtworkSvg && (
        <AnimatePresence>
          <motion.div
            key={`route-${current.id}`}
            className="pointer-events-none absolute bottom-6 right-6 hidden md:block w-56 lg:w-64"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: FADE_SECONDS, ease: 'easeInOut' }}
          >
            <RouteArtwork trail={current} tone="light" className="h-24 lg:h-28 w-full opacity-90" />
            <p className="mt-2 text-right font-sans text-[10px] tracking-[0.16em] uppercase text-white/45">
              {current.name}
            </p>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Placeholder wash until the first photo decodes, so the band never
          flashes an empty frame on a slow connection. */}
      {current && !currentLoaded && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-br from-forest to-forest/80" />
      )}
    </EditableSection>
  )
}

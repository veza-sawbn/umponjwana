'use client'

import { useCallback, useEffect, useState, type RefObject } from 'react'

/**
 * One place where every carousel on the site gets its automatic movement
 * from, so the whole page reads as a single design language: the same
 * cadence, the same glide, and — more importantly — the same rules about
 * when a reel should *stop* moving.
 *
 * A reel here always pauses when:
 *   · the visitor is using it (hover, touch, drag, wheel, keyboard focus),
 *   · it has been scrolled out of view (nothing animates off-screen),
 *   · the tab is in the background,
 *   · the visitor asked their system for reduced motion.
 *
 * Two shapes of carousel exist in the app and both are served from here:
 * Swiper-based reels (`useSwiperAutoplay`) and plain scroll-snap tracks
 * (`useAutoScrollCarousel`).
 */

/** House cadence — long enough to read a card before it moves on. */
export const CAROUSEL_AUTOPLAY_MS = 6000
/** For reels whose slides hold a block of content rather than one card. */
export const CAROUSEL_AUTOPLAY_SLOW_MS = 9000
/** Slide transition duration: a glide, not a jump. */
export const CAROUSEL_SPEED_MS = 700
/** How long a track stays put after the visitor has touched or scrolled it. */
export const CAROUSEL_RESUME_MS = 8000

/**
 * `(prefers-reduced-motion: reduce)`, read synchronously on the first client
 * render rather than in an effect — a carousel is then never configured to
 * autoplay and stopped a moment later; it simply never starts.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return reduced
}

/** The slice of a Swiper instance this module drives. */
type SwiperAutoplayInstance = {
  el?: HTMLElement | null
  autoplay?: {
    start: () => void
    stop: () => void
    /** Swiper's own flag — `start()` on an already-running autoplay stacks a second timer. */
    running?: boolean
  }
}

type SwiperAutoplayConfig = {
  delay: number
  disableOnInteraction: false
  pauseOnMouseEnter: true
  stopOnLastSlide: boolean
}

export type SwiperAutoplayProps = {
  autoplay: SwiperAutoplayConfig | false
  onSwiper: (swiper: SwiperAutoplayInstance) => void
}

/**
 * Autoplay props for a `<Swiper>` — spread them onto it alongside the
 * `Autoplay` module:
 *
 *   const autoplay = useSwiperAutoplay({ slideCount: cards.length })
 *   <Swiper modules={[Autoplay]} speed={CAROUSEL_SPEED_MS} {...autoplay}>
 *
 * Swiper handles the pause-on-interaction half itself (`pauseOnMouseEnter`,
 * plus its own background-tab handling); the effect below adds the half it
 * has no opinion about — not running while the reel is off-screen, and not
 * running at all for a visitor who asked for reduced motion.
 */
export function useSwiperAutoplay({
  slideCount,
  enabled = true,
  delayMs = CAROUSEL_AUTOPLAY_MS,
  stopOnLastSlide = false,
}: {
  /** Number of slides — a reel of one has nothing to advance to. */
  slideCount: number
  /** Escape hatch for callers with their own reason to hold still (e.g. the visual editor). */
  enabled?: boolean
  delayMs?: number
  /** Stop at the end instead of wrapping — for a genuine result set rather than a marketing reel. */
  stopOnLastSlide?: boolean
}): SwiperAutoplayProps {
  const reduced = usePrefersReducedMotion()
  const [swiper, setSwiper] = useState<SwiperAutoplayInstance | null>(null)
  const onSwiper = useCallback((instance: SwiperAutoplayInstance) => setSwiper(instance), [])
  const running = enabled && !reduced && slideCount > 1

  useEffect(() => {
    const autoplay = swiper?.autoplay
    if (!autoplay) return
    if (!running) {
      autoplay.stop()
      return
    }

    const el = swiper?.el
    if (!el || typeof IntersectionObserver === 'undefined') {
      if (!autoplay.running) autoplay.start()
      return
    }

    // Swiper starts its own autoplay at init and neither start() nor stop()
    // is idempotent — start() on a running autoplay schedules a *second*
    // timer alongside the first — so both are gated on its `running` flag.
    // The observer fires once on observe() with the current state, which is
    // exactly what's wanted: a reel that mounts off-screen stops there.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!autoplay.running) autoplay.start()
      } else if (autoplay.running) {
        autoplay.stop()
      }
    })
    observer.observe(el)
    // Only the observer is torn down here: a stopped-then-restarted autoplay
    // is handled by this effect re-running, and Swiper stops its own autoplay
    // when the instance is destroyed.
    return () => observer.disconnect()
  }, [running, swiper])

  return {
    autoplay: slideCount > 1 && {
      delay: delayMs,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
      stopOnLastSlide,
    },
    onSwiper,
  }
}

/**
 * The same automatic movement for a carousel that is a plain scroll-snap
 * track rather than a Swiper: advances it by exactly one card per tick and
 * wraps back to the start at the end. Because it moves the real scroll
 * position, swipe, arrows, dots and any scroll-driven state the caller keeps
 * all stay in sync for free — nothing here is simulated.
 */
export function useAutoScrollCarousel(
  ref: RefObject<HTMLElement | null>,
  {
    itemCount,
    enabled = true,
    delayMs = CAROUSEL_AUTOPLAY_MS,
  }: { itemCount: number; enabled?: boolean; delayMs?: number },
) {
  const reduced = usePrefersReducedMotion()
  const running = enabled && !reduced && itemCount > 1

  useEffect(() => {
    const el = ref.current
    if (!el || !running) return

    let engaged = false          // pointer is over the track, or a finger is on it
    let heldUntil = 0            // the visitor just moved it themselves
    let visible = true           // any part of the track is on screen

    const hold = () => { heldUntil = Date.now() + CAROUSEL_RESUME_MS }
    const engage = () => { engaged = true }
    const release = () => { engaged = false; hold() }

    el.addEventListener('pointerenter', engage)
    el.addEventListener('pointerleave', release)
    el.addEventListener('touchstart', engage, { passive: true })
    el.addEventListener('touchend', release, { passive: true })
    el.addEventListener('pointerdown', hold)
    el.addEventListener('wheel', hold, { passive: true })
    el.addEventListener('focusin', hold)

    let observer: IntersectionObserver | undefined
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
      observer.observe(el)
    }

    const id = setInterval(() => {
      if (engaged || !visible || document.hidden || Date.now() < heldUntil) return
      // Nothing to advance through: at this breakpoint every card already
      // fits (the `lg` grids), so the track is a row, not a carousel.
      if (el.scrollWidth <= el.clientWidth + 4) return

      // One card per tick, measured from the cards themselves so gaps,
      // breakpoint-dependent widths and edge-bleed padding all come out in
      // the wash rather than being duplicated as magic numbers here.
      const cards = Array.from(el.children) as HTMLElement[]
      if (cards.length < 2) return
      const step = Math.max(1, cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left)
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: 'smooth' })
    }, delayMs)

    return () => {
      clearInterval(id)
      observer?.disconnect()
      el.removeEventListener('pointerenter', engage)
      el.removeEventListener('pointerleave', release)
      el.removeEventListener('touchstart', engage)
      el.removeEventListener('touchend', release)
      el.removeEventListener('pointerdown', hold)
      el.removeEventListener('wheel', hold)
      el.removeEventListener('focusin', hold)
    }
  }, [ref, running, delayMs, itemCount])
}

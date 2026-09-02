'use client'

import { useEffect, useRef, useState } from 'react'
import FieldGuideLayer from './FieldGuideLayer'
import {
  SPECIMEN_TRIGGER,
  clamp,
  sceneExitProgress,
  type PublishedChapter,
  type PublishedFieldGuide,
  type PublishedLayer,
} from '@/lib/field-guide'

// ─────────────────────────────────────────────────────────────────────────────
// The public layered-scroll experience.
//
// Each specimen chapter is a tall section containing a pinned 100vh stage.
// As the reader scrolls the section, the stage stays put and the chapter's
// layers reveal one at a time, each fading up from below into the position
// the editor gave it — and then staying exactly there. A revealed layer is
// never re-animated, moved or replaced while the chapter is still on screen;
// the composition only accumulates. At the end of the pin the finished plate
// leaves as a single scene and the next specimen begins on the same paper.
//
// Scroll drives one data attribute per layer and two inline style writes per
// chapter. There is no per-frame React state, no scroll library, and nothing
// in the loop that reads layout beyond one getBoundingClientRect per chapter.
// ─────────────────────────────────────────────────────────────────────────────

/** The isolated main specimen is layer zero of its chapter: same renderer,
 *  same reveal mechanism, just a trigger early enough that it is always the
 *  first thing to arrive. */
export function specimenLayer(chapter: PublishedChapter): PublishedLayer {
  return {
    id: `${chapter.id}-specimen`,
    type: 'image',
    name: chapter.commonName,
    mediaUrl: chapter.mainMediaUrl,
    mediaWidth: chapter.mainMediaWidth,
    mediaHeight: chapter.mainMediaHeight,
    heading: null,
    text: null,
    alt: chapter.mainMediaAlt,
    x: 50,
    y: 47,
    mobileX: 50,
    mobileY: 42,
    width: 42,
    mobileWidth: 78,
    zIndex: 30,
    entranceOrder: 0,
    scrollTrigger: SPECIMEN_TRIGGER,
    floatDistance: 26,
    fadeDuration: 900,
    rotation: 0,
    opacity: 1,
    decorative: false,
  }
}

export default function LayeredFieldGuide({ guide }: { guide: PublishedFieldGuide }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    // Reduced motion gets the same composition, all at once: nothing pins,
    // nothing floats, every layer is already where it belongs.
    if (reduced) {
      root.querySelectorAll<HTMLElement>('.fg-layer, .fg-label').forEach(el => {
        el.dataset.revealed = 'true'
      })
      root.querySelectorAll<HTMLElement>('.fg-scene').forEach(el => {
        el.style.opacity = ''
        el.style.transform = ''
      })
      return
    }

    const chapters = Array.from(root.querySelectorAll<HTMLElement>('[data-fg-chapter]'))
    let frame = 0

    const update = () => {
      frame = 0

      // Read pass. How far through this chapter's pinned run the reader is:
      // the pin lasts (section height - pin height), and the pin is a
      // viewport minus the fixed navbar, so it is measured rather than
      // assumed. Every measurement happens before any write, so three
      // chapters cannot force a layout flush against each other.
      const measured = chapters.map(section => {
        const rect = section.getBoundingClientRect()
        const pin = section.querySelector<HTMLElement>('.fg-pin')
        const span = Math.max(1, rect.height - (pin?.offsetHeight ?? window.innerHeight))
        return { section, progress: clamp(-rect.top / span, 0, 1) }
      })

      for (const { section, progress } of measured) {
        const reveal = section.querySelectorAll<HTMLElement>('[data-fg-trigger]')
        for (const el of reveal) {
          const trigger = Number(el.dataset.fgTrigger)
          const shown = progress >= trigger ? 'true' : 'false'
          // Write only on a real change: a scroll through a settled chapter
          // must not touch the DOM at all.
          if (el.dataset.revealed !== shown) el.dataset.revealed = shown
        }

        const scene = section.querySelector<HTMLElement>('.fg-scene')
        if (scene) {
          const exit = sceneExitProgress(progress)
          if (exit === 0) {
            if (scene.style.opacity !== '') {
              scene.style.opacity = ''
              scene.style.transform = ''
            }
          } else {
            // The whole finished plate leaves together — one transform on the
            // scene wrapper, never a per-layer animation, so nothing inside
            // it appears to drift independently.
            scene.style.opacity = String(1 - exit)
            scene.style.transform = `translate3d(0, ${(-exit * 7).toFixed(2)}vh, 0) scale(${(1 - exit * 0.05).toFixed(4)})`
          }
        }
      }
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [reduced, guide])

  const { page, chapters } = guide

  return (
    <div ref={rootRef} className={reduced ? 'fg-reduced relative' : 'relative'}>
      {/*
        globals.css locks the site to the device width with
        `html, body { overflow-x: hidden }`. On body that makes a scroll
        container, and a scroll container disables `position: sticky` for
        everything inside it — the pinned stage below would scroll away with
        the page and every chapter would render as blank paper.

        `overflow-x: clip` clips exactly the same overflow without creating
        that scroll container, which is what the property exists for. Scoped
        to this page (the tag is server-rendered, so there is no first-paint
        flash, and React removes it on navigation away) rather than changed
        site-wide; on a browser too old for `clip` the declaration is simply
        invalid and the global `hidden` still applies.
      */}
      <style dangerouslySetInnerHTML={{ __html: 'html,body{overflow-x:clip}' }} />

      {/* Continuous paper. One element for the whole guide, fixed to the
          viewport, so it neither scrolls nor breaks between chapters. */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundColor: page.backgroundColor,
          backgroundImage: page.backgroundUrl ? `url(${page.backgroundUrl})` : undefined,
          backgroundRepeat: 'repeat',
          backgroundSize: '420px 420px',
        }}
      />

      <div className="relative z-10">
        {/* Guide opening */}
        <header className="min-h-[62vh] flex items-end px-6 lg:px-12 pt-28 pb-16 max-w-[1440px] mx-auto">
          <div className="max-w-2xl">
            <p className="font-sans text-[10px] tracking-[0.22em] uppercase text-[#2B2418]/45 mb-4">
              Field Guide
            </p>
            <h1 className="font-display italic text-4xl md:text-6xl leading-[1.05] text-[#2B2418]">
              {page.title}
            </h1>
            {page.intro && (
              <p className="mt-6 font-sans text-[15px] md:text-base leading-[1.75] text-[#2B2418]/70">
                {page.intro}
              </p>
            )}
            <p className="mt-10 font-sans text-[10px] tracking-[0.2em] uppercase text-[#2B2418]/35">
              {chapters.length} {chapters.length === 1 ? 'specimen' : 'specimens'} · scroll to draw
            </p>
          </div>
        </header>

        {chapters.map((chapter, index) => (
          <ChapterScene key={chapter.id} chapter={chapter} first={index === 0} />
        ))}
      </div>
    </div>
  )
}

function ChapterScene({ chapter, first }: { chapter: PublishedChapter; first: boolean }) {
  const specimen = specimenLayer(chapter)
  const headingId = `fg-${chapter.id}-name`

  return (
    <section aria-labelledby={headingId}>
      {/* The pinned run. Its height is the chapter's scroll length; the stage
          inside it stays in the viewport for all of it. */}
      <div
        data-fg-chapter
        className="fg-chapter relative"
        style={{ height: `${chapter.scrollLength}vh` }}
      >
        <div className="fg-pin sticky top-16 h-[calc(100vh-4rem)]">
          <div className="fg-stage h-full max-w-[1440px] mx-auto">
            <div className="fg-scene">
              <h2 className="fg-label" data-fg-trigger={SPECIMEN_TRIGGER} id={headingId}>
                {chapter.category && (
                  <span className="block font-sans text-[9px] md:text-[10px] tracking-[0.22em] uppercase text-[#2B2418]/40 mb-2">
                    {chapter.category}
                  </span>
                )}
                <span className="block font-display italic text-2xl md:text-4xl leading-[1.1] text-[#2B2418]">
                  {chapter.commonName}
                </span>
                {chapter.scientificName && (
                  <span className="block mt-1.5 font-display italic text-[13px] md:text-[15px] text-[#2B2418]/50">
                    {chapter.scientificName}
                  </span>
                )}
              </h2>

              {specimen.mediaUrl && (
                <FieldGuideLayer layer={specimen} revealed={false} eager={first} trigger={specimen.scrollTrigger} />
              )}

              {chapter.layers.map(layer => (
                <FieldGuideLayer key={layer.id} layer={layer} revealed={false} trigger={layer.scrollTrigger} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* The written record. Flows normally under the plate, the way a field
          guide sets its text on the facing page — readable at any width, and
          the part of the chapter that is actually indexable. */}
      <div className="relative max-w-[1440px] mx-auto px-6 lg:px-12 pb-28">
        <div className="max-w-3xl border-t border-[#2B2418]/12 pt-8">
          {chapter.accessibleDescription && (
            <p className="sr-only">Plate description: {chapter.accessibleDescription}</p>
          )}
          {chapter.description && (
            <p className="font-display text-[17px] md:text-[21px] leading-[1.65] text-[#2B2418]/85">
              {chapter.description}
            </p>
          )}
          <dl className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
            <Record label="Habitat" value={chapter.habitat} />
            <Record label="Elevation" value={chapter.elevation} />
            <Record label="When to look" value={chapter.season} />
            <Record label="Where" value={chapter.locality} />
          </dl>
        </div>
      </div>
    </section>
  )
}

function Record({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="font-sans text-[9px] tracking-[0.2em] uppercase text-[#2B2418]/40 mb-1.5">{label}</dt>
      <dd className="font-sans text-[13px] leading-[1.55] text-[#2B2418]/75">{value}</dd>
    </div>
  )
}

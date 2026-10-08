'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useReducedMotion, useScroll, useTransform, type Variants } from 'framer-motion'
import { ArrowDown, Bus, Car, Clock, MapPin, QrCode, Ticket, CalendarDays, ChevronRight } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import type { Activity } from '@/lib/activities'
import {
  GRAND_TOUR_STAGES, stagesForActivity, highlightById, pickupTime, allPickupNames, dayTourHref, upcomingDepartures,
  type GrandTourStage,
} from '@/lib/grand-tour'
import { formatMoney } from '@/lib/allocation'
import { ease } from '@/lib/motion'

// ─── Grand Tour Drakensberg ──────────────────────────────────────────────────
// An itinerary the visitor reads by scrolling: each stage arrives as a
// full-bleed scene, its highlights fade up one after another, and the day
// tours that visit it follow, bookable by the seat with a hotel pickup. A
// route rail on the left fills as the reader travels north to south.
//
// Motion is decoration, never content: with prefers-reduced-motion every
// element renders in place, and nothing is hidden from a reader (or crawler)
// that never scrolls it into view for longer than the fade itself.

const reveal: Variants = {
  hidden: { opacity: 0, y: 36 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: ease.out } },
}
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
}

const TOTAL_HIGHLIGHTS = GRAND_TOUR_STAGES.reduce((n, s) => n + s.highlights.length, 0)
/** Something else already bookable at a stage — a guided tour or activity
 *  from the live catalogue — shown while no Grand Tour day tour covers it. */
export type RelatedProduct = {
  id: string
  kind: 'Guided tour' | 'Activity'
  name: string
  href: string
  image?: string
  price?: number
  detail?: string
}

const shortDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })

export default function GrandTourExperience({ tours, related = {} }: { tours: Activity[]; related?: Record<string, RelatedProduct[]> }) {
  const reduce = useReducedMotion()
  const [hotel, setHotel] = useState('')
  const [activeStage, setActiveStage] = useState(GRAND_TOUR_STAGES[0].id)
  const routeRef = useRef<HTMLDivElement>(null)

  // Remember the visitor's hotel across visits — a convenience only.
  useEffect(() => {
    try { const saved = localStorage.getItem('vd-grand-tour-hotel'); if (saved) setHotel(saved) } catch {}
  }, [])
  function chooseHotel(name: string) {
    setHotel(name)
    try { name ? localStorage.setItem('vd-grand-tour-hotel', name) : localStorage.removeItem('vd-grand-tour-hotel') } catch {}
  }

  const hotels = useMemo(() => allPickupNames(tours), [tours])
  const visibleTours = useMemo(
    () => (hotel ? tours.filter(t => t.grandTour?.pickupPoints.some(p => p.name.trim() === hotel)) : tours),
    [tours, hotel],
  )
  const toursByStage = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const t of visibleTours) for (const s of stagesForActivity(t)) map.set(s.id, [...(map.get(s.id) ?? []), t])
    return map
  }, [visibleTours])

  // Which stage is on screen, for the route rail.
  useEffect(() => {
    const els = GRAND_TOUR_STAGES.map(s => document.getElementById(`stage-${s.id}`)).filter((e): e is HTMLElement => !!e)
    const io = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActiveStage(visible.target.id.replace('stage-', ''))
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.25, 0.5] },
    )
    els.forEach(e => io.observe(e))
    return () => io.disconnect()
  }, [])

  const { scrollYProgress } = useScroll({ target: routeRef, offset: ['start center', 'end center'] })

  return (
    <div className="bg-[#F7F5F2] text-black">
      <Hero reduce={!!reduce} tourCount={tours.length} />

      {/* ── Intro and hotel filter ─────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-12 py-20 sm:py-28">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial={reduce ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={stagger}
        >
          <motion.p variants={reveal} className="font-sans text-[11px] tracking-[0.28em] uppercase text-[#C9A96E] mb-5">The route</motion.p>
          <motion.h2 variants={reveal} className="font-display italic text-3xl sm:text-5xl leading-tight">
            A wall of basalt from horizon to horizon, one stage at a time.
          </motion.h2>
          <motion.p variants={reveal} className="font-sans text-base sm:text-lg text-black/60 mt-6 leading-relaxed">
            The Grand Tour follows the uKhahlamba-Drakensberg, a UNESCO World Heritage Site, from the Amphitheatre in the north to
            Garden Castle in the south. Drive it yourself, or join a day tour at any stage. Many collect you from your hotel, so
            you can explore the Southern Berg while staying in Champagne Valley.
          </motion.p>
        </motion.div>

        <motion.div
          className="max-w-3xl mx-auto mt-12 bg-white border border-black/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4"
          initial={reduce ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.6 }} variants={reveal}
        >
          <div className="flex items-center gap-3 sm:flex-1">
            <Bus size={20} className="text-[#2d6a4f] shrink-0" />
            <div>
              <p className="font-sans text-sm font-medium">Staying in the Berg?</p>
              <p className="font-sans text-xs text-black/50">Show only the day tours that collect guests from your hotel.</p>
            </div>
          </div>
          <label className="sr-only" htmlFor="gt-hotel">Your hotel</label>
          <select
            id="gt-hotel"
            value={hotel}
            onChange={e => chooseHotel(e.target.value)}
            disabled={hotels.length === 0}
            className="w-full sm:w-72 border border-black/20 bg-white px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] disabled:opacity-50"
          >
            <option value="">{hotels.length === 0 ? 'Hotel pickups coming soon' : 'Any hotel'}</option>
            {hotels.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </motion.div>

        {/* Every bookable day tour, up front: a visitor who already knows
            they want the Sani Pass should not have to scroll six stages. */}
        {visibleTours.length > 0 && (
          <div id="day-tours" className="max-w-6xl mx-auto mt-16 scroll-mt-24">
            <motion.div
              className="flex items-end justify-between gap-4 mb-6"
              initial={reduce ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.8 }} variants={reveal}
            >
              <h2 className="font-display italic text-3xl">Book a day tour</h2>
              <p className="font-sans text-xs text-black/50">{visibleTours.length} tour{visibleTours.length === 1 ? '' : 's'}{hotel ? ` from ${hotel}` : ''}</p>
            </motion.div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visibleTours.map(t => <TourCard key={t.id} tour={t} hotel={hotel} reduce={!!reduce} />)}
            </div>
          </div>
        )}
      </section>

      {/* ── The route ──────────────────────────────────────────────────── */}
      <div ref={routeRef} className="relative">
        <RouteRail progress={scrollYProgress} active={activeStage} reduce={!!reduce} />
        <MobileStageBar progress={scrollYProgress} active={activeStage} />

        {GRAND_TOUR_STAGES.map((stage, i) => (
          <div key={stage.id}>
            {stage.legFromPrevious && <Leg text={stage.legFromPrevious} reduce={!!reduce} />}
            <StageScene
              stage={stage}
              reduce={!!reduce}
              tours={toursByStage.get(stage.id) ?? []}
              related={related[stage.id] ?? []}
              hotel={hotel}
              flip={i % 2 === 1}
            />
          </div>
        ))}
      </div>

      <HowItWorks reduce={!!reduce} />
      <Footer />
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ reduce, tourCount }: { reduce: boolean; tourCount: number }) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const imgY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '18%'])
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, reduce ? 1 : 0])
  const textY = useTransform(scrollYProgress, [0, 0.6], ['0%', reduce ? '0%' : '-12%'])

  return (
    <section ref={ref} className="relative h-[calc(100svh-4rem)] min-h-[540px] mt-16 overflow-hidden bg-black">
      <motion.div className="absolute inset-0" style={{ y: imgY }}>
        <motion.div
          className="absolute inset-0"
          initial={reduce ? false : { scale: 1.12 }}
          animate={{ scale: 1 }}
          transition={{ duration: 6, ease: ease.out }}
        >
          <Image src={GRAND_TOUR_STAGES[0].image} alt="The Amphitheatre in the Northern Drakensberg" fill priority sizes="100vw" className="object-cover" />
        </motion.div>
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/70" />

      <motion.div className="relative h-full flex flex-col justify-end px-4 sm:px-6 lg:px-12 pb-16 sm:pb-24" style={{ opacity: textOpacity, y: textY }}>
        <div className="max-w-[1440px] mx-auto w-full text-white">
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
            className="font-sans text-[11px] sm:text-xs tracking-[0.32em] uppercase text-[#C9A96E] mb-4"
          >
            North to south · {GRAND_TOUR_STAGES.length} stages · {TOTAL_HIGHLIGHTS} highlights
          </motion.p>
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.45 }}
            className="font-display italic text-5xl sm:text-7xl lg:text-8xl leading-[0.95]"
          >
            Grand Tour<br />Drakensberg
          </motion.h1>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.7 }}
            className="font-sans text-base sm:text-xl text-white/80 max-w-xl mt-6"
          >
            An itinerary along the Dragon&apos;s back, with {tourCount > 0 ? `${tourCount} day tour${tourCount === 1 ? '' : 's'}` : 'day tours'} you
            can join from your hotel.
          </motion.p>
          {tourCount > 0 && (
            <motion.a
              href="#day-tours"
              initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.9 }}
              className="inline-flex items-center gap-2 mt-8 mr-6 bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm font-medium hover:bg-[#235a3f]"
            >
              <Ticket size={15} /> Book a day tour
            </motion.a>
          )}
          <motion.a
            href="#stage-royal-natal"
            initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 1.1 }}
            className="inline-flex items-center gap-2 mt-10 font-sans text-sm text-white/80 hover:text-white"
          >
            <motion.span animate={reduce ? undefined : { y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
              <ArrowDown size={16} />
            </motion.span>
            Begin the journey
          </motion.a>
        </div>
      </motion.div>
    </section>
  )
}

// ─── Route rail (desktop) and stage bar (mobile) ─────────────────────────────
function RouteRail({ progress, active, reduce }: { progress: ReturnType<typeof useScroll>['scrollYProgress']; active: string; reduce: boolean }) {
  const scaleY = useTransform(progress, [0, 1], [0, 1])
  return (
    <nav aria-label="Grand Tour stages" className="hidden lg:block absolute inset-y-0 left-6 xl:left-10 z-20 pointer-events-none">
      <div className="sticky top-28 pointer-events-auto">
        <div className="relative pl-5">
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-black/15" />
          <motion.div className="absolute left-[5px] top-2 bottom-2 w-px bg-[#2d6a4f] origin-top" style={{ scaleY: reduce ? 1 : scaleY }} />
          <ol className="space-y-5">
            {GRAND_TOUR_STAGES.map(s => {
              const on = s.id === active
              return (
                <li key={s.id} className="relative">
                  <span className={`absolute -left-5 top-1.5 w-[11px] h-[11px] rounded-full border-2 transition-colors duration-500 ${on ? 'bg-[#2d6a4f] border-[#2d6a4f]' : 'bg-[#F7F5F2] border-black/25'}`} />
                  <a href={`#stage-${s.id}`} className={`block font-sans text-[11px] leading-tight transition-colors duration-500 ${on ? 'text-black' : 'text-black/35 hover:text-black/70'}`}>
                    <span className="tabular-nums">{String(s.number).padStart(2, '0')}</span>
                    <span className={`block max-w-[8.5rem] transition-all duration-500 ${on ? 'opacity-100' : 'opacity-0 xl:opacity-100'}`}>{s.name}</span>
                  </a>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </nav>
  )
}

function MobileStageBar({ progress, active }: { progress: ReturnType<typeof useScroll>['scrollYProgress']; active: string }) {
  const scaleX = useTransform(progress, [0, 1], [0, 1])
  const stage = GRAND_TOUR_STAGES.find(s => s.id === active) ?? GRAND_TOUR_STAGES[0]
  return (
    <div className="lg:hidden sticky top-16 z-20 bg-[#F7F5F2]/95 backdrop-blur border-b border-black/10">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 font-sans text-xs">
        <span className="text-black/45 tabular-nums">Stage {stage.number} of {GRAND_TOUR_STAGES.length}</span>
        <span className="font-medium truncate">{stage.name}</span>
      </div>
      <motion.div className="h-0.5 bg-[#2d6a4f] origin-left" style={{ scaleX }} />
    </div>
  )
}

function Leg({ text, reduce }: { text: string; reduce: boolean }) {
  return (
    <motion.div
      className="flex flex-col items-center py-10 sm:py-14 text-black/45"
      initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 1 }} transition={{ duration: 0.8 }}
    >
      <span className="w-px h-10 bg-gradient-to-b from-transparent to-black/25" />
      <span className="font-sans text-[11px] tracking-[0.2em] uppercase flex items-center gap-2 my-3"><Car size={13} /> {text}</span>
      <span className="w-px h-10 bg-gradient-to-b from-black/25 to-transparent" />
    </motion.div>
  )
}

// ─── A stage ──────────────────────────────────────────────────────────────────
function StageScene({ stage, tours, related, hotel, reduce, flip }: { stage: GrandTourStage; tours: Activity[]; related: RelatedProduct[]; hotel: string; reduce: boolean; flip: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const imgY = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['-8%', '8%'])

  return (
    <section id={`stage-${stage.id}`} ref={ref} className="scroll-mt-28 lg:pl-48 xl:pl-56">
      {/* Scene */}
      <div className="relative h-[72svh] min-h-[460px] overflow-hidden bg-black">
        <motion.div className="absolute -inset-y-[10%] inset-x-0" style={{ y: imgY }}>
          <Image src={stage.image} alt={stage.name} fill sizes="(min-width: 1024px) 85vw, 100vw" className="object-cover" />
        </motion.div>
        <div className={`absolute inset-0 ${flip ? 'bg-gradient-to-l' : 'bg-gradient-to-r'} from-black/70 via-black/30 to-transparent`} />
        <motion.div
          className={`relative h-full flex flex-col justify-end px-5 sm:px-10 pb-12 sm:pb-16 max-w-2xl text-white ${flip ? 'ml-auto text-right items-end' : ''}`}
          initial={reduce ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.45 }} variants={stagger}
        >
          <motion.span variants={reveal} className="font-display italic text-7xl sm:text-9xl leading-none text-white/25 tabular-nums">
            {String(stage.number).padStart(2, '0')}
          </motion.span>
          <motion.p variants={reveal} className="font-sans text-[11px] tracking-[0.28em] uppercase text-[#C9A96E] mt-2">
            {stage.area} · {stage.kicker}
          </motion.p>
          <motion.h2 variants={reveal} className="font-display italic text-4xl sm:text-6xl leading-tight mt-2">{stage.name}</motion.h2>
          <motion.p variants={reveal} className="font-sans text-sm sm:text-base text-white/80 mt-4 leading-relaxed">{stage.intro}</motion.p>
        </motion.div>
      </div>

      {/* Highlights */}
      <div className="px-4 sm:px-6 lg:px-10 py-14 sm:py-20">
        <motion.ol
          className="max-w-5xl grid gap-x-10 gap-y-12 sm:grid-cols-2"
          initial={reduce ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger}
        >
          {stage.highlights.map((h, i) => (
            <motion.li key={h.id} variants={reveal} className="relative pl-12">
              <span className="absolute left-0 top-0 font-display italic text-3xl text-[#C9A96E] tabular-nums">{stage.number}.{i + 1}</span>
              <h3 className="font-display italic text-2xl">{h.name}</h3>
              {h.fact && <p className="inline-block mt-2 font-sans text-[11px] tracking-[0.12em] uppercase text-[#2d6a4f] border border-[#2d6a4f]/30 px-2 py-0.5">{h.fact}</p>}
              <p className="font-sans text-sm text-black/65 mt-3 leading-relaxed">{h.blurb}</p>
            </motion.li>
          ))}
        </motion.ol>

        {/* Day tours */}
        <div className="max-w-5xl mt-16">
          <motion.div
            className="flex items-end justify-between gap-4 mb-6 border-b border-black/10 pb-3"
            initial={reduce ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.8 }} variants={reveal}
          >
            <h3 className="font-sans text-[11px] tracking-[0.24em] uppercase text-black/55">Day tours to {stage.name}</h3>
            <Link href={`/regions/${stage.regionSlug}`} className="font-sans text-xs text-[#2d6a4f] hover:underline flex items-center gap-1 shrink-0">
              Explore the {stage.area.split(' ')[0]} Berg <ChevronRight size={12} />
            </Link>
          </motion.div>
          {tours.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2">
              {tours.map(t => <TourCard key={t.id} tour={t} hotel={hotel} reduce={reduce} highlightStage={stage.id} />)}
            </div>
          ) : (
            <>
              <p className="font-sans text-sm text-black/50 mb-6">
                {hotel
                  ? `No day tours collect from ${hotel} for this stage yet. Choose “Any hotel” above to see every tour.`
                  : related.length > 0
                    ? 'No scheduled day tour runs to this stage yet. You can still book these here:'
                    : 'No scheduled day tour runs to this stage yet.'}
              </p>
              {!hotel && related.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {related.map(p => <RelatedCard key={p.id} product={p} reduce={reduce} />)}
                </div>
              )}
              {!hotel && related.length === 0 && (
                <Link href={`/regions/${stage.regionSlug}`} className="inline-flex items-center gap-2 border border-black/20 px-5 py-2.5 font-sans text-sm hover:border-black/60">
                  See what to book in the {stage.area} <ChevronRight size={14} />
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── A bookable day tour ─────────────────────────────────────────────────────
function TourCard({ tour, hotel, reduce, highlightStage }: { tour: Activity; hotel: string; reduce: boolean; highlightStage?: string }) {
  const gt = tour.grandTour!
  const href = dayTourHref(tour)
  const pickup = hotel ? gt.pickupPoints.find(p => p.name.trim() === hotel) : undefined
  const departures = useMemo(() => upcomingDepartures(tour, { days: 21, limit: 3 }), [tour])
  const visits = gt.highlightIds
    .map(id => ({ id, h: highlightById(id) }))
    .filter((x): x is { id: string; h: NonNullable<ReturnType<typeof highlightById>> } => !!x.h)
  const duration = [tour.durationH ? `${tour.durationH} h` : '', tour.durationM ? `${tour.durationM} min` : ''].filter(Boolean).join(' ')
  const link = (date?: string) => {
    const q = new URLSearchParams()
    if (date) q.set('date', date)
    if (pickup) q.set('pickup', pickup.id)
    const s = q.toString()
    return s ? `${href}?${s}` : href
  }

  return (
    <motion.article
      className="bg-white border border-black/10 flex flex-col"
      initial={reduce ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={reveal}
    >
      {tour.photos?.[0] && (
        <Link href={link()} className="relative block aspect-[16/9] overflow-hidden group" tabIndex={-1} aria-hidden="true">
          <Image src={tour.photos[0]} alt="" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
        </Link>
      )}
      <div className="p-5 sm:p-6 flex flex-col flex-1">
        <p className="font-sans text-[10px] tracking-[0.18em] uppercase text-black/45">
          {tour.supplierName}{gt.departsFrom ? ` · Departs ${gt.departsFrom}` : ''}
        </p>
        <h4 className="font-display italic text-2xl mt-1.5">
          <Link href={link()} className="hover:text-[#2d6a4f]">{tour.name}</Link>
        </h4>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 font-sans text-xs text-black/55">
          {duration && <span className="flex items-center gap-1"><Clock size={12} />{duration}</span>}
          {tour.region && <span className="flex items-center gap-1"><MapPin size={12} />{tour.region}</span>}
          {gt.pickupPoints.length > 0 && <span className="flex items-center gap-1"><Bus size={12} />{gt.pickupPoints.length} hotel pickup{gt.pickupPoints.length === 1 ? '' : 's'}</span>}
        </div>
        {visits.length > 0 && (
          <p className="font-sans text-xs text-black/55 mt-3">
            Visits{' '}
            {visits.map((v, i) => (
              <span key={v.id}>
                <span className={highlightStage && GRAND_TOUR_STAGES.find(s => s.id === highlightStage)?.highlights.some(h => h.id === v.id) ? 'text-black font-medium' : ''}>{v.h.name}</span>
                {i < visits.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        )}

        {pickup && departures[0] && (
          <p className="mt-4 bg-[#2d6a4f]/5 border-l-2 border-[#2d6a4f] px-3 py-2 font-sans text-xs text-black/75">
            Collected from <strong>{pickup.name}</strong> at {pickupTime(departures[0], pickup)} on departure days
          </p>
        )}

        <div className="mt-5">
          <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-black/40 mb-2 flex items-center gap-1.5"><CalendarDays size={11} /> Next departures</p>
          {departures.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {departures.map(d => (
                <Link
                  key={`${d.date}-${d.timeslotId}`}
                  href={link(d.date)}
                  className="font-sans text-xs border border-black/15 px-2.5 py-1.5 hover:border-[#2d6a4f] hover:text-[#2d6a4f]"
                >
                  {shortDate(d.date)} · {d.time}
                  <span className="text-black/40"> · {d.seatsLeft} left</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="font-sans text-xs text-black/45">No seats in the next three weeks. Check later dates on the tour page.</p>
          )}
        </div>

        <div className="mt-auto pt-6 flex items-end justify-between gap-4">
          <p className="font-sans text-xs text-black/45">
            From <span className="font-display italic text-2xl text-[#2d6a4f]">{formatMoney(tour.pricePerPerson)}</span> per seat
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={link()} className="font-sans text-sm px-3 py-2.5 text-black/70 hover:text-black underline-offset-4 hover:underline whitespace-nowrap">View tour</Link>
            <Link href={`${link(departures[0]?.date)}#book`} className="bg-[#2d6a4f] text-white font-sans text-sm px-5 py-2.5 hover:bg-[#235a3f] transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <Ticket size={14} /> Book seats
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

// ─── Something else bookable at a stage ──────────────────────────────────────
function RelatedCard({ product, reduce }: { product: RelatedProduct; reduce: boolean }) {
  return (
    <motion.div initial={reduce ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={reveal}>
      <Link href={product.href} className="group bg-white border border-black/10 hover:border-black/30 flex items-stretch transition-colors h-full">
        {product.image && (
          <div className="relative w-28 shrink-0 overflow-hidden">
            <Image src={product.image} alt="" fill sizes="112px" className="object-cover transition-transform duration-700 group-hover:scale-105" />
          </div>
        )}
        <div className="p-4 flex-1 min-w-0">
          <p className="font-sans text-[10px] tracking-[0.18em] uppercase text-black/45">{product.kind}{product.detail ? ` · ${product.detail}` : ''}</p>
          <p className="font-display italic text-xl mt-1 group-hover:text-[#2d6a4f]">{product.name}</p>
          <p className="font-sans text-xs text-black/55 mt-2 flex items-center justify-between gap-2">
            <span>{product.price ? <>From <span className="text-[#2d6a4f] font-medium">{formatMoney(product.price)}</span> pp</> : 'See prices and dates'}</span>
            <span className="text-[#2d6a4f] flex items-center gap-0.5 whitespace-nowrap">Book <ChevronRight size={12} /></span>
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────
function HowItWorks({ reduce }: { reduce: boolean }) {
  const steps = [
    { icon: CalendarDays, title: 'Choose a departure', text: 'Pick a day tour, a date and the hotel you’re staying at. Seats are held while you check out.' },
    { icon: Ticket, title: 'Get your tickets', text: 'Once payment clears, every seat gets its own QR ticket in My Tickets and in your receipt email.' },
    { icon: QrCode, title: 'Scan and board', text: 'Be at reception for your pickup time. Your operator scans each ticket before the bus leaves.' },
  ]
  return (
    <section className="bg-[#000000] text-white px-4 sm:px-6 lg:px-12 py-20 sm:py-28 mt-10">
      <motion.div
        className="max-w-5xl mx-auto"
        initial={reduce ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger}
      >
        <motion.p variants={reveal} className="font-sans text-[11px] tracking-[0.28em] uppercase text-[#C9A96E] mb-4">How booking works</motion.p>
        <motion.h2 variants={reveal} className="font-display italic text-3xl sm:text-5xl">From your hotel to the escarpment</motion.h2>
        <div className="grid gap-10 sm:grid-cols-3 mt-14">
          {steps.map((s, i) => (
            <motion.div key={s.title} variants={reveal}>
              <s.icon size={22} className="text-[#C9A96E]" />
              <p className="font-sans text-[11px] tracking-[0.2em] uppercase text-white/40 mt-5">Step {i + 1}</p>
              <h3 className="font-display italic text-2xl mt-1">{s.title}</h3>
              <p className="font-sans text-sm text-white/65 mt-3 leading-relaxed">{s.text}</p>
            </motion.div>
          ))}
        </div>
        <motion.div variants={reveal} className="mt-16 pt-8 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="font-sans text-sm text-white/65">Run day tours in the Drakensberg? List them on the Grand Tour from your supplier dashboard.</p>
          <Link href="/list-with-us" className="font-sans text-sm border border-white/40 px-5 py-2.5 hover:bg-white hover:text-black transition-colors text-center">
            List your day tour
          </Link>
        </motion.div>
      </motion.div>
    </section>
  )
}

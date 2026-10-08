'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { ArrowLeft, Bus, Clock, MapPin, Users, CheckCircle, ShieldCheck, Shirt, Mountain, Flag } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import type { Activity } from '@/lib/activities'
import { highlightById, stageForHighlight, stagesForActivity, pickupTime, upcomingDepartures, GRAND_TOUR_STAGES } from '@/lib/grand-tour'
import { formatMoney } from '@/lib/allocation'
import { ease } from '@/lib/motion'
import DayTourBooking from './DayTourBooking'

const reveal: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: ease.out } },
}
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } }

export default function DayTourDetail({ tour, bookable }: { tour: Activity; bookable: boolean }) {
  const reduce = useReducedMotion()
  const gt = tour.grandTour
  const stages = stagesForActivity(tour)
  const hero = tour.photos?.[0] || stages[0]?.image || GRAND_TOUR_STAGES[0].image
  const stops = (gt?.highlightIds ?? [])
    .map(id => ({ id, h: highlightById(id), stage: stageForHighlight(id) }))
    .filter(s => s.h && s.stage)
  const pickups = gt?.pickupPoints ?? []
  const firstDeparture = (tour.timeslots ?? []).slice().sort((a, b) => a.time.localeCompare(b.time))[0]
  const next = upcomingDepartures(tour, { limit: 1 })[0]
  const duration = [tour.durationH ? `${tour.durationH} h` : '', tour.durationM ? `${tour.durationM} min` : ''].filter(Boolean).join(' ')
  const anim = (v: Variants = reveal) => (reduce ? {} : { initial: 'hidden' as const, whileInView: 'show' as const, viewport: { once: true, amount: 0.25 }, variants: v })

  return (
    <div className="bg-[#F7F5F2] text-black">
      {/* Hero */}
      <section className="relative h-[62svh] min-h-[440px] mt-16 overflow-hidden bg-black">
        <motion.div className="absolute inset-0" initial={reduce ? false : { scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 5, ease: ease.out }}>
          <Image src={hero} alt={tour.name} fill priority sizes="100vw" className="object-cover" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
        <div className="relative h-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 flex flex-col justify-between py-8 text-white">
          <Link href="/grand-tour" className="inline-flex items-center gap-2 text-white/70 hover:text-white font-sans text-sm w-fit">
            <ArrowLeft size={15} /> Grand Tour Drakensberg
          </Link>
          <motion.div initial={reduce ? false : 'hidden'} animate="show" variants={stagger} className="max-w-3xl">
            <motion.p variants={reveal} className="font-sans text-[11px] tracking-[0.28em] uppercase text-[#C9A96E]">
              Day tour{gt?.departsFrom ? ` · departs ${gt.departsFrom}` : ''}{stages.length ? ` · ${stages.map(s => s.name).join(' → ')}` : ''}
            </motion.p>
            <motion.h1 variants={reveal} className="font-display italic text-4xl sm:text-6xl leading-tight mt-3">{tour.name}</motion.h1>
            <motion.div variants={reveal} className="flex flex-wrap gap-x-6 gap-y-2 mt-5 font-sans text-sm text-white/80">
              {tour.supplierName && <span>with {tour.supplierName}</span>}
              {duration && <span className="flex items-center gap-1.5"><Clock size={14} />{duration}</span>}
              {tour.maxGroup > 0 && <span className="flex items-center gap-1.5"><Users size={14} />Up to {tour.maxGroup}</span>}
              {pickups.length > 0 && <span className="flex items-center gap-1.5"><Bus size={14} />Hotel pickups</span>}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {!bookable && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-center font-sans text-sm text-amber-800">
          Preview: this tour isn’t open for booking yet. VD Operations publishes it and lists it on the Grand Tour from the operations panel.
        </div>
      )}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-12 sm:py-16 grid gap-12 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-14">
          {tour.description && (
            <motion.section {...anim()}>
              <p className="font-sans text-base sm:text-lg text-black/70 leading-relaxed whitespace-pre-line">{tour.description}</p>
            </motion.section>
          )}

          {/* The day, as a route */}
          <section>
            <motion.h2 {...anim()} className="font-display italic text-3xl mb-8">Your day on the Grand Tour</motion.h2>
            <motion.ol {...anim(stagger)} className="relative border-l border-black/15 ml-3 space-y-9">
              {pickups.length > 0 && firstDeparture && (
                <motion.li variants={reveal} className="pl-8 relative">
                  <span className="absolute -left-[13px] top-0 w-[25px] h-[25px] rounded-full bg-[#2d6a4f] text-white flex items-center justify-center"><Bus size={13} /></span>
                  <p className="font-sans text-[11px] tracking-[0.18em] uppercase text-black/45">Morning pickup</p>
                  <h3 className="font-display italic text-2xl mt-1">Collected from your hotel</h3>
                  <ul className="mt-3 space-y-1.5 font-sans text-sm text-black/70">
                    {pickups.map(p => (
                      <li key={p.id} className="flex justify-between gap-4 max-w-md border-b border-black/5 pb-1.5">
                        <span>{p.name}{p.area ? <span className="text-black/40">, {p.area}</span> : null}</span>
                        <span className="tabular-nums text-black/85">{pickupTime(firstDeparture, p)}</span>
                      </li>
                    ))}
                  </ul>
                  {(tour.timeslots?.length ?? 0) > 1 && <p className="font-sans text-[11px] text-black/40 mt-2">Times shown for the {firstDeparture.time} departure; your ticket shows the exact time for yours.</p>}
                </motion.li>
              )}
              {stops.map((s, i) => (
                <motion.li key={s.id} variants={reveal} className="pl-8 relative">
                  <span className="absolute -left-[13px] top-0 w-[25px] h-[25px] rounded-full bg-[#F7F5F2] border-2 border-[#C9A96E] text-[#C9A96E] flex items-center justify-center font-sans text-[11px] font-semibold">{i + 1}</span>
                  <p className="font-sans text-[11px] tracking-[0.18em] uppercase text-black/45">{s.stage!.name}{s.h!.fact ? ` · ${s.h!.fact}` : ''}</p>
                  <h3 className="font-display italic text-2xl mt-1">{s.h!.name}</h3>
                  <p className="font-sans text-sm text-black/65 mt-2 leading-relaxed max-w-xl">{s.h!.blurb}</p>
                </motion.li>
              ))}
              <motion.li variants={reveal} className="pl-8 relative">
                <span className="absolute -left-[13px] top-0 w-[25px] h-[25px] rounded-full bg-black text-white flex items-center justify-center"><Flag size={12} /></span>
                <p className="font-sans text-[11px] tracking-[0.18em] uppercase text-black/45">{duration ? `About ${duration} later` : 'End of the day'}</p>
                <h3 className="font-display italic text-2xl mt-1">{pickups.length > 0 ? 'Back to your hotel' : 'Back at the meeting point'}</h3>
              </motion.li>
            </motion.ol>
          </section>

          {(tour.included?.length > 0 || tour.whatToWear || tour.safetyNotes) && (
            <motion.section {...anim(stagger)} className="grid gap-8 sm:grid-cols-2">
              {tour.included?.length > 0 && (
                <motion.div variants={reveal}>
                  <h2 className="font-sans text-[11px] tracking-[0.2em] uppercase text-black/50 mb-3">Included</h2>
                  <ul className="space-y-2">
                    {tour.included.map(item => <li key={item} className="flex items-start gap-2 font-sans text-sm text-black/75"><CheckCircle size={15} className="text-[#2d6a4f] mt-0.5 shrink-0" />{item}</li>)}
                  </ul>
                </motion.div>
              )}
              {tour.whatToWear && (
                <motion.div variants={reveal}>
                  <h2 className="font-sans text-[11px] tracking-[0.2em] uppercase text-black/50 mb-3 flex items-center gap-1.5"><Shirt size={12} /> Bring and wear</h2>
                  <p className="font-sans text-sm text-black/70 whitespace-pre-line">{tour.whatToWear}</p>
                </motion.div>
              )}
              {tour.safetyNotes && (
                <motion.div variants={reveal} className="sm:col-span-2">
                  <h2 className="font-sans text-[11px] tracking-[0.2em] uppercase text-black/50 mb-3 flex items-center gap-1.5"><ShieldCheck size={12} /> Good to know</h2>
                  <p className="font-sans text-sm text-black/70 whitespace-pre-line">{tour.safetyNotes}</p>
                </motion.div>
              )}
            </motion.section>
          )}

          {tour.meetingPoint && (
            <motion.p {...anim()} className="font-sans text-sm text-black/60 flex items-center gap-2"><MapPin size={14} /> Meeting point if you make your own way: {tour.meetingPoint}</motion.p>
          )}

          {stages.length > 0 && (
            <motion.section {...anim()} className="border-t border-black/10 pt-8">
              <p className="font-sans text-sm text-black/60 flex items-start gap-2">
                <Mountain size={15} className="text-[#C9A96E] mt-0.5 shrink-0" />
                <span>
                  Part of the <Link href="/grand-tour" className="text-[#2d6a4f] underline underline-offset-4">Grand Tour Drakensberg</Link>
                  {' '}— stage{stages.length > 1 ? 's' : ''} {stages.map(s => s.number).join(' & ')} of {GRAND_TOUR_STAGES.length}.
                </span>
              </p>
            </motion.section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 h-fit">
          <DayTourBooking tour={tour} bookable={bookable} />
        </aside>
      </div>

      {/* Mobile: keep the way to book in reach while reading the itinerary. */}
      {bookable && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-black/10 px-4 py-3 flex items-center justify-between gap-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
          <div className="font-sans text-xs text-black/55 min-w-0">
            <span className="font-display italic text-xl text-[#2d6a4f]">{formatMoney(tour.pricePerPerson)}</span> per seat
            {next && <span className="block truncate">Next: {new Date(`${next.date}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })} · {next.time}</span>}
          </div>
          <a href="#book" className="bg-[#2d6a4f] text-white font-sans text-sm px-5 py-2.5 whitespace-nowrap">Book seats</a>
        </div>
      )}

      <div className="pb-20 lg:pb-0"><Footer /></div>
    </div>
  )
}

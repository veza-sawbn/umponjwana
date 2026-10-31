'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, CalendarPlus, ChevronLeft, ChevronRight, Clock, Heart, MapPin, Mountain, UserCircle, Users,
} from 'lucide-react'
import SaveButton from '@/components/ui/SaveButton'
import { useSavedListings } from '@/lib/saved-listings-context'
import type { TrekkingExperience } from '@/lib/experiences'
import { formatMoney } from '@/lib/allocation'
import { todayISO } from '@/lib/upcoming'
import {
  buildCalendar, buildIcs, calendarYears, defaultCalendarYear, formatRoundDates, segmentForDate,
  type CalendarRound, type CalendarSection,
} from '@/lib/hike-calendar'

// An operator's departures laid out as a season calendar: a year switcher,
// a strip of the year's seasons, a "next departure" feature card, then each
// season's departures as numbered rounds that can be saved, added to a
// personal calendar, or booked. See lib/hike-calendar.ts for the grouping.

const DIFF_COLOR: Record<string, string> = {
  Easy: '#4A7251', Moderate: '#C9A96E', Challenging: '#c0392b', Strenuous: '#c0392b', Extreme: '#8e44ad',
}

const LOW_SPACES = 4

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function daysUntil(iso: string, today: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

function downloadIcs(filename: string, ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function HikeCalendar({ operatorName, experiences, siteUrl }: {
  operatorName: string
  experiences: TrekkingExperience[]
  siteUrl: string
}) {
  const { isSaved } = useSavedListings()
  // todayISO() is evaluated on the client so an ISR-cached shell never
  // pins "today" to the render time.
  const [today, setToday] = useState('')
  useEffect(() => { setToday(todayISO()) }, [])

  const years = useMemo(() => calendarYears(experiences), [experiences])
  const [year, setYear] = useState<number | null>(null)
  const [savedOnly, setSavedOnly] = useState(false)
  const activeYear = year ?? (today ? defaultCalendarYear(years, today) : years[0])

  const visible = useMemo(
    () => (savedOnly ? experiences.filter(e => isSaved('experience', e.id)) : experiences),
    [experiences, savedOnly, isSaved],
  )
  const sections = useMemo(
    () => (activeYear ? buildCalendar(visible, activeYear, today || `${activeYear}-01-01`) : []),
    [visible, activeYear, today],
  )
  const next = experiences.find(e => e.spacesAvailable > 0) ?? experiences[0]
  const yearCount = sections.reduce((n, s) => n + s.rounds.length, 0)

  function exportYear() {
    const list = sections.flatMap(s => s.rounds.map(r => r.experience))
    downloadIcs(
      `${operatorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${activeYear}.ics`,
      buildIcs(list, siteUrl, `${operatorName} · ${activeYear} Hike Calendar`),
    )
  }

  if (experiences.length === 0) {
    return (
      <section id="calendar">
        <CalendarHeading year={null} />
        <div className="bg-white border border-gray-200 p-10 text-center">
          <p className="font-display italic text-xl mb-2">No departures scheduled yet</p>
          <p className="font-sans text-sm text-gray-500 mb-6">
            {operatorName} hasn&apos;t published upcoming dates. You can still request a private trip on your own dates.
          </p>
          <Link href="/experiences/request" className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-3 font-sans text-sm hover:bg-[#245a42] transition-colors">
            Request custom dates <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    )
  }

  const yearIndex = activeYear ? years.indexOf(activeYear) : -1

  return (
    <section id="calendar" className="scroll-mt-24">
      <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
        <CalendarHeading year={activeYear} />
        <div className="flex items-center gap-2 flex-wrap">
          {years.length > 1 && (
            <div className="flex items-center border border-gray-300 bg-white">
              <button
                type="button"
                aria-label="Previous year"
                disabled={yearIndex <= 0}
                onClick={() => setYear(years[yearIndex - 1])}
                className="p-2.5 disabled:opacity-30 hover:bg-gray-50"
              >
                <ChevronLeft size={16} />
              </button>
              {years.map(y => (
                <button
                  key={y}
                  type="button"
                  aria-pressed={y === activeYear}
                  onClick={() => setYear(y)}
                  className={`px-4 py-2 font-sans text-sm border-l border-gray-200 ${
                    y === activeYear ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {y}
                </button>
              ))}
              <button
                type="button"
                aria-label="Next year"
                disabled={yearIndex >= years.length - 1}
                onClick={() => setYear(years[yearIndex + 1])}
                className="p-2.5 border-l border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <button
            type="button"
            aria-pressed={savedOnly}
            onClick={() => setSavedOnly(v => !v)}
            className={`inline-flex items-center gap-2 border px-4 py-2 font-sans text-sm transition-colors ${
              savedOnly ? 'border-red-400 text-red-500 bg-red-50' : 'border-gray-300 bg-white text-gray-600 hover:border-black'
            }`}
          >
            <Heart size={14} className={savedOnly ? 'fill-red-500' : ''} /> Saved only
          </button>
          <button
            type="button"
            onClick={exportYear}
            disabled={yearCount === 0}
            className="inline-flex items-center gap-2 border border-gray-300 bg-white px-4 py-2 font-sans text-sm text-gray-600 hover:border-black disabled:opacity-40 transition-colors"
          >
            <CalendarPlus size={14} /> Sync {activeYear} to my calendar
          </button>
        </div>
      </div>

      {next && today && !savedOnly && <NextDeparture experience={next} today={today} />}

      <SeasonStrip sections={sections} />

      <div className="space-y-14 mt-12">
        {sections.map(section => (
          <SeasonSection key={section.segment.id} section={section} year={activeYear!} today={today} siteUrl={siteUrl} savedOnly={savedOnly} />
        ))}
      </div>

      {savedOnly && yearCount === 0 && (
        <p className="font-sans text-sm text-gray-500 bg-white border border-gray-200 p-6 text-center mt-6">
          You haven&apos;t saved any {activeYear} departures from {operatorName} yet. Tap the heart on a departure to keep it here.
        </p>
      )}
    </section>
  )
}

function CalendarHeading({ year }: { year: number | null }) {
  return (
    <div>
      <p className="font-sans text-[11px] tracking-[0.18em] uppercase text-[#C9A96E] mb-2">Hike Calendar</p>
      <h2 className="font-display italic text-4xl lg:text-5xl text-black leading-none">
        {year ? `${year} Season` : 'Upcoming Departures'}
      </h2>
    </div>
  )
}

function NextDeparture({ experience: e, today }: { experience: TrekkingExperience; today: string }) {
  const days = daysUntil(e.departureDate, today)
  const segment = segmentForDate(e.departureDate)
  return (
    <Link
      href={`/experiences/${e.id}`}
      className="group relative block overflow-hidden text-white mb-10"
      style={{ background: `linear-gradient(120deg, rgb(${segment.tint}) 0%, #111 85%)` }}
    >
      <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 p-6 lg:p-10">
        <div>
          <p className="font-sans text-[11px] tracking-[0.18em] uppercase text-[#C9A96E] mb-3">Next departure · {segment.label}</p>
          <p className="font-display italic text-3xl lg:text-4xl mb-3">{e.title}</p>
          <p className="font-sans text-sm text-white/70 flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5"><Clock size={13} /> {formatRoundDates(e.departureDate, e.returnDate)} · {e.durationDays} day{e.durationDays !== 1 ? 's' : ''}</span>
            {(e.region || e.meetingPoint) && <span className="flex items-center gap-1.5"><MapPin size={13} /> {e.region || e.meetingPoint}</span>}
            <span>{e.spacesAvailable} space{e.spacesAvailable !== 1 ? 's' : ''} left</span>
          </p>
        </div>
        <div className="flex md:flex-col items-end md:items-end justify-between gap-4">
          <div className="text-right">
            <p className="font-display italic text-5xl lg:text-6xl leading-none">{days <= 0 ? 'Today' : days}</p>
            {days > 0 && <p className="font-sans text-[11px] tracking-[0.15em] uppercase text-white/60 mt-1">day{days !== 1 ? 's' : ''} to go</p>}
          </div>
          <span className="inline-flex items-center gap-2 bg-[#C9A96E] text-[#2d2d2d] px-5 py-3 font-sans text-sm font-medium group-hover:bg-[#b8935e] transition-colors">
            Book from {formatMoney(e.pricePerPerson)} <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  )
}

function SeasonStrip({ sections }: { sections: CalendarSection[] }) {
  return (
    <nav aria-label="Seasons" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-gray-200 border border-gray-200">
      {sections.map(({ segment, rounds, past }) => {
        const Tag = past && rounds.length === 0 ? 'div' : 'a'
        return (
        <Tag
          key={segment.id}
          {...(Tag === 'a' ? { href: `#season-${segment.id}` } : {})}
          className={`block bg-white p-4 transition-colors ${Tag === 'a' ? 'hover:bg-[#F7F5F2]' : 'opacity-50'}`}
          style={{ boxShadow: `inset 0 3px 0 rgb(${segment.tint})` }}
        >
          <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gray-400">{segment.range}</p>
          <p className="font-display italic text-lg text-black">{segment.label}</p>
          <p className="font-sans text-xs text-gray-500">
            {rounds.length > 0 ? `${rounds.length} departure${rounds.length !== 1 ? 's' : ''}` : past ? 'Season passed' : 'No dates yet'}
          </p>
        </Tag>
        )
      })}
    </nav>
  )
}

function SeasonSection({ section, year, today, siteUrl, savedOnly }: {
  section: CalendarSection
  year: number
  today: string
  siteUrl: string
  savedOnly: boolean
}) {
  const { segment, rounds, past } = section
  // Empty seasons that have passed (or that hold nothing saved) are left to
  // the season strip rather than listed as a row of "nothing here"s.
  if (rounds.length === 0 && (past || savedOnly)) return null
  return (
    <div id={`season-${segment.id}`} className="scroll-mt-24">
      <div className="flex items-baseline justify-between gap-4 flex-wrap border-b-2 pb-3 mb-5" style={{ borderColor: `rgb(${segment.tint})` }}>
        <div className="flex items-baseline gap-4 flex-wrap">
          <h3 className="font-display italic text-3xl text-black">{segment.label} {year}</h3>
          <span className="font-sans text-xs tracking-[0.15em] uppercase text-gray-400">{segment.range}</span>
        </div>
        <p className="font-sans text-sm text-gray-500">{segment.blurb}</p>
      </div>
      {rounds.length === 0 ? (
        <p className="font-sans text-sm text-gray-400 bg-white border border-dashed border-gray-300 p-5">
          No departures scheduled for this season yet. Check back soon, or request custom dates.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rounds.map(r => <RoundCard key={r.experience.id} round={r} today={today} siteUrl={siteUrl} tint={segment.tint} />)}
        </div>
      )}
    </div>
  )
}

function RoundCard({ round, today, siteUrl, tint }: { round: CalendarRound; today: string; siteUrl: string; tint: string }) {
  const e = round.experience
  const full = e.spacesAvailable === 0 || e.status === 'full'
  const low = !full && e.spacesAvailable <= LOW_SPACES
  const booked = e.spacesTotal > 0 ? Math.min(100, Math.round(((e.spacesTotal - e.spacesAvailable) / e.spacesTotal) * 100)) : 0
  const days = today ? daysUntil(e.departureDate, today) : null
  const start = new Date(`${e.departureDate}T00:00:00`)

  return (
    <article className="bg-white border border-gray-200 flex flex-col hover:border-black transition-colors">
      <div className="flex items-stretch border-b border-gray-100">
        <div className="w-20 shrink-0 flex flex-col items-center justify-center py-4 text-white" style={{ background: `rgb(${tint})` }}>
          <span className="font-sans text-[10px] tracking-[0.15em] uppercase text-white/70">
            {start.toLocaleDateString('en-ZA', { month: 'short' })}
          </span>
          <span className="font-display italic text-3xl leading-none">{start.getDate()}</span>
          <span className="font-sans text-[10px] text-white/70 mt-1">
            {start.toLocaleDateString('en-ZA', { weekday: 'short' })}
          </span>
        </div>
        <div className="flex-1 min-w-0 p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gray-400">Departure {pad(round.round)}</p>
            {full
              ? <Badge className="bg-gray-100 text-gray-500">Fully booked</Badge>
              : e.status === 'confirmed'
                ? <Badge className="bg-[#2d6a4f]/10 text-[#2d6a4f]">Guaranteed</Badge>
                : low
                  ? <Badge className="bg-[#C9A96E]/15 text-[#8a6a35]">Few spaces</Badge>
                  : null}
          </div>
          <Link href={`/experiences/${e.id}`} className="block font-display italic text-xl text-black leading-tight hover:text-[#2d6a4f] transition-colors">
            {e.title}
          </Link>
          <p className="font-sans text-xs text-gray-500 mt-1">
            {formatRoundDates(e.departureDate, e.returnDate)} · {e.durationDays} day{e.durationDays !== 1 ? 's' : ''}
            {days !== null && days >= 0 && days <= 30 && <span className="text-[#C9A96E]"> · in {days} day{days !== 1 ? 's' : ''}</span>}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-2 flex-1">
        {e.trailName && (
          <p className="font-sans text-xs text-gray-600 flex items-center gap-1.5"><Mountain size={12} className="text-[#C9A96E]" /> {e.trailName}</p>
        )}
        {(e.region || e.meetingPoint) && (
          <p className="font-sans text-xs text-gray-600 flex items-center gap-1.5"><MapPin size={12} className="text-[#C9A96E]" /> {e.region || e.meetingPoint}</p>
        )}
        {e.leadGuide && (
          <p className="font-sans text-xs text-gray-600 flex items-center gap-1.5"><UserCircle size={12} className="text-[#C9A96E]" /> Led by {e.leadGuide}</p>
        )}
        <div className="flex items-center gap-3 pt-1">
          {e.difficulty && (
            <span className="font-sans text-[10px] tracking-wide uppercase px-2 py-0.5 text-white" style={{ background: DIFF_COLOR[e.difficulty] || '#6b7280' }}>
              {e.difficulty}
            </span>
          )}
          {e.spacesTotal > 0 && (
            <span className="flex-1 flex items-center gap-2 font-sans text-[11px] text-gray-500">
              <Users size={12} />
              <span className="flex-1 h-1 bg-gray-100 overflow-hidden" aria-hidden>
                <span className="block h-full bg-[#2d6a4f]" style={{ width: `${booked}%` }} />
              </span>
              {full ? 'Full' : `${e.spacesAvailable}/${e.spacesTotal} left`}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 p-4 pt-0">
        <div className="mr-auto">
          <p className="font-sans text-[10px] text-gray-400 leading-none">from</p>
          <p className="font-display italic text-xl text-[#2d6a4f] leading-tight">{formatMoney(e.pricePerPerson)}</p>
        </div>
        <SaveButton
          variant="inline"
          className="!px-3"
          listing={{
            id: e.id,
            type: 'experience',
            title: e.title,
            location: e.region || e.meetingPoint,
            price: e.pricePerPerson,
            rating: e.rating ?? undefined,
          }}
        />
        <button
          type="button"
          aria-label={`Add ${e.title} to my calendar`}
          title="Add to my calendar"
          onClick={() => downloadIcs(`${e.id}.ics`, buildIcs([e], siteUrl, e.title))}
          className="border border-black/15 bg-white p-2.5 text-gray-500 hover:border-black hover:text-black transition-colors"
        >
          <CalendarPlus size={15} />
        </button>
        {full ? (
          <Link href={`/experiences/${e.id}`} className="border border-gray-300 px-4 py-2 font-sans text-sm text-gray-500 hover:border-black transition-colors">
            View
          </Link>
        ) : (
          <Link href={`/experiences/${e.id}`} className="bg-[#2d6a4f] text-white px-4 py-2 font-sans text-sm hover:bg-[#245a42] transition-colors">
            Book
          </Link>
        )}
      </div>
    </article>
  )
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`font-sans text-[10px] tracking-wide uppercase px-2 py-0.5 shrink-0 ${className}`}>{children}</span>
}

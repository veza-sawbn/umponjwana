import type { TrekkingExperience } from './experiences'
import { SEASON_META, type Season } from './seasons'

// The operator hike calendar on /guides/operators/[id] — one calendar year of
// an operator's departures split into seasons, round-by-round like a racing
// calendar.
//
// Southern Hemisphere summer (Dec – Feb) straddles New Year, so a calendar
// year holds two pieces of it: late summer (Jan – Feb) opens the year and
// early summer (December) closes it. Each piece is its own segment so the
// page reads in date order without pulling December into the next year.

export type CalendarSegmentId = 'late-summer' | 'autumn' | 'winter' | 'spring' | 'early-summer'

export type CalendarSegment = {
  id: CalendarSegmentId
  season: Season
  label: string
  range: string
  blurb: string
  tint: string
  /** 0-based months this segment covers. */
  months: number[]
}

export const CALENDAR_SEGMENTS: CalendarSegment[] = [
  { id: 'late-summer', season: 'summer', label: 'Late Summer', range: 'Jan – Feb', months: [0, 1], blurb: SEASON_META.summer.blurb, tint: SEASON_META.summer.tint },
  { id: 'autumn', season: 'autumn', label: 'Autumn', range: SEASON_META.autumn.range, months: [2, 3, 4], blurb: SEASON_META.autumn.blurb, tint: SEASON_META.autumn.tint },
  { id: 'winter', season: 'winter', label: 'Winter', range: SEASON_META.winter.range, months: [5, 6, 7], blurb: SEASON_META.winter.blurb, tint: SEASON_META.winter.tint },
  { id: 'spring', season: 'spring', label: 'Spring', range: SEASON_META.spring.range, months: [8, 9, 10], blurb: SEASON_META.spring.blurb, tint: SEASON_META.spring.tint },
  { id: 'early-summer', season: 'summer', label: 'Early Summer', range: 'Dec', months: [11], blurb: 'Long days, festive-season trips and the first summer rains.', tint: SEASON_META.summer.tint },
]

/** A departure placed on the calendar: its round number within the year. */
export type CalendarRound = { round: number; experience: TrekkingExperience }

export type CalendarSection = {
  segment: CalendarSegment
  rounds: CalendarRound[]
  /** Every month of this segment is already behind `today`. */
  past: boolean
}

function yearOf(iso: string): number {
  return Number(iso.slice(0, 4))
}

function monthOf(iso: string): number {
  return Number(iso.slice(5, 7)) - 1
}

/** Calendar years that have at least one departure, ascending. */
export function calendarYears(experiences: Pick<TrekkingExperience, 'departureDate'>[]): number[] {
  return Array.from(new Set(experiences.map(e => yearOf(e.departureDate)))).sort((a, b) => a - b)
}

export function segmentForDate(iso: string): CalendarSegment {
  const m = monthOf(iso)
  return CALENDAR_SEGMENTS.find(s => s.months.includes(m)) ?? CALENDAR_SEGMENTS[0]
}

/**
 * One year's departures, numbered in date order and split into the five
 * calendar segments. Segments with no departures are kept (with an empty
 * `rounds`) so the season strip always shows the whole year.
 */
export function buildCalendar(experiences: TrekkingExperience[], year: number, today: string): CalendarSection[] {
  const inYear = experiences
    .filter(e => yearOf(e.departureDate) === year)
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate) || a.title.localeCompare(b.title))
  const rounds: CalendarRound[] = inYear.map((experience, i) => ({ round: i + 1, experience }))

  const todayYear = yearOf(today)
  const todayMonth = monthOf(today)
  return CALENDAR_SEGMENTS.map(segment => {
    const lastMonth = segment.months[segment.months.length - 1]
    return {
      segment,
      rounds: rounds.filter(r => segment.months.includes(monthOf(r.experience.departureDate))),
      past: year < todayYear || (year === todayYear && lastMonth < todayMonth),
    }
  })
}

/** The year to open on: today's year when it still has departures, else the next one that does. */
export function defaultCalendarYear(years: number[], today: string): number {
  const current = yearOf(today)
  return years.find(y => y >= current) ?? years[years.length - 1] ?? current
}

/** "14 – 16 Mar", "28 Feb – 2 Mar", or "14 Mar" for a day trip. */
export function formatRoundDates(start: string, end: string): string {
  const fmt = (iso: string, withMonth: boolean) => {
    const d = new Date(`${iso}T00:00:00`)
    // Built by hand: en-ZA's toLocaleDateString pads the day ("02 Mar").
    return withMonth
      ? `${d.getDate()} ${d.toLocaleDateString('en-ZA', { month: 'short' })}`
      : String(d.getDate())
  }
  if (!end || end === start) return fmt(start, true)
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  return `${fmt(start, !sameMonth)} – ${fmt(end, true)}`
}

/* ── .ics export ─────────────────────────────────────────────────────────── */

function icsDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '')
}

function nextDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
}

/**
 * An iCalendar file of all-day events, one per departure. DTEND is exclusive
 * per RFC 5545, hence the day after the return date.
 */
export function buildIcs(
  experiences: Pick<TrekkingExperience, 'id' | 'title' | 'departureDate' | 'returnDate' | 'meetingPoint' | 'operator' | 'trailName'>[],
  siteUrl: string,
  calendarName: string,
  now: Date = new Date(),
): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Visit Drakensberg//Hike Calendar//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ]
  for (const e of experiences) {
    const url = `${siteUrl}/experiences/${e.id}`
    const description = [e.trailName && `Trail: ${e.trailName}`, e.operator && `Operator: ${e.operator}`, `Book: ${url}`]
      .filter(Boolean)
      .join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@visitdrakensberg.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.departureDate)}`,
      `DTEND;VALUE=DATE:${icsDate(nextDay(e.returnDate || e.departureDate))}`,
      `SUMMARY:${icsEscape(e.title)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      ...(e.meetingPoint ? [`LOCATION:${icsEscape(e.meetingPoint)}`] : []),
      `URL:${url}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

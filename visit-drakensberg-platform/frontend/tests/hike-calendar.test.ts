import { describe, it, expect } from 'vitest'
import type { TrekkingExperience } from '@/lib/experiences'
import {
  buildCalendar, buildIcs, calendarYears, defaultCalendarYear, formatRoundDates, segmentForDate,
} from '@/lib/hike-calendar'

function exp(id: string, departureDate: string, returnDate = departureDate): TrekkingExperience {
  return { id, title: `Hike ${id}`, departureDate, returnDate, meetingPoint: 'Cathedral Peak', operator: 'Op', trailName: 'Trail' } as TrekkingExperience
}

describe('segmentForDate', () => {
  it('splits summer across the turn of the year', () => {
    expect(segmentForDate('2027-01-10').id).toBe('late-summer')
    expect(segmentForDate('2027-02-28').id).toBe('late-summer')
    expect(segmentForDate('2027-03-01').id).toBe('autumn')
    expect(segmentForDate('2027-08-31').id).toBe('winter')
    expect(segmentForDate('2027-11-30').id).toBe('spring')
    expect(segmentForDate('2027-12-01').id).toBe('early-summer')
  })
})

describe('buildCalendar', () => {
  const list = [exp('c', '2027-06-01'), exp('a', '2027-01-05'), exp('d', '2027-12-20'), exp('x', '2026-12-01'), exp('b', '2027-03-15')]

  it('numbers one year of departures in date order and keeps empty seasons', () => {
    const sections = buildCalendar(list, 2027, '2026-10-31')
    expect(sections.map(s => s.segment.id)).toEqual(['late-summer', 'autumn', 'winter', 'spring', 'early-summer'])
    expect(sections.flatMap(s => s.rounds.map(r => [r.round, r.experience.id]))).toEqual([[1, 'a'], [2, 'b'], [3, 'c'], [4, 'd']])
    expect(sections.find(s => s.segment.id === 'spring')!.rounds).toEqual([])
    expect(sections.every(s => !s.past)).toBe(true)
  })

  it('marks seasons already behind today as past', () => {
    const sections = buildCalendar(list, 2026, '2026-10-31')
    expect(sections.filter(s => s.past).map(s => s.segment.id)).toEqual(['late-summer', 'autumn', 'winter'])
  })
})

describe('years', () => {
  it('lists years with departures and opens on the current or next one', () => {
    const years = calendarYears([exp('a', '2027-01-05'), exp('b', '2026-12-01'), exp('c', '2027-02-01')])
    expect(years).toEqual([2026, 2027])
    expect(defaultCalendarYear(years, '2026-10-31')).toBe(2026)
    expect(defaultCalendarYear([2027, 2028], '2026-10-31')).toBe(2027)
  })
})

describe('formatRoundDates', () => {
  it('collapses the month when a trip stays inside one', () => {
    expect(formatRoundDates('2027-03-14', '2027-03-16')).toBe('14 – 16 Mar')
    expect(formatRoundDates('2027-02-28', '2027-03-02')).toBe('28 Feb – 2 Mar')
    expect(formatRoundDates('2027-03-14', '2027-03-14')).toBe('14 Mar')
  })
})

describe('buildIcs', () => {
  it('writes all-day events with an exclusive end date', () => {
    const ics = buildIcs([exp('dep-1', '2027-03-14', '2027-03-16')], 'https://example.com', 'Cal', new Date('2026-10-31T10:00:00Z'))
    expect(ics).toContain('DTSTART;VALUE=DATE:20270314\r\n')
    expect(ics).toContain('DTEND;VALUE=DATE:20270317\r\n')
    expect(ics).toContain('URL:https://example.com/experiences/dep-1\r\n')
    expect(ics).toContain('DTSTAMP:20261031T100000Z\r\n')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
  })
})

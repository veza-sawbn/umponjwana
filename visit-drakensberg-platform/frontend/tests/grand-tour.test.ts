import { describe, it, expect } from 'vitest'
import {
  GRAND_TOUR_STAGES, pickupTime, upcomingDepartures, dayTourHref, grandTourActivities, stagesForActivity, allPickupNames, stageForHighlight,
} from '@/lib/grand-tour'
import type { Activity } from '@/lib/activities'

const tour = (over: Partial<Activity> = {}): Activity => ({
  id: 'act-1', supplierId: 's', supplierName: 'Berg Tours', name: 'Sani Pass Day Tour', category: 'Adventure',
  region: 'Southern Drakensberg', difficulty: 'Easy', description: '', durationH: 9, durationM: 0, minAge: 0,
  maxGroup: 14, meetingPoint: '', gpsLat: '', gpsLng: '', whatToWear: '', photos: [], included: [],
  safetyNotes: '', pricePerPerson: 1450, priceGroup: 0, depositRequired: false, depositPercent: '0',
  status: 'active', createdAt: '2026-10-01',
  timeslots: [{ id: 'slot-1', time: '07:30', capacity: 14, days: [] }],
  grandTour: {
    enabled: true,
    highlightIds: ['sani-pass-ascent', 'sani-top'],
    departsFrom: 'Champagne Valley',
    pickupPoints: [{ id: 'pk-1', name: 'Champagne Sports Resort', minutesBefore: 45 }],
  },
  ...over,
})

describe('pickupTime', () => {
  it('subtracts the lead time from the departure', () => {
    expect(pickupTime({ time: '07:30' }, { minutesBefore: 45 })).toBe('06:45')
    expect(pickupTime({ time: '07:30' }, { minutesBefore: 0 })).toBe('07:30')
  })
  it('wraps past midnight instead of going negative', () => {
    expect(pickupTime({ time: '00:15' }, { minutesBefore: 30 })).toBe('23:45')
  })
})

describe('grandTourActivities', () => {
  it('keeps only active, enabled tours with at least one departure', () => {
    const list = [
      tour(),
      tour({ id: 'draft', status: 'draft' }),
      tour({ id: 'off', grandTour: { enabled: false, highlightIds: [], pickupPoints: [] } }),
      tour({ id: 'none', grandTour: undefined }),
      tour({ id: 'no-slots', timeslots: [] }),
    ]
    expect(grandTourActivities(list).map(a => a.id)).toEqual(['act-1'])
  })
})

describe('stagesForActivity', () => {
  it('places a tour on the stages of the highlights it visits, in route order', () => {
    const t = tour({ grandTour: { enabled: true, highlightIds: ['sani-top', 'monks-cowl', 'unknown'], pickupPoints: [] } })
    expect(stagesForActivity(t).map(s => s.id)).toEqual(['champagne-valley', 'sani-pass'])
  })
})

describe('allPickupNames', () => {
  it('lists each hotel once, sorted, ignoring blanks', () => {
    const a = tour()
    const b = tour({ id: 'b', grandTour: { enabled: true, highlightIds: [], pickupPoints: [
      { id: 'x', name: ' Champagne Sports Resort ', minutesBefore: 30 },
      { id: 'y', name: 'Alpine Heath', minutesBefore: 60 },
      { id: 'z', name: '  ', minutesBefore: 0 },
    ] } })
    expect(allPickupNames([a, b])).toEqual(['Alpine Heath', 'Champagne Sports Resort'])
  })
})

describe('route content', () => {
  it('has unique highlight ids, so a tour can never land on two stages by accident', () => {
    const ids = GRAND_TOUR_STAGES.flatMap(s => s.highlights.map(h => h.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(stageForHighlight('tugela-falls')?.id).toBe('royal-natal')
  })
  it('numbers stages in order', () => {
    expect(GRAND_TOUR_STAGES.map(s => s.number)).toEqual(GRAND_TOUR_STAGES.map((_, i) => i + 1))
  })
})

describe('upcomingDepartures', () => {
  it('lists departures on the days they run, skipping full ones', () => {
    // 2026-10-09 is a Friday (5), 10th Saturday (6), 12th Monday (1).
    const t = tour({
      timeslots: [{ id: 's', time: '07:30', capacity: 2, days: [1, 5, 6] }],
      slotBookings: { '2026-10-10:s': 2 },
    })
    expect(upcomingDepartures(t, { from: '2026-10-08', days: 6, limit: 5 })).toEqual([
      { date: '2026-10-09', timeslotId: 's', time: '07:30', seatsLeft: 2 },
      { date: '2026-10-12', timeslotId: 's', time: '07:30', seatsLeft: 2 },
    ])
  })
  it('stops at the limit', () => {
    expect(upcomingDepartures(tour(), { from: '2026-10-08', limit: 3 })).toHaveLength(3)
  })
})

describe('dayTourHref', () => {
  it('prefers the slug', () => {
    expect(dayTourHref({ id: 'act-1', slug: 'sani-pass' })).toBe('/grand-tour/sani-pass')
    expect(dayTourHref({ id: 'act-1' })).toBe('/grand-tour/act-1')
  })
})

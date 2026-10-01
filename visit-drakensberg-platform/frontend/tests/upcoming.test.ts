import { describe, it, expect } from 'vitest'
import { todayISO, isOnOrAfterToday, isEventUpcoming } from '@/lib/upcoming'

describe('todayISO', () => {
  it('uses South African time, not UTC', () => {
    // 23:30 UTC on 29 Sep is already 01:30 on 30 Sep in Johannesburg.
    expect(todayISO(new Date('2026-09-29T23:30:00Z'))).toBe('2026-09-30')
    expect(todayISO(new Date('2026-09-30T12:00:00Z'))).toBe('2026-09-30')
  })
})

describe('isOnOrAfterToday', () => {
  const today = '2026-09-30'
  it('keeps a listing for the whole of its day and drops it after', () => {
    expect(isOnOrAfterToday('2026-09-30', today)).toBe(true)
    expect(isOnOrAfterToday('2026-10-01', today)).toBe(true)
    expect(isOnOrAfterToday('2026-09-29', today)).toBe(false)
  })
  it('treats missing dates as passed', () => {
    expect(isOnOrAfterToday('', today)).toBe(false)
    expect(isOnOrAfterToday(undefined, today)).toBe(false)
  })
})

describe('isEventUpcoming', () => {
  const today = '2026-09-30'
  it('uses the end date when there is one', () => {
    expect(isEventUpcoming({ starts_at: '2026-09-28T09:00', ends_at: '2026-10-02T17:00' }, today)).toBe(true)
    expect(isEventUpcoming({ starts_at: '2026-09-27T09:00', ends_at: '2026-09-29T17:00' }, today)).toBe(false)
  })
  it('falls back to the start date, staying up until that day is over', () => {
    expect(isEventUpcoming({ starts_at: '2026-09-30T08:00', ends_at: '' }, today)).toBe(true)
    expect(isEventUpcoming({ starts_at: '2026-09-29T20:00' }, today)).toBe(false)
  })
})

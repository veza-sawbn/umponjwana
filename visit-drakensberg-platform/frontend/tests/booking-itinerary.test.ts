import { describe, it, expect, vi } from 'vitest'

// The resolver is pure; keep the Supabase client and notifications out of it.
vi.mock('@/lib/auth', () => ({ supabase: {} }))
vi.mock('@/lib/notifications', () => ({ notify: vi.fn() }))

import { resolveDefaultItinerary, effectiveItineraryDays, tripRequestIdForItem, type BookingItinerary } from '@/lib/booking-itinerary'
import type { Tour } from '@/lib/tours'
import type { Trail } from '@/lib/trails'
import type { TripRequest } from '@/lib/custom-trips'

const OPERATOR = '11111111-1111-1111-1111-111111111111'

const trail = (id: string, labels: string[]) => ({
  id, name: id, days: labels.map(label => ({ label, distance: '', elevation: '', difficulty: 'Moderate' as const })),
}) as unknown as Trail

const tour = (id: string, trailId: string) => ({
  id, trailId, name: `Tour ${id}`, supplierId: OPERATOR, supplierName: 'Berg Guides', meetingPoint: `Meet for ${id}`,
}) as unknown as Tour

const trails = [trail('trail-other', ['Other day 1']), trail('trail-amph', ['Sentinel car park', 'Tugela Falls'])]
// The operator's FIRST tour is not the one this guest requested.
const tours = [tour('tour-other', 'trail-other'), tour('tour-amph', 'trail-amph')]

const request = {
  id: 'trq-1', trailId: 'trail-amph', operatorId: OPERATOR, operatorName: 'Berg Guides',
} as unknown as TripRequest

const privateTrip = {
  id: 'trip-request-trq-1', title: 'Private trip — Amphitheatre', date: '2026-11-01',
  operator: 'Berg Guides', supplierId: OPERATOR,
}

describe('resolveDefaultItinerary', () => {
  it('resolves a private trip through its own trail, not the operator\'s first tour', () => {
    const r = resolveDefaultItinerary(privateTrip, { departures: [], tours, trails, tripRequest: request })
    expect(r.trail?.id).toBe('trail-amph')
    expect(r.tour?.id).toBe('tour-amph')
    expect(r.days.map(d => [d.date, d.label])).toEqual([
      ['2026-11-01', 'Sentinel car park'],
      ['2026-11-02', 'Tugela Falls'],
    ])
  })

  it('shows no plan rather than a wrong one when the request is unavailable', () => {
    const r = resolveDefaultItinerary(privateTrip, { departures: [], tours, trails, tripRequest: null })
    expect(r.tour).toBeNull()
    expect(r.days).toEqual([])
  })

  it('no longer guesses between several tours by the same operator', () => {
    const legacy = { id: 'legacy-1', title: 'Something else', date: '2026-11-01', operator: 'Berg Guides' }
    expect(resolveDefaultItinerary(legacy, { departures: [], tours, trails }).tour).toBeNull()
    expect(resolveDefaultItinerary(legacy, { departures: [], tours: [tours[1]], trails }).tour?.id).toBe('tour-amph')
  })
})

describe('effectiveItineraryDays', () => {
  const resolved = resolveDefaultItinerary(privateTrip, { departures: [], tours, trails, tripRequest: request })

  it('prefers the operator\'s days', () => {
    const override = { days: [{ date: '2026-11-08', label: 'Moved a week' }] } as BookingItinerary
    expect(effectiveItineraryDays(resolved, override)).toEqual(override.days)
  })

  it('falls back to the catalog plan with no override, or one with no days', () => {
    expect(effectiveItineraryDays(resolved, null)).toBe(resolved.days)
    expect(effectiveItineraryDays(resolved, { days: [] } as unknown as BookingItinerary)).toBe(resolved.days)
  })
})

it('tripRequestIdForItem', () => {
  expect(tripRequestIdForItem('trip-request-trq-1')).toBe('trq-1')
  expect(tripRequestIdForItem('dep-1')).toBeNull()
})

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ supabase: {} }))

import { stayNightPrice, roomIncludesBreakfast } from '@/lib/rooms'
import { PROPERTY_TYPES, propertyTypeSlug, propertyTypeFromSlug } from '@/lib/properties'

// These cases mirror supabase/tests/bnb_stays_test.sql: the stay page's
// price and vd_canonical_stay_night_price() must agree, or checkout charges
// something other than what the guest was shown.
describe('stayNightPrice', () => {
  const pps = { basePrice: 650, rateBasis: 'per_person' as const, childMaxAge: 12, childPrice: 300 }

  it('charges a per-person rate for every adult', () => {
    expect(stayNightPrice(pps, 2)).toBe(1300)
  })
  it('charges a child the child rate instead of the adult rate', () => {
    expect(stayNightPrice(pps, 3, 1)).toBe(1600)
  })
  it('clamps children to the party size', () => {
    expect(stayNightPrice(pps, 2, 5)).toBe(600)
  })
  it('counts children as adults when the room has no child rate', () => {
    expect(stayNightPrice({ basePrice: 700, rateBasis: 'per_person' }, 3, 2)).toBe(2100)
  })
  it('keeps a per-room rate flat whatever the party', () => {
    expect(stayNightPrice({ basePrice: 1500 }, 4)).toBe(1500)
  })
  it('adds a per-room child rate on top', () => {
    expect(stayNightPrice({ basePrice: 1800, childMaxAge: 12, childPrice: 250 }, 3, 2)).toBe(2300)
  })
  it('treats a nonsense party as one guest', () => {
    expect(stayNightPrice(pps, 0)).toBe(650)
  })
})

describe('B&B vocabulary', () => {
  it('lists Bed & Breakfast as a property type with a clean URL slug', () => {
    expect(PROPERTY_TYPES).toContain('Bed & Breakfast')
    expect(propertyTypeSlug('Bed & Breakfast')).toBe('bed-breakfast')
    expect(propertyTypeFromSlug('bed-breakfast')).toBe('Bed & Breakfast')
  })
  it('reads breakfast from the room inclusions', () => {
    expect(roomIncludesBreakfast({ inclusions: ['Breakfast', 'Wi-Fi'] })).toBe(true)
    expect(roomIncludesBreakfast({ inclusions: ['All Meals'] })).toBe(true)
    expect(roomIncludesBreakfast({ inclusions: ['Dinner'] })).toBe(false)
    expect(roomIncludesBreakfast({ inclusions: undefined as unknown as string[] })).toBe(false)
  })
})

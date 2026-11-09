import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ supabase: {} }))
vi.mock('@/lib/entities', () => ({
  listEntities: vi.fn(async () => [
    { id: 'a', status: 'open' }, { id: 'b', status: 'draft' }, { id: 'c', status: 'full' },
  ]),
  listEntitiesByOwner: vi.fn(), insertEntity: vi.fn(), updateEntity: vi.fn(), deleteEntity: vi.fn(),
  newEntityId: vi.fn(() => 'x'),
}))
vi.mock('@/lib/effective-supplier', () => ({ getEffectiveSupplierId: vi.fn() }))

import { updateEntity } from '@/lib/entities'
import { getDepartures, isDraftDeparture, publishedStatus, unpublishDeparture } from '@/lib/departures'

describe('draft departures', () => {
  it('never appear in the public catalog', async () => {
    expect((await getDepartures()).map(d => d.id)).toEqual(['a', 'c'])
  })
  it('publish as open, or full when every seat is already taken', () => {
    expect(publishedStatus({ bookedSeats: 0, maxSeats: 10 })).toBe('open')
    expect(publishedStatus({ bookedSeats: 10, maxSeats: 10 })).toBe('full')
  })
  it('are recognised', () => {
    expect(isDraftDeparture({ status: 'draft' })).toBe(true)
    expect(isDraftDeparture({ status: 'open' })).toBe(false)
  })
  it('cannot be unpublished once guests hold seats', async () => {
    await expect(unpublishDeparture({ id: 'a', bookedSeats: 2 } as never)).rejects.toThrow(/hold seats/)
  })
  it('explain when the database refuses because seats were booked meanwhile', async () => {
    vi.mocked(updateEntity).mockRejectedValueOnce({ message: 'guests already hold seats on this departure, so it cannot go back to draft' })
    await expect(unpublishDeparture({ id: 'a', bookedSeats: 0 } as never)).rejects.toThrow(/since the page loaded/)
  })
})

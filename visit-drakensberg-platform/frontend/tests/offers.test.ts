import { describe, it, expect } from 'vitest'
import { offerState, validateOffer, offerDiscount, offerCommissionPreview, commissionReminder } from '@/lib/offers'

const today = '2026-10-09'

describe('offerState', () => {
  const base = { status: 'active' as const, startsOn: '2026-10-10', endsOn: '2026-10-20' }
  it('is scheduled before its start date', () => {
    expect(offerState(base, today)).toBe('scheduled')
  })
  it('is live from its first day through its last day', () => {
    expect(offerState(base, '2026-10-10')).toBe('live')
    expect(offerState(base, '2026-10-20')).toBe('live')
  })
  it('ends after its last day, even when paused', () => {
    expect(offerState(base, '2026-10-21')).toBe('ended')
    expect(offerState({ ...base, status: 'paused' }, '2026-10-21')).toBe('ended')
  })
  it('reads as paused while paused and not yet ended', () => {
    expect(offerState({ ...base, status: 'paused' }, '2026-10-15')).toBe('paused')
  })
})

describe('validateOffer', () => {
  const ok = {
    title: 'Winter special', description: '', type: 'percent' as const, value: 15,
    listing: '', startsOn: '2026-10-15', endsOn: '2026-10-31', commissionAcknowledged: true,
  }
  it('accepts a complete, acknowledged offer', () => {
    expect(validateOffer(ok, today)).toBeNull()
  })
  it('requires the commission acknowledgement', () => {
    expect(validateOffer({ ...ok, commissionAcknowledged: false }, today)).toMatch(/commission/i)
  })
  it('rejects a start date in the past and an end before the start', () => {
    expect(validateOffer({ ...ok, startsOn: '2026-10-08' }, today)).toMatch(/past/)
    expect(validateOffer({ ...ok, endsOn: '2026-10-14' }, today)).toMatch(/end date/)
  })
  it('allows an offer that starts today', () => {
    expect(validateOffer({ ...ok, startsOn: today }, today)).toBeNull()
  })
  it('rejects zero and 100%+ discounts', () => {
    expect(validateOffer({ ...ok, value: 0 }, today)).not.toBeNull()
    expect(validateOffer({ ...ok, value: 100 }, today)).not.toBeNull()
  })
})

describe('offer commission', () => {
  it('never takes off more than the price', () => {
    expect(offerDiscount({ type: 'flat', value: 500 }, 300)).toBe(300)
    expect(offerDiscount({ type: 'percent', value: 20 }, 1000)).toBe(200)
  })
  it('still charges commission on the offer price', () => {
    const p = offerCommissionPreview({ type: 'percent', value: 20 }, 1000, 0.12)
    expect(p.discountAmount).toBe(200)
    expect(p.netAmount).toBe(800)
    expect(p.commissionAmount).toBe(96)
    expect(p.supplierShare).toBe(704)
  })
  it('names the rate in the reminder', () => {
    expect(commissionReminder('12%')).toMatch(/12% is charged on every booking/)
  })
})

import { describe, expect, it } from 'vitest'
import { alreadySentTo, departureParticipants } from '@/lib/waiver-participants'
import type { DepartureBooking, DepartureGuest } from '@/lib/departure-guests'

const b = (o: Partial<DepartureBooking>): DepartureBooking => ({
  bookingId: 'b1', reference: 'DBK-1', status: 'confirmed', customerName: 'Prosperity Ngobeni',
  customerEmail: 'P@Example.com', seats: 1, packageId: null, rateTitle: null, bookedAt: '',
  paymentOpen: false, releasesAt: null, ...o,
})
const g = (o: Partial<DepartureGuest>): DepartureGuest => ({
  id: 'g1', departureId: 'd', supplierId: 's', name: 'Masego Mathibe', email: 'm@example.com',
  phone: null, seats: 1, notes: 'Wix booking', packageId: null, createdAt: '', ...o,
})

describe('departureParticipants', () => {
  it('lists paid online guests and hand-entered guests', () => {
    const list = departureParticipants([b({})], [g({})])
    expect(list.map(p => [p.name, p.email, p.source])).toEqual([
      ['Prosperity Ngobeni', 'p@example.com', 'online'],
      ['Masego Mathibe', 'm@example.com', 'manual'],
    ])
  })
  it('leaves out unpaid online bookings', () => {
    expect(departureParticipants([b({ status: 'pending' })], [])).toEqual([])
  })
  it('merges a hand-entered duplicate of an online booking (email or reference)', () => {
    expect(departureParticipants([b({})], [g({ name: 'Prosperity', email: 'p@example.com' })])).toHaveLength(1)
    expect(departureParticipants([b({ reference: 'DBK-QKSYU8-KZN' })], [g({ email: null, notes: 'DBK-QKSYU8-KZN' })])).toHaveLength(1)
  })
  it('keeps guests without an email (they can still sign the group link)', () => {
    expect(departureParticipants([], [g({ email: null })])[0].email).toBeNull()
  })
})

describe('alreadySentTo', () => {
  const reqs = [{ participant_email: 'p@example.com', service_date: '2026-11-14', activity_name: 'Thukela Falls', status: 'pending' }]
  it('matches the same guest, trip and date', () => {
    expect(alreadySentTo('P@example.com', '2026-11-14', 'thukela falls', reqs)).toBe(true)
  })
  it('ignores other dates, withdrawn waivers and missing emails', () => {
    expect(alreadySentTo('p@example.com', '2026-12-31', 'Thukela Falls', reqs)).toBe(false)
    expect(alreadySentTo('p@example.com', '2026-11-14', 'Thukela Falls', [{ ...reqs[0], status: 'void' }])).toBe(false)
    expect(alreadySentTo(null, '2026-11-14', 'Thukela Falls', reqs)).toBe(false)
  })
})

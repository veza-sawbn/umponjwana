import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ supabase: {} }))
vi.mock('@/lib/effective-supplier', () => ({ getEffectiveSupplierId: vi.fn() }))
vi.mock('@/lib/departures', () => ({ bookDepartureSeats: vi.fn(), releaseDepartureSeats: vi.fn() }))

import { duplicatedBooking, type DepartureBooking, type DepartureGuest } from '@/lib/departure-guests'

const guest = (o: Partial<DepartureGuest>): DepartureGuest => ({
  id: 'g', departureId: 'd', supplierId: 's', name: 'Zimbini Nyezi', email: null, phone: null,
  seats: 1, notes: null, packageId: null, createdAt: '', ...o,
})
const booking = (o: Partial<DepartureBooking>): DepartureBooking => ({
  bookingId: 'b', reference: 'DBK-QKSYU8-KZN', status: 'confirmed', customerName: 'Zimbini Nyezi',
  customerEmail: 'z@example.com', seats: 1, packageId: null, rateTitle: null, bookedAt: '',
  paymentOpen: false, releasesAt: null, ...o,
})

describe('duplicatedBooking', () => {
  it('spots a hand-entered guest carrying an online booking reference', () => {
    expect(duplicatedBooking(guest({ notes: 'dbk-qksyu8-kzn' }), [booking({})])?.reference).toBe('DBK-QKSYU8-KZN')
  })
  it('spots one with the same email', () => {
    expect(duplicatedBooking(guest({ email: ' Z@Example.com ' }), [booking({})])).not.toBeNull()
  })
  it('leaves genuine off-platform guests alone', () => {
    expect(duplicatedBooking(guest({ name: 'Masego Mathibe', notes: 'Wix booking', email: 'm@example.com' }), [booking({})])).toBeNull()
    expect(duplicatedBooking(guest({ notes: 'DBK-QKSYU8-KZN' }), [])).toBeNull()
  })
})

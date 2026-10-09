import { describe, expect, it } from 'vitest'
import { bookingPayment, ordersByBooking, type OrderMoney } from '../lib/booking-payment'

const order = (o: Partial<OrderMoney>): OrderMoney => ({
  booking_id: 'b1', payment_status: 'unpaid', total_value: 1000, amount_paid: 0, refund_balance: 0, ...o,
})

describe('bookingPayment', () => {
  it('reads paid only once the full value is captured', () => {
    expect(bookingPayment({ status: 'confirmed' }, [order({ payment_status: 'paid', amount_paid: 1000 })]))
      .toMatchObject({ state: 'paid', captured: 1000 })
  })

  it('is not paid while still awaiting payment', () => {
    expect(bookingPayment({ status: 'pending' }, [order({})]).state).toBe('unpaid')
    expect(bookingPayment({ status: 'confirmed' }, []).state).toBe('unpaid')
  })

  it('shows a deposit as part paid, not paid', () => {
    expect(bookingPayment({ status: 'confirmed' }, [order({ payment_status: 'deposit', amount_paid: 300 })]))
      .toMatchObject({ state: 'partial', captured: 300, due: 1000 })
  })

  it('never reads paid once cancelled — captured money becomes a refund due', () => {
    const cancelled = order({ payment_status: 'paid', amount_paid: 1000, refund_balance: 1000 })
    expect(bookingPayment({ status: 'cancelled' }, [cancelled]))
      .toMatchObject({ state: 'refund_due', captured: 0, refundDue: 1000 })
  })

  it('reads refunded once the refund is recorded', () => {
    expect(bookingPayment({ status: 'cancelled' }, [order({ payment_status: 'refunded', amount_paid: 1000 })]).state)
      .toBe('refunded')
  })

  it('a cancelled booking that was never paid owes nothing', () => {
    expect(bookingPayment({ status: 'cancelled' }, [order({})])).toMatchObject({ state: 'not_due', captured: 0 })
  })

  it('stay requests have nothing to pay', () => {
    expect(bookingPayment({ status: 'requested' }, []).state).toBe('not_due')
  })
})

describe('ordersByBooking', () => {
  it('groups orders and skips unlinked ones', () => {
    const map = ordersByBooking([order({}), order({ booking_id: null }), order({ booking_id: 'b2' })])
    expect(map.get('b1')).toHaveLength(1)
    expect(map.get('b2')).toHaveLength(1)
    expect(map.size).toBe(2)
  })
})

import { describe, expect, it } from 'vitest'
import {
  discountProblem, docLineGross, invoiceGrossItems, invoiceSavings, isWrittenOff,
  lineDiscountAmount, supplierBilledAmount,
} from '@/lib/line-discount'

describe('lineDiscountAmount', () => {
  it('takes an amount or a percentage of the line', () => {
    expect(lineDiscountAmount(600, 'amount', '150')).toBe(150)
    expect(lineDiscountAmount(600, 'percent', '25')).toBe(150)
    expect(lineDiscountAmount(600, 'percent', '100')).toBe(600)
  })
  it('never goes below 0 or above the line', () => {
    expect(lineDiscountAmount(600, 'amount', '900')).toBe(600)
    expect(lineDiscountAmount(600, 'percent', '150')).toBe(600)
    expect(lineDiscountAmount(600, 'amount', '-5')).toBe(0)
    expect(lineDiscountAmount(600, 'amount', '')).toBe(0)
  })
  it('rounds to cents', () => {
    expect(lineDiscountAmount(100, 'percent', '33.333')).toBe(33.33)
  })
})

describe('discountProblem', () => {
  it('flags what the server would refuse', () => {
    expect(discountProblem(600, 'amount', '601')).toMatch(/more than/i)
    expect(discountProblem(600, 'percent', '101')).toMatch(/100%/)
    expect(discountProblem(600, 'amount', '-1')).toMatch(/negative/i)
    expect(discountProblem(600, 'amount', 'abc')).toMatch(/number/i)
  })
  it('accepts blanks and valid values', () => {
    expect(discountProblem(600, 'amount', '')).toBeNull()
    expect(discountProblem(600, 'amount', '600')).toBeNull()
    expect(discountProblem(600, 'percent', '100')).toBeNull()
  })
})

describe('isWrittenOff', () => {
  it('is true only when the whole line is discounted', () => {
    expect(isWrittenOff(600, 600)).toBe(true)
    expect(isWrittenOff(600, 599)).toBe(false)
    expect(isWrittenOff(0, 0)).toBe(false)
  })
})

describe('supplierBilledAmount', () => {
  it('pays on the full price when the platform funded the discount', () => {
    expect(supplierBilledAmount({ gross_amount: 600, discount_amount: 600, discount_funded_by: 'platform' })).toBe(600)
  })
  it('pays on the discounted price otherwise (and for older lines)', () => {
    expect(supplierBilledAmount({ gross_amount: 600, discount_amount: 600, discount_funded_by: 'supplier' })).toBe(0)
    expect(supplierBilledAmount({ gross_amount: '600', discount_amount: '100' })).toBe(500)
  })
})

describe('invoice document savings', () => {
  const lines = [
    { title: 'Northern Mini Traverse', total: 3000 },
    { title: 'Shuttle', total: 0, grossTotal: 600, discount: 600, discountLabel: 'Included in package' },
  ]
  it('adds up the saving and the pre-discount items', () => {
    expect(invoiceSavings(lines)).toBe(600)
    expect(invoiceGrossItems(lines)).toBe(3600)
    expect(docLineGross(lines[1])).toBe(600)
  })
  it('copes with invoices issued before discounts existed', () => {
    expect(invoiceSavings([{ total: 100 }])).toBe(0)
    expect(invoiceSavings(null)).toBe(0)
    expect(docLineGross({ total: 100 })).toBe(100)
  })
})

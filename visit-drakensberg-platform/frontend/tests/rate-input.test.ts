import { describe, it, expect } from 'vitest'
import { rateToPercentInput, percentInputToRate } from '@/lib/allocation'

describe('percentInputToRate', () => {
  it('stores a typed percentage as a fraction', () => {
    expect(percentInputToRate('15')).toBe(0.15)
    expect(percentInputToRate('12.5')).toBe(0.125)
    expect(percentInputToRate('0')).toBe(0)
  })
  it('rejects blanks, junk and 100% or more', () => {
    expect(percentInputToRate('')).toBeNull()
    expect(percentInputToRate('abc')).toBeNull()
    expect(percentInputToRate('100')).toBeNull()
    expect(percentInputToRate('-1')).toBeNull()
  })
})

describe('rateToPercentInput', () => {
  it('shows a stored fraction as the percentage the admin typed', () => {
    expect(rateToPercentInput(0.15)).toBe('15')
    expect(rateToPercentInput(0.125)).toBe('12.5')
    expect(rateToPercentInput(null)).toBe('')
  })
  it('round-trips', () => {
    for (const s of ['7', '12', '12.5', '22.3']) expect(rateToPercentInput(percentInputToRate(s))).toBe(s)
  })
})

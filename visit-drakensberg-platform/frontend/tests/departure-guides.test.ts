import { describe, expect, it } from 'vitest'
import { joinGuides, sameGuides, splitGuides } from '@/lib/departure-guides'

describe('departure guides', () => {
  it('splits the joined field, lead guide first', () => {
    expect(splitGuides('Sipho Dlamini + Thabo Ndlovu')).toEqual(['Sipho Dlamini', 'Thabo Ndlovu'])
    expect(splitGuides('Vezumusa Zuma')).toEqual(['Vezumusa Zuma'])
    expect(splitGuides('')).toEqual([])
    expect(splitGuides(null)).toEqual([])
  })
  it('accepts the other separators people type, and drops repeats', () => {
    expect(splitGuides('A Guide, B Guide & C Guide and D Guide')).toEqual(['A Guide', 'B Guide', 'C Guide', 'D Guide'])
    expect(splitGuides('Sipho + sipho + Thabo')).toEqual(['Sipho', 'Thabo'])
  })
  it('does not split a name that merely contains "and"', () => {
    expect(splitGuides('Andile Mkhize + Sandile Ndlovu')).toEqual(['Andile Mkhize', 'Sandile Ndlovu'])
  })
  it('joins back to the format every page displays', () => {
    expect(joinGuides(['Sipho Dlamini', ' Thabo  Ndlovu '])).toBe('Sipho Dlamini + Thabo Ndlovu')
    expect(joinGuides([])).toBe('')
  })
  it('compares guide lists', () => {
    expect(sameGuides('A + B', 'A+B')).toBe(true)
    expect(sameGuides('A + B', 'B + A')).toBe(false)
    expect(sameGuides('', undefined)).toBe(true)
  })
})

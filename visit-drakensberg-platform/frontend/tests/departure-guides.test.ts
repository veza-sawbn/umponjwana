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

import { guidesLabel, hasGuide } from '@/lib/departure-guides'

describe('guide profiles and labels', () => {
  it('finds a guide on a multi-guide departure, so it stays on both profiles', () => {
    expect(hasGuide('Sipho Dlamini + Thabo Ndlovu', 'Sipho Dlamini')).toBe(true)
    expect(hasGuide('Sipho Dlamini + Thabo Ndlovu', 'thabo ndlovu')).toBe(true)
    expect(hasGuide('Sipho Dlamini + Thabo Ndlovu', 'Sipho')).toBe(false)
    expect(hasGuide('', 'Sipho Dlamini')).toBe(false)
    expect(hasGuide('Sipho Dlamini', '')).toBe(false)
  })
  it('labels one guide as lead, several as guides', () => {
    expect(guidesLabel('Sipho Dlamini')).toBe('Lead Guide')
    expect(guidesLabel('Sipho Dlamini + Thabo Ndlovu')).toBe('Guides')
  })
})

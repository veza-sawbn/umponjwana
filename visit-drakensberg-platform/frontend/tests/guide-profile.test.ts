import { describe, it, expect } from 'vitest'
import { splitGuideName, toParagraphs, cleanBioSections, MAX_BIO_SECTIONS } from '@/lib/guide-profile'

describe('splitGuideName', () => {
  it('splits first names from the surname', () => {
    expect(splitGuideName('Asanda Ndlovu')).toEqual({ first: 'Asanda', last: 'Ndlovu', knownAs: '' })
    expect(splitGuideName('Mary Jane van Wyk')).toEqual({ first: 'Mary Jane van', last: 'Wyk', knownAs: '' })
  })

  it('shows a one-word name as the surname line', () => {
    expect(splitGuideName('Sipho')).toEqual({ first: '', last: 'Sipho', knownAs: '' })
  })

  it.each([
    'Asanda “Charlie” Ndlovu',
    'Asanda "Charlie" Ndlovu',
    'Asanda ‘Charlie’ Ndlovu',
    "Asanda 'Charlie' Ndlovu",
  ])('lifts a quoted nickname out of %j', name => {
    expect(splitGuideName(name)).toEqual({ first: 'Asanda', last: 'Ndlovu', knownAs: 'Charlie' })
  })

  it('prefers the Known as field over a quoted nickname', () => {
    expect(splitGuideName('Asanda “Charlie” Ndlovu', 'Chaz').knownAs).toBe('Chaz')
  })

  it('leaves apostrophes inside a surname alone', () => {
    expect(splitGuideName("Liam O'Brien")).toEqual({ first: 'Liam', last: "O'Brien", knownAs: '' })
  })
})

describe('toParagraphs', () => {
  it('splits on blank lines', () => {
    expect(toParagraphs('One.\n\nTwo.\n  \nThree.')).toEqual(['One.', 'Two.', 'Three.'])
  })

  it('joins hard-wrapped lines within a paragraph', () => {
    expect(toParagraphs('A line\nwrapped here.\n\nNext.')).toEqual(['A line wrapped here.', 'Next.'])
  })

  it('returns nothing for empty text', () => {
    expect(toParagraphs(undefined)).toEqual([])
    expect(toParagraphs('  \n\n ')).toEqual([])
  })
})

describe('cleanBioSections', () => {
  it('trims sections and drops those without text', () => {
    expect(cleanBioSections([
      { heading: '  In the mountains ', body: ' Text. ' },
      { heading: 'Heading only', body: '  ' },
      { heading: '', body: 'Text without a heading.' },
    ])).toEqual([
      { heading: 'In the mountains', body: 'Text.' },
      { heading: '', body: 'Text without a heading.' },
    ])
  })

  it('caps the number of sections', () => {
    const many = Array.from({ length: MAX_BIO_SECTIONS + 2 }, (_, i) => ({ heading: `H${i}`, body: 'x' }))
    expect(cleanBioSections(many)).toHaveLength(MAX_BIO_SECTIONS)
  })

  it('treats a missing value as no sections', () => {
    expect(cleanBioSections(undefined)).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { normaliseGrandTourContent, DEFAULT_GRAND_TOUR_CONTENT, contentId } from '@/lib/grand-tour-content'

describe('normaliseGrandTourContent', () => {
  it('falls back to the built-in content when nothing is saved', () => {
    expect(normaliseGrandTourContent(null)).toEqual(DEFAULT_GRAND_TOUR_CONTENT)
    expect(normaliseGrandTourContent({ stages: [] }).stages).toEqual(DEFAULT_GRAND_TOUR_CONTENT.stages)
  })

  it('keeps ids, renumbers stages by position, and drops invalid stages and blank highlights', () => {
    const c = normaliseGrandTourContent({
      hero: { title: 'The Grand Tour' },
      stages: [
        { id: 'sani-pass', number: 6, name: 'Sani Pass', highlights: [
          { id: 'sani-top', name: 'Sani Top', blurb: 'Lunch at the top' },
          { id: 'new-row', name: '   ', blurb: '' },
        ] },
        { id: 'Bad Id!', name: 'Broken' },
        { id: 'royal-natal', number: 1, name: 'Royal Natal', highlights: [] },
      ],
    })
    expect(c.hero.title).toBe('The Grand Tour')
    expect(c.hero.subtitle).toBe(DEFAULT_GRAND_TOUR_CONTENT.hero.subtitle)
    expect(c.stages.map(s => [s.id, s.number])).toEqual([['sani-pass', 1], ['royal-natal', 2]])
    expect(c.stages[0].highlights.map(h => h.id)).toEqual(['sani-top'])
  })

  it('keeps the three booking steps when only some text was saved', () => {
    const c = normaliseGrandTourContent({ howItWorks: { heading: 'Book in three steps', steps: [{ title: 'Pick' }] } })
    expect(c.howItWorks.heading).toBe('Book in three steps')
    expect(c.howItWorks.steps[0]).toEqual({ title: 'Pick', text: DEFAULT_GRAND_TOUR_CONTENT.howItWorks.steps[0].text })
  })
})

describe('contentId', () => {
  it('makes ids the stage-feature table accepts', () => {
    expect(contentId('Giant’s Castle & Main Caves')).toMatch(/^[a-z0-9-]{1,60}$/)
    expect(contentId('')).toMatch(/^item-/)
  })
})

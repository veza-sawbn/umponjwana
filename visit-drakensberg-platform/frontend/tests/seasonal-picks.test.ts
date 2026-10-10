import { describe, expect, it } from 'vitest'
import { activeSeason, normalizePicks, seasonCopy, seasonFor, selectSeasonalItems } from '@/lib/seasonal-picks'
import type { Trail } from '@/lib/trails'
import type { Activity } from '@/lib/activities'

const trail = (id: string, extra: Partial<Trail> = {}) =>
  ({ id, name: id, status: 'published', seasons: ['winter'], region: '', ...extra }) as Trail
const activity = (id: string, extra: Partial<Activity> = {}) =>
  ({ id, name: id, status: 'active', seasons: ['winter'], region: '', ...extra }) as Activity

const refs = (items: { kind: string; item: { id: string } }[]) => items.map(e => `${e.kind}:${e.item.id}`)

describe('seasonal picks', () => {
  it('follows the calendar unless a season is pinned', () => {
    const july = new Date(2026, 6, 1)
    expect(seasonFor(july)).toBe('winter')
    expect(activeSeason(normalizePicks({}), july)).toBe('winter')
    expect(activeSeason(normalizePicks({ season_mode: 'summer' }), july)).toBe('summer')
  })

  it('auto-fills tagged live listings, interleaved, by default', () => {
    const out = selectSeasonalItems(normalizePicks({}), 'winter',
      [trail('t1'), trail('t2'), trail('draft', { status: 'draft' }), trail('summer', { seasons: ['summer'] })],
      [activity('a1'), activity('off', { status: 'inactive' as Activity['status'] })])
    expect(refs(out)).toEqual(['trail:t1', 'activity:a1', 'trail:t2'])
  })

  it('puts pins first, honours exclusions, type filters and the card cap', () => {
    const config = normalizePicks({
      pinned: { winter: ['activity:a2', 'trail:untagged', 'trail:missing'] } as never,
      excluded: ['trail:t1'],
      max_cards: 3,
    })
    const out = selectSeasonalItems(config, 'winter',
      [trail('t1'), trail('t2'), trail('untagged', { seasons: [] })],
      [activity('a1'), activity('a2')])
    expect(refs(out)).toEqual(['activity:a2', 'trail:untagged', 'activity:a1'])

    const pinsOnly = selectSeasonalItems({ ...config, auto_fill: false, include_trails: false }, 'winter',
      [trail('untagged', { seasons: [] })], [activity('a2')])
    expect(refs(pinsOnly)).toEqual(['activity:a2'])
  })

  it('falls back to the season copy for blank fields', () => {
    const copy = seasonCopy(normalizePicks({ blurbs: { winter: 'Custom' } as never }), 'winter')
    expect(copy).toEqual({ eyebrow: 'Winter · Jun – Aug', heading: 'Recommended this season', blurb: 'Custom' })
  })
})

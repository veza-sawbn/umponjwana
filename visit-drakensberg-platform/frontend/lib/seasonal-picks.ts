import type { Trail } from './trails'
import type { Activity } from './activities'
import type { SeasonalItem } from './modules'
import { SEASON_META, type Season } from './seasons'
import { SITE_CONTENT_DEFAULTS, type SiteContent } from './site-content'

/* ─── Homepage "Recommended this season" selection ──────────────────────────
   Shared by the homepage band and its admin preview so both pick exactly
   the same listings. Admins control it from Admin → Website via the
   `seasonal_picks` site-content section. */

export type SeasonalPicksConfig = SiteContent['seasonal_picks']

/** Southern Hemisphere seasons, matching SEASON_META's month ranges. */
export function seasonFor(date: Date): Season {
  const m = date.getMonth() // 0 = Jan
  if (m === 11 || m <= 1) return 'summer'
  if (m <= 4) return 'autumn'
  if (m <= 7) return 'winter'
  return 'spring'
}

export function activeSeason(config: SeasonalPicksConfig, now: Date = new Date()): Season {
  return config.season_mode && config.season_mode !== 'auto' ? config.season_mode : seasonFor(now)
}

export function itemRef(entry: SeasonalItem): string {
  return `${entry.kind}:${entry.item.id}`
}

/** Fills in any keys an older stored config is missing (the stored row is
 *  only shallow-merged over the defaults). */
export function normalizePicks(config: Partial<SeasonalPicksConfig> | null | undefined): SeasonalPicksConfig {
  const d = SITE_CONTENT_DEFAULTS.seasonal_picks
  const c = { ...d, ...(config ?? {}) }
  return {
    ...c,
    blurbs: { ...d.blurbs, ...(c.blurbs ?? {}) },
    pinned: { ...d.pinned, ...(c.pinned ?? {}) },
    excluded: Array.isArray(c.excluded) ? c.excluded : [],
  }
}

export function seasonCopy(config: SeasonalPicksConfig, season: Season) {
  const meta = SEASON_META[season]
  return {
    eyebrow: config.eyebrow.trim() || `${meta.label} · ${meta.range}`,
    heading: config.heading.trim() || 'Recommended this season',
    blurb: (config.blurbs[season] ?? '').trim() || meta.blurb,
  }
}

/**
 * The listings the band shows for `season`: pinned picks first (in the
 * admin's order), then — when auto-fill is on — published trails and active
 * activities tagged for the season, interleaved so one kind doesn't crowd
 * out the other. Drafts/inactive listings and excluded refs never appear.
 */
export function selectSeasonalItems(
  config: SeasonalPicksConfig,
  season: Season,
  trails: Trail[],
  activities: Activity[],
): SeasonalItem[] {
  const excluded = new Set(config.excluded)
  const liveTrails = config.include_trails ? trails.filter(t => t.status === 'published') : []
  const liveActivities = config.include_activities ? activities.filter(a => a.status === 'active') : []
  const byRef = new Map<string, SeasonalItem>([
    ...liveTrails.map(item => [`trail:${item.id}`, { kind: 'trail' as const, item }] as const),
    ...liveActivities.map(item => [`activity:${item.id}`, { kind: 'activity' as const, item }] as const),
  ])

  const items: SeasonalItem[] = []
  const seen = new Set<string>()
  const add = (entry: SeasonalItem | undefined) => {
    if (!entry) return
    const ref = itemRef(entry)
    if (seen.has(ref) || excluded.has(ref)) return
    seen.add(ref)
    items.push(entry)
  }

  for (const ref of config.pinned[season] ?? []) add(byRef.get(ref))

  if (config.auto_fill) {
    const t = liveTrails.filter(x => (x.seasons ?? []).includes(season))
    const a = liveActivities.filter(x => (x.seasons ?? []).includes(season))
    for (let i = 0; i < Math.max(t.length, a.length); i++) {
      if (t[i]) add({ kind: 'trail', item: t[i] })
      if (a[i]) add({ kind: 'activity', item: a[i] })
    }
  }

  const max = Math.max(1, Number(config.max_cards) || SITE_CONTENT_DEFAULTS.seasonal_picks.max_cards)
  return items.slice(0, max)
}

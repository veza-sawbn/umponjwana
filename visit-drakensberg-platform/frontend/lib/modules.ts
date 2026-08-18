import type { SupabaseClient } from '@supabase/supabase-js'
import { getTrails, trailStartPoint, type Trail } from './trails'
import { getProperties, type Property } from './properties'
import { getActivities, type Activity } from './activities'
import { getPublishedRoutes, type Route } from './transport-routes'
import { regionsMatch } from './regions'
import { SEASON_TOPICS, type Season, type SeasonTopic } from './seasons'

// Automatic-mode resolvers for the reusable page modules described in
// lib/page-composition.ts. These are the "automatic" query behind
// ModuleConfig — no admin-set overrides exist yet (that needs the SEO
// panel's page-composition editor, still unbuilt), so every module
// currently renders in automatic mode: query by region match (and GPS
// proximity where coordinates are available), same relationship logic
// components/booking/SmartRecommendations.tsx already uses for the stay
// sidebar. Curated/hybrid modes (pinnedIds/excludedIds) are ready to layer
// on top of these once that admin surface exists — the resolvers just need
// a PageComposition lookup added at the top, nothing here needs to change.
//
// Server-callable: takes an optional Supabase client so these can run from
// a Server Component (lib/supabase-public.ts) exactly like every other
// data accessor extended in Phase B.

export type NearbyTrailResult = Trail & { distanceKm?: number }
export type NearbyStayResult = Property & { distanceKm?: number }

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

/** Published trails in the same region, nearest-first when origin coordinates are given. */
export async function getNearbyTrails(
  regionName: string,
  opts: { limit?: number; excludeId?: string; originLat?: number; originLng?: number } = {},
  client?: SupabaseClient,
): Promise<NearbyTrailResult[]> {
  const all = client ? await getTrails(client) : await getTrails()
  let matches: NearbyTrailResult[] = all.filter(
    t => t.status === 'published' && t.id !== opts.excludeId && regionsMatch(t.region, regionName)
  )
  if (opts.originLat !== undefined && opts.originLng !== undefined) {
    matches = matches
      .map(t => {
        const start = trailStartPoint(t)
        return { ...t, distanceKm: start ? haversineKm(opts.originLat!, opts.originLng!, start.lat, start.lng) : undefined }
      })
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  }
  return matches.slice(0, opts.limit ?? 4)
}

/** Active properties in the same region, nearest-first when origin coordinates are given. */
export async function getNearbyStays(
  regionName: string,
  opts: { limit?: number; excludeId?: string; originLat?: number; originLng?: number } = {},
  client?: SupabaseClient,
): Promise<NearbyStayResult[]> {
  const all = client ? await getProperties(client) : await getProperties()
  let matches: NearbyStayResult[] = all.filter(
    p => p.status === 'active' && p.id !== opts.excludeId && regionsMatch(p.region, regionName)
  )
  if (opts.originLat !== undefined && opts.originLng !== undefined) {
    matches = matches
      .map(p => ({
        ...p,
        distanceKm: (p.gpsLat && p.gpsLng) ? haversineKm(opts.originLat!, opts.originLng!, parseFloat(p.gpsLat), parseFloat(p.gpsLng)) : undefined,
      }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  }
  return matches.slice(0, opts.limit ?? 4)
}

/** Active activities in the same region. */
export async function getNearbyActivities(
  regionName: string,
  opts: { limit?: number; excludeId?: string } = {},
  client?: SupabaseClient,
): Promise<Activity[]> {
  const all = client ? await getActivities(client) : await getActivities()
  return all
    .filter(a => a.status === 'active' && a.id !== opts.excludeId && regionsMatch(a.region, regionName))
    .slice(0, opts.limit ?? 4)
}

/**
 * Active named shuttle routes (lib/transport-routes.ts) touching this
 * region — matched on either endpoint (`from` or `to`) against the region
 * name, via the same regionsMatch() fuzzy join every other module here
 * uses. Routes have no regionSlug field of their own; reusing regionsMatch
 * on free-text endpoints avoids adding one just for this. See
 * docs/destination-graph/PHASE_H.md.
 */
export async function getNearbyRoutes(
  regionName: string,
  opts: { limit?: number } = {},
  client?: SupabaseClient,
): Promise<Route[]> {
  const all = client ? await getPublishedRoutes(client) : await getPublishedRoutes()
  return all
    .filter(r => regionsMatch(r.from, regionName) || regionsMatch(r.to, regionName))
    .slice(0, opts.limit ?? 4)
}

// ── Season / topic module (Phase I) ─────────────────────────────────────
// Powers /regions/[slug]/[season] — see docs/destination-graph/PHASE_I.md.

export type SeasonalItem =
  | { kind: 'trail'; item: Trail }
  | { kind: 'activity'; item: Activity }

export type SeasonalTopicGroup = { topic: SeasonTopic; items: SeasonalItem[] }

/**
 * Published trails + active activities in this region tagged for this
 * season, grouped by topic (SEASON_TOPICS order), with topics that have no
 * matches omitted entirely — a season page only ever shows groups with
 * real content, same "no empty-state clutter" rule as every other
 * automatic module here.
 */
export async function getSeasonalContent(
  regionName: string,
  season: Season,
  client?: SupabaseClient,
): Promise<SeasonalTopicGroup[]> {
  const [trails, activities] = await Promise.all([
    client ? getTrails(client) : getTrails(),
    client ? getActivities(client) : getActivities(),
  ])

  const matchingTrails = trails.filter(
    t => t.status === 'published' && regionsMatch(t.region, regionName) && (t.seasons ?? []).includes(season)
  )
  const matchingActivities = activities.filter(
    a => a.status === 'active' && regionsMatch(a.region, regionName) && (a.seasons ?? []).includes(season)
  )

  return SEASON_TOPICS.map(topic => {
    const items: SeasonalItem[] = [
      ...matchingTrails.filter(t => (t.topics ?? []).includes(topic)).map(item => ({ kind: 'trail' as const, item })),
      ...matchingActivities.filter(a => (a.topics ?? []).includes(topic)).map(item => ({ kind: 'activity' as const, item })),
    ]
    return { topic, items }
  }).filter(group => group.items.length > 0)
}

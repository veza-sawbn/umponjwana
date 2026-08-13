import type { SupabaseClient } from '@supabase/supabase-js'
import { getTrails, trailStartPoint, type Trail } from './trails'
import { getProperties, type Property } from './properties'
import { getActivities, type Activity } from './activities'
import { regionsMatch } from './regions'

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

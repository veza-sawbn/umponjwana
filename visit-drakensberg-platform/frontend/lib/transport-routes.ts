import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getSupplierEntities, getSupplierEntity, addSupplierEntity, updateSupplierEntity, deleteSupplierEntity,
  type SupplierEntity,
} from './supplier-entities'
import type { GraphFields } from './graph-fields'
import { slugify, uniqueSlug } from './slugify'

// Named shuttle routes are a genuine destination-graph entity that already
// existed as data with nowhere public to render (SEO audit G17 — see
// docs/seo-audit/SEO_GAPS.md). Suppliers create them at /supplier/routes/new
// (see app/supplier/routes/new/page.tsx) against the existing generic
// `supplier_routes` entity kind — this module is a typed wrapper around
// those same rows, not a new storage location, matching the approach taken
// for Events (lib/events.ts). No dedicated "Route" type previously existed
// in lib/transport.ts, which only models on-demand shuttle quoting.
export type Route = SupplierEntity & {
  from: string
  to: string
  fromLat?: string
  fromLng?: string
  toLat?: string
  toLng?: string
  durationH?: number
  durationM?: number
  duration?: string
  distanceKm?: number
  pricePerPerson?: number
  price?: number
  status: 'active' | 'draft' | 'inactive' | string
} & GraphFields

const ENTITY = 'routes'

export async function getRoutes(client?: SupabaseClient): Promise<Route[]> {
  return getSupplierEntities<Route>(ENTITY, undefined, client)
}

export async function getPublishedRoutes(client?: SupabaseClient): Promise<Route[]> {
  const all = await getRoutes(client)
  return all.filter(r => r.status === 'active')
}

export async function getRoutesBySupplier(supplierId: string, client?: SupabaseClient): Promise<Route[]> {
  return getSupplierEntities<Route>(ENTITY, supplierId, client)
}

export async function getRouteById(id: string, client?: SupabaseClient): Promise<Route | null> {
  return getSupplierEntity<Route>(ENTITY, id, client)
}

export async function addRoute(r: Omit<Route, 'id' | 'createdAt'>): Promise<Route> {
  // Slug population (see lib/slugify.ts) — auto-generated from "From to To"
  // unless already supplied, unique against every other route's canonical
  // URL segment (slug || id). No admin/supplier UI collects a slug for
  // routes yet (app/supplier/routes/new/page.tsx doesn't), so this is
  // currently the only source of a route slug.
  const slug = r.slug || uniqueSlug(slugify(`${r.from}-to-${r.to}`), (await getRoutes()).map(e => e.slug || e.id))
  return addSupplierEntity<Route>(ENTITY, { ...r, slug })
}

export async function updateRoute(id: string, patch: Partial<Route>): Promise<void> {
  return updateSupplierEntity<Route>(ENTITY, id, patch)
}

export async function deleteRoute(id: string): Promise<void> {
  return deleteSupplierEntity(ENTITY, id)
}

/** Total minutes of drive time, from either the split H/M fields or a
 *  free-text `duration` string — both forms exist in stored data. */
export function routeDurationMinutes(r: Route): number {
  if (r.durationH !== undefined || r.durationM !== undefined) {
    return (r.durationH ?? 0) * 60 + (r.durationM ?? 0)
  }
  return 0
}

export function routeDurationLabel(r: Route): string {
  if (r.duration) return r.duration
  const h = r.durationH ?? 0
  const m = r.durationM ?? 0
  return `${h}h ${m}m`
}

export function routePrice(r: Route): number {
  return r.pricePerPerson ?? r.price ?? 0
}

/** Slug fallback for a route with no admin-set `slug` — same "create once,
 *  surface everywhere" resolution as every other graph entity (`slug || id`),
 *  formalised here as a helper since routes have no admin slug field yet
 *  (see the "Slug population" phase). */
export function routeSlug(r: Route): string {
  return r.slug || r.id
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './auth'
import type { Activity } from './activities'
import type { Tour } from './tours'
import type { Event } from './events'

// Hand-picked "also at this stage" items on /grand-tour, curated by VD
// Operations from the live catalogue. See
// supabase/migrations/20261009_grand_tour_features.sql for the table and who
// may write it. A feature only points at a catalogue row; everything shown
// (name, price, photo) is read from that row, so it never goes stale.

export type FeatureKind = 'activity' | 'event' | 'tour'

export type GrandTourFeature = {
  id: string
  stageId: string
  kind: FeatureKind
  entityId: string
  position: number
  note: string | null
}

type Row = { id: string; stage_id: string; kind: FeatureKind; entity_id: string; position: number; note: string | null }

const toFeature = (r: Row): GrandTourFeature => ({
  id: r.id, stageId: r.stage_id, kind: r.kind, entityId: r.entity_id, position: r.position, note: r.note,
})

/** Every feature, in stage then display order. Never throws: an empty shelf is a valid page. */
export async function getGrandTourFeatures(client: SupabaseClient = supabase): Promise<GrandTourFeature[]> {
  try {
    const { data } = await client
      .from('vd_grand_tour_features')
      .select('id, stage_id, kind, entity_id, position, note')
      .order('stage_id')
      .order('position')
    return ((data ?? []) as Row[]).map(toFeature)
  } catch {
    return []
  }
}

export async function addGrandTourFeature(input: { stageId: string; kind: FeatureKind; entityId: string; note?: string; position: number }): Promise<GrandTourFeature> {
  const { data, error } = await supabase
    .from('vd_grand_tour_features')
    .insert({
      stage_id: input.stageId,
      kind: input.kind,
      entity_id: input.entityId,
      note: input.note?.trim() || null,
      position: input.position,
    })
    .select('id, stage_id, kind, entity_id, position, note')
    .maybeSingle()
  if (error || !data) {
    if (error?.code === '23505') throw new Error('That is already featured on this stage.')
    throw new Error(error?.message || 'Could not feature this.')
  }
  return toFeature(data as Row)
}

export async function updateGrandTourFeature(id: string, patch: { note?: string | null; position?: number }): Promise<void> {
  const { error } = await supabase.from('vd_grand_tour_features').update(patch).eq('id', id)
  if (error) throw new Error(error.message || 'Could not update this feature.')
}

export async function removeGrandTourFeature(id: string): Promise<void> {
  const { error } = await supabase.from('vd_grand_tour_features').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Could not remove this feature.')
}

/** A catalogue item resolved for display: a card on /grand-tour, or a search result in the ops panel. */
export type CatalogueItem = {
  kind: FeatureKind
  id: string
  name: string
  href: string
  kindLabel: 'Activity' | 'Event' | 'Guided tour'
  image?: string
  price?: number
  detail?: string
  region?: string
  live: boolean
}

export function activityItem(a: Activity): CatalogueItem {
  return {
    kind: 'activity', id: a.id, name: a.name, kindLabel: 'Activity',
    href: a.grandTour?.enabled ? `/grand-tour/${a.slug || a.id}` : `/activities/${a.slug || a.id}`,
    image: a.photos?.[0], price: a.pricePerPerson || undefined, detail: a.category || undefined,
    region: a.region, live: a.status === 'active',
  }
}

export function tourItem(t: Tour): CatalogueItem {
  return {
    kind: 'tour', id: t.id, name: t.name.trim(), kindLabel: 'Guided tour', href: `/tours/${t.slug || t.id}`,
    price: t.pricePerPerson || undefined, detail: t.days ? `${t.days} day${t.days === 1 ? '' : 's'}` : undefined,
    live: t.status === 'active',
  }
}

export function eventItem(e: Event): CatalogueItem {
  const prices = (e.ticketTypes ?? []).map(t => t.price).filter(p => p > 0)
  const next = (e.sessions ?? []).filter(s => s.status === 'active').map(s => s.starts_at).sort()[0] || e.starts_at
  return {
    kind: 'event', id: e.id, name: e.title, kindLabel: 'Event', href: `/events#event-${e.id}`,
    price: prices.length ? Math.min(...prices) : (e.ticket_price || undefined),
    detail: next ? new Date(next).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : undefined,
    region: e.region, live: e.is_published !== false && e.status !== 'draft',
  }
}

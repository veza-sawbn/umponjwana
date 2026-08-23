import { supabase } from './auth'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin-side reads over the behavioural event stream (§4 "Tourism
 * Intelligence Dashboard" / §5 "Booking Funnel"). Read-only: `vd_sessions`
 * and `vd_analytics_events` are admin-SELECT-only under RLS (see
 * supabase/migrations/20260824_customer_intelligence_foundation.sql), so
 * these queries only ever return data for an admin session.
 *
 * Same pattern as the rest of /admin/analytics — bounded client-side reads,
 * aggregated in JS (mirrors getOrders()/getAllOrderLines() there). Event
 * volume is low enough for this to be the right level of engineering; a
 * server-side aggregate RPC is worth adding once it isn't (see the
 * architecture doc's Phase 3 notes).
 * ──────────────────────────────────────────────────────────────────────────── */

export type TrafficEvent = {
  session_id: string | null
  anon_id: string
  event_name: string
  properties: Record<string, unknown>
  page_url: string | null
  occurred_at: string
}

export type TrafficSession = {
  id: string
  anon_id: string
  started_at: string
  landing_page: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  device_type: string | null
}

/** Semantic catalogue-view events (§3) — the "product viewed" funnel stage. */
export const CATALOG_VIEW_EVENTS = new Set([
  'trail_view', 'activity_view', 'accommodation_view', 'tour_view',
  'region_view', 'destination_view', 'guide_profile_viewed',
])

const EVENT_ROW_CAP = 20000

export async function getRecentEvents(days: number): Promise<TrafficEvent[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const { data, error } = await supabase
    .from('vd_analytics_events')
    .select('session_id, anon_id, event_name, properties, page_url, occurred_at')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(EVENT_ROW_CAP)
  if (error) { console.error('[analytics-admin] getRecentEvents failed:', error); return [] }
  return (data ?? []) as TrafficEvent[]
}

export async function getRecentSessions(days: number): Promise<TrafficSession[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const { data, error } = await supabase
    .from('vd_sessions')
    .select('id, anon_id, started_at, landing_page, referrer, utm_source, utm_medium, utm_campaign, device_type')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(EVENT_ROW_CAP)
  if (error) { console.error('[analytics-admin] getRecentSessions failed:', error); return [] }
  return (data ?? []) as TrafficSession[]
}

/** UTM source wins when present (campaign attribution); otherwise the
 *  referrer's bare hostname; otherwise Direct. */
export function trafficSourceLabel(s: Pick<TrafficSession, 'utm_source' | 'referrer'>): string {
  if (s.utm_source) return s.utm_source
  if (!s.referrer) return 'Direct'
  try {
    const host = new URL(s.referrer).hostname.replace(/^www\./, '')
    return host || 'Direct'
  } catch {
    return 'Direct'
  }
}

const CATALOG_LABEL: Record<string, string> = {
  trail_view: 'Hike', activity_view: 'Activity', accommodation_view: 'Stay',
  tour_view: 'Tour', region_view: 'Region', destination_view: 'Destination',
  guide_profile_viewed: 'Guide',
}
export function catalogEventLabel(eventName: string): string {
  return CATALOG_LABEL[eventName] ?? eventName
}

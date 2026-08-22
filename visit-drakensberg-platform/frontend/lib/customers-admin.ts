import { supabase } from './auth'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin CRM reads (§7 "Customer Management System", §18 "Customer 360 View").
 * Read-only, client-side aggregation over live tables — same pattern as
 * lib/analytics-admin.ts and the rest of /admin. `profiles` + the Phase 1
 * CRM/segment tables (supabase/migrations/20260824_customer_intelligence_foundation.sql)
 * are the source of truth; nothing here is a separate copy of that data.
 * ──────────────────────────────────────────────────────────────────────────── */

export type CustomerDirectoryEntry = {
  id: string
  fullName: string
  email: string
  phone: string | null
  role: string
  createdAt: string
  country: string | null
  lifecycleStage: string
  marketingConsent: boolean
  tags: string[]
  tripCount: number
  lifetimeSpend: number
  upcomingTravel: string | null
  lastActivityAt: string | null
}

export type SegmentCount = { id: string; name: string; count: number }

export type CustomerProfile = CustomerDirectoryEntry & {
  interests: string[]
  favouriteDestinations: string[]
  favouriteActivities: string[]
  acquisitionSource: string | null
}

export type CustomerTimelineEntry = {
  at: string
  kind: 'event' | 'order' | 'consent'
  label: string
  detail: string
}

/** Roles that are staff, not customers — excluded from the directory.
 *  Finance/operations collaborators keep base role='visitor' and are
 *  identified separately via profiles.staff_role (see
 *  20260716_order_management.sql / 20260811_delegated_management.sql) — role
 *  alone doesn't catch them, staff_role has to be checked too. */
const STAFF_ROLES = new Set(['admin', 'supplier'])
const isStaff = (p: { role: string; staff_role: string | null }) => STAFF_ROLES.has(p.role) || !!p.staff_role

/** PostgREST caps a single response at its configured max-rows (1000 by
 *  default) — an unbounded select on a table that grows past that silently
 *  returns only the first page. Every whole-table read this module does for
 *  cross-customer aggregation goes through this instead of a bare .select(). */
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const PAGE_SIZE = 1000
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) { console.error(`[customers-admin] ${label} fetch failed:`, error); break }
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

export async function getCustomerDirectory(): Promise<CustomerDirectoryEntry[]> {
  const [profiles, crm, orders] = await Promise.all([
    fetchAllRows(
      (from, to) => supabase.from('profiles').select('id, full_name, email, phone, role, staff_role, created_at').range(from, to),
      'profiles',
    ),
    fetchAllRows(
      (from, to) => supabase.from('vd_customer_profiles').select('user_id, country, lifecycle_stage, marketing_consent, tags, last_seen_at').range(from, to),
      'vd_customer_profiles',
    ),
    fetchAllRows(
      (from, to) => supabase.from('vd_orders').select('user_id, total_value, booking_status, travel_start, created_at').range(from, to),
      'vd_orders',
    ),
  ])

  const crmByUser = new Map(crm.map(c => [c.user_id, c]))

  type OrderFact = { tripCount: number; lifetimeSpend: number; upcomingTravel: string | null; lastActivityAt: string }
  const factsByUser = new Map<string, OrderFact>()
  for (const o of orders) {
    if (!o.user_id || o.booking_status === 'cancelled') continue
    const f = factsByUser.get(o.user_id) ?? { tripCount: 0, lifetimeSpend: 0, upcomingTravel: null, lastActivityAt: o.created_at }
    f.tripCount += 1
    f.lifetimeSpend += Number(o.total_value) || 0
    if (o.travel_start && o.travel_start >= new Date().toISOString().slice(0, 10)) {
      if (!f.upcomingTravel || o.travel_start < f.upcomingTravel) f.upcomingTravel = o.travel_start
    }
    if (o.created_at > f.lastActivityAt) f.lastActivityAt = o.created_at
    factsByUser.set(o.user_id, f)
  }

  return profiles
    .filter(p => !isStaff(p))
    .map(p => {
      const crmProfile = crmByUser.get(p.id)
      const facts = factsByUser.get(p.id)
      // Neither source is unconditionally newer — a browsing session can
      // land after a customer's last order (or vice versa) — so the real
      // "last activity" is whichever timestamp is actually later, not a
      // fixed preference between the two sources.
      const lastActivityAt = [facts?.lastActivityAt, crmProfile?.last_seen_at]
        .filter((d): d is string => Boolean(d))
        .sort()
        .pop() ?? null
      return {
        id: p.id,
        fullName: p.full_name?.trim() || p.email || 'Unnamed',
        email: p.email ?? '',
        phone: p.phone ?? null,
        role: p.role,
        createdAt: p.created_at,
        country: crmProfile?.country ?? null,
        lifecycleStage: crmProfile?.lifecycle_stage ?? 'visitor',
        marketingConsent: crmProfile?.marketing_consent ?? false,
        tags: crmProfile?.tags ?? [],
        tripCount: facts?.tripCount ?? 0,
        lifetimeSpend: facts?.lifetimeSpend ?? 0,
        upcomingTravel: facts?.upcomingTravel ?? null,
        lastActivityAt,
      }
    })
}

export async function getCustomerById(userId: string): Promise<CustomerProfile | null> {
  const [{ data: profile, error: pErr }, { data: crm, error: cErr }, { data: orders, error: oErr }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, phone, role, staff_role, created_at').eq('id', userId).maybeSingle(),
    supabase.from('vd_customer_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('vd_orders').select('total_value, booking_status, travel_start, created_at').eq('user_id', userId),
  ])
  if (pErr) console.error('[customers-admin] profile fetch failed:', pErr)
  if (cErr) console.error('[customers-admin] vd_customer_profiles fetch failed:', cErr)
  if (oErr) console.error('[customers-admin] vd_orders fetch failed:', oErr)
  if (!profile || isStaff(profile)) return null

  let tripCount = 0, lifetimeSpend = 0, upcomingTravel: string | null = null, lastOrderAt: string | null = null
  const today = new Date().toISOString().slice(0, 10)
  for (const o of orders ?? []) {
    if (o.booking_status === 'cancelled') continue
    tripCount += 1
    lifetimeSpend += Number(o.total_value) || 0
    if (o.travel_start && o.travel_start >= today && (!upcomingTravel || o.travel_start < upcomingTravel)) upcomingTravel = o.travel_start
    if (!lastOrderAt || o.created_at > lastOrderAt) lastOrderAt = o.created_at
  }
  // See the matching comment in getCustomerDirectory() — neither source is
  // unconditionally newer, so take whichever timestamp is actually later.
  const lastActivityAt = [lastOrderAt, crm?.last_seen_at].filter((d): d is string => Boolean(d)).sort().pop() ?? profile.created_at

  return {
    id: profile.id,
    fullName: profile.full_name?.trim() || profile.email || 'Unnamed',
    email: profile.email ?? '',
    phone: profile.phone ?? null,
    role: profile.role,
    createdAt: profile.created_at,
    country: crm?.country ?? null,
    lifecycleStage: crm?.lifecycle_stage ?? 'visitor',
    marketingConsent: crm?.marketing_consent ?? false,
    tags: crm?.tags ?? [],
    tripCount,
    lifetimeSpend,
    upcomingTravel,
    lastActivityAt,
    interests: crm?.interests ?? [],
    favouriteDestinations: crm?.favourite_destinations ?? [],
    favouriteActivities: crm?.favourite_activities ?? [],
    acquisitionSource: crm?.acquisition_source ?? null,
  }
}

/** Segment names this customer currently belongs to (computed membership,
 *  see vd_recompute_segments() — never hand-assigned). */
export async function getCustomerSegmentNames(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('vd_customer_segment_members')
    .select('vd_customer_segments(name)')
    .eq('user_id', userId)
  if (error) { console.error('[customers-admin] customer segments fetch failed:', error); return [] }
  return (data ?? [])
    .map((r: any) => r.vd_customer_segments?.name as string | undefined)
    .filter((n: string | undefined): n is string => Boolean(n))
}

export async function getSegmentCounts(): Promise<SegmentCount[]> {
  const [{ data: segments, error: sErr }, members] = await Promise.all([
    supabase.from('vd_customer_segments').select('id, name').order('name'),
    fetchAllRows(
      (from, to) => supabase.from('vd_customer_segment_members').select('segment_id').range(from, to),
      'vd_customer_segment_members',
    ),
  ])
  if (sErr) { console.error('[customers-admin] segments fetch failed:', sErr); return [] }

  const counts = new Map<string, number>()
  for (const m of members) counts.set(m.segment_id, (counts.get(m.segment_id) ?? 0) + 1)
  return (segments ?? []).map(s => ({ id: s.id, name: s.name, count: counts.get(s.id) ?? 0 }))
}

export async function getSegmentMemberIds(segmentId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('vd_customer_segment_members').select('user_id').eq('segment_id', segmentId)
  if (error) { console.error('[customers-admin] segment members fetch failed:', error); return new Set() }
  return new Set((data ?? []).map(r => r.user_id))
}

/** Admin-triggered recompute — vd_recompute_segments() also checks is_admin()
 *  itself server-side; this is a convenience wrapper, not the security boundary. */
export async function recomputeSegments(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('vd_recompute_segments', {})
  return { error: error?.message ?? null }
}

function eventLabel(eventName: string, properties: Record<string, unknown>): string {
  const name = (properties?.name as string) || (properties?.id as string) || ''
  switch (eventName) {
    case 'page_view': return 'Viewed a page'
    case 'trail_view': return `Viewed hike${name ? `: ${name}` : ''}`
    case 'activity_view': return `Viewed activity${name ? `: ${name}` : ''}`
    case 'accommodation_view': return `Viewed stay${name ? `: ${name}` : ''}`
    case 'tour_view': return `Viewed tour${name ? `: ${name}` : ''}`
    case 'region_view': return `Viewed region${name ? `: ${name}` : ''}`
    case 'destination_view': return `Viewed destination${name ? `: ${name}` : ''}`
    case 'guide_profile_viewed': return `Viewed guide profile${name ? `: ${name}` : ''}`
    case 'search_performed': return `Searched${properties?.query ? `: "${properties.query}"` : ''}`
    case 'filter_used': return 'Applied a filter'
    case 'booking_started': return 'Started a booking'
    case 'booking_completed': return `Completed a booking${properties?.reference ? ` (${properties.reference})` : ''}`
    case 'account_created': return 'Created an account'
    case 'login': return 'Signed in'
    case 'newsletter_signup': return 'Subscribed to the newsletter'
    default: return eventName.replace(/_/g, ' ')
  }
}

/** The Customer 360 timeline (§18) — orders, behavioural events and consent
 *  changes merged into one chronological feed for a single customer. */
export async function getCustomerTimeline(userId: string, eventLimit = 200): Promise<CustomerTimelineEntry[]> {
  const [{ data: events, error: eErr }, { data: orders, error: oErr }, { data: consents, error: cErr }] = await Promise.all([
    supabase.from('vd_analytics_events')
      .select('event_name, properties, occurred_at')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(eventLimit),
    supabase.from('vd_orders')
      .select('order_number, trip_name, trip_status, booking_status, total_value, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase.from('vd_customer_consents')
      .select('consent_type, granted, source, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])
  if (eErr) console.error('[customers-admin] events fetch failed:', eErr)
  if (oErr) console.error('[customers-admin] orders fetch failed:', oErr)
  if (cErr) console.error('[customers-admin] consents fetch failed:', cErr)

  const entries: CustomerTimelineEntry[] = []
  for (const e of events ?? []) {
    entries.push({ at: e.occurred_at, kind: 'event', label: eventLabel(e.event_name, e.properties ?? {}), detail: '' })
  }
  for (const o of orders ?? []) {
    entries.push({
      at: o.created_at, kind: 'order',
      label: `Order ${o.order_number} — ${o.trip_name || 'Trip'}`,
      detail: `${o.booking_status}${o.trip_status && o.trip_status !== 'planned' ? ` · ${o.trip_status}` : ''} · R ${Number(o.total_value).toLocaleString()}`,
    })
  }
  for (const c of consents ?? []) {
    entries.push({
      at: c.created_at, kind: 'consent',
      label: `${c.granted ? 'Opted in to' : 'Opted out of'} ${c.consent_type.replace(/_/g, ' ')}`,
      detail: `via ${c.source.replace(/_/g, ' ')}`,
    })
  }

  return entries.sort((a, b) => b.at.localeCompare(a.at))
}

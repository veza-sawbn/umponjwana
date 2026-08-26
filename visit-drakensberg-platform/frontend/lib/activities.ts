import { listEntities, getEntity, insertEntity, updateEntity, deleteEntity, newEntityId, listEntitiesByOwner } from './entities'
import type { GraphFields } from './graph-fields'
import { slugify, uniqueSlug } from './slugify'
import type { Season, SeasonTopic } from './seasons'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './auth'

// Single canonical activity-category vocabulary — imported by both the
// supplier creation/edit forms and the public /activities filter tabs.
// Previously these were two independently hand-maintained lists that had
// drifted apart: the supplier form offered 'Nature'/'Water' (which the
// public page never showed, making activities tagged with them
// unreachable via the public filter), and the public page offered
// 'Wildlife' (which no supplier could ever select, so the tab always
// returned zero results). This list is their union, plus the destination
// graph's new "Things to Do" taxonomy values.
export const ACTIVITY_CATEGORIES = [
  'Adventure', 'Nature', 'Water', 'Wildlife', 'Cultural', 'Wellness', 'Family',
  'Photography', 'Horse Riding', 'Fishing', 'Rock Climbing', 'Cycling',
] as const

export type ActivityCategory = typeof ACTIVITY_CATEGORIES[number]

// The other two halves of that shared vocabulary, on the same footing as the
// categories above: the supplier wizard, the activity edit form and the public
// listing application all read these rather than keeping their own copies.
export const ACTIVITY_DIFFICULTIES = ['Easy', 'Moderate', 'Challenging', 'Extreme']

export const ACTIVITY_INCLUSIONS = [
  'Helmet & Harness', 'Guide', 'Safety Briefing', 'Refreshments',
  'Transport to Site', 'Photos/Video', 'Equipment',
]

// A recurring time-of-day this activity departs, independent of any
// specific date — e.g. "09:00" and "13:30" every day, or "07:00" on
// weekends only. Suppliers configure these on the listing; visitors pick
// one alongside a date at booking time (ActivityDetail.tsx). Capacity is
// tracked per (date, timeslot) via slotBookings below, kept accurate with
// the atomic vd_book_activity_slot()/vd_release_activity_slot() RPCs — see
// supabase/migrations/20260829_activity_timeslots.sql — the same pattern
// lib/departures.ts uses for tour seats.
export type ActivityTimeslot = {
  id: string
  /** 24-hour "HH:mm". */
  time: string
  capacity: number
  /** Days this slot runs, 0=Sun..6=Sat. Empty = every day. */
  days: number[]
}

export type Activity = {
  id: string
  supplierId: string
  supplierName: string
  name: string
  category: string
  region: string
  difficulty: string
  description: string
  durationH: number
  durationM: number
  minAge: number
  maxGroup: number
  meetingPoint: string
  gpsLat: string
  gpsLng: string
  whatToWear: string
  photos: string[]
  included: string[]
  safetyNotes: string
  /** Adult (default) per-person rate. */
  pricePerPerson: number
  priceGroup: number
  /** Per-child rate. Only applied when childMaxAge is also set — activities
   *  created before this existed have neither, so everyone pays
   *  pricePerPerson as before. */
  childPrice?: number
  /** Age in years, inclusive, at or under which the child rate applies. */
  childMaxAge?: number
  /** Recurring departure times for this activity. Empty/absent = no fixed
   *  timeslots — visitors just pick a date (legacy behaviour). */
  timeslots?: ActivityTimeslot[]
  /** Seats already taken per (date, timeslot), keyed `${date}:${timeslotId}`.
   *  Written only by the booking RPCs — never set this from client code. */
  slotBookings?: Record<string, number>
  depositRequired: boolean
  depositPercent: string
  status: 'active' | 'draft'
  createdAt: string
  /** Which seasons this activity suits — powers the region "When to Go"
   *  module and /regions/[slug]/[season] pages. See lib/seasons.ts. */
  seasons?: Season[]
  /** Which season-page topic groups ("By Water", "In the Mountains", …)
   *  this activity should appear under. See lib/seasons.ts. */
  topics?: SeasonTopic[]
} & GraphFields

const KIND = 'activity'

export function newActivityTimeslotId(): string {
  return newEntityId('slot')
}

/** The timeslots (if any) that run on the given day, in time order. */
export function timeslotsForDate(activity: Pick<Activity, 'timeslots'>, dateStr: string): ActivityTimeslot[] {
  if (!activity.timeslots?.length || !dateStr) return []
  const day = new Date(`${dateStr}T00:00:00`).getDay()
  return activity.timeslots
    .filter(t => !t.days?.length || t.days.includes(day))
    .sort((a, b) => a.time.localeCompare(b.time))
}

export function slotBookedCount(activity: Pick<Activity, 'slotBookings'>, dateStr: string, timeslotId: string): number {
  return activity.slotBookings?.[`${dateStr}:${timeslotId}`] ?? 0
}

/** Best-effort remaining seats for display — the source of truth is the
 *  atomic RPC checked at checkout, same as tour departures. */
export function slotRemaining(activity: Pick<Activity, 'timeslots' | 'slotBookings'>, dateStr: string, timeslotId: string): number {
  const slot = activity.timeslots?.find(t => t.id === timeslotId)
  if (!slot) return 0
  return Math.max(slot.capacity - slotBookedCount(activity, dateStr, timeslotId), 0)
}

/** Visitor-side booking: atomic, capacity-checked, executed server-side.
 *  Throws with a readable message when the timeslot is full for that date. */
export async function bookActivityTimeslot(activityId: string, dateStr: string, timeslotId: string, seats: number): Promise<void> {
  const { error } = await supabase.rpc('vd_book_activity_slot', {
    p_activity_id: activityId, p_slot_date: dateStr, p_timeslot_id: timeslotId, p_seats: seats,
  })
  if (error) throw new Error(error.message || 'Could not reserve this timeslot')
}

/** Free seats after a cancellation (booking owner or supplier). */
export async function releaseActivityTimeslot(activityId: string, dateStr: string, timeslotId: string, seats: number): Promise<void> {
  const { error } = await supabase.rpc('vd_release_activity_slot', {
    p_activity_id: activityId, p_slot_date: dateStr, p_timeslot_id: timeslotId, p_seats: seats,
  })
  if (error) throw new Error(error.message || 'Could not release this timeslot')
}

export async function getActivities(client?: SupabaseClient): Promise<Activity[]> {
  return client ? listEntities<Activity>(KIND, client) : listEntities<Activity>(KIND)
}

export async function getActivitiesBySupplier(supplierId: string): Promise<Activity[]> {
  // Owner-scoped at the database — see the note in lib/entities.ts on why
  // listEntities() must not be used for supplier-facing reads.
  return listEntitiesByOwner<Activity>(KIND, supplierId)
}

export async function getActivityById(id: string, client?: SupabaseClient): Promise<Activity | null> {
  return client ? getEntity<Activity>(KIND, id, client) : getEntity<Activity>(KIND, id)
}

// The public activity page (app/activities/[id]/page.tsx) is ISR-cached for
// 5 minutes, so without this a supplier's price/timeslot/child-rate edit
// wouldn't reach visitors until that cache window happened to expire. Best-
// effort and non-blocking — a failed revalidate (e.g. offline) still leaves
// the save itself intact, just stale until the cache naturally expires.
function revalidateActivityPage(id: string, slug?: string): void {
  if (typeof fetch !== 'function') return
  fetch('/api/revalidate/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, slug }),
  }).catch(() => {})
}

export async function addActivity(a: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> {
  // Slug population (see lib/slugify.ts) — auto-generated from the
  // activity name unless already supplied, unique against every other
  // activity's canonical URL segment (slug || id).
  const slug = a.slug || uniqueSlug(slugify(a.name), (await getActivities()).map(e => e.slug || e.id))
  const activity: Activity = { ...a, slug, id: newEntityId('act'), createdAt: new Date().toISOString() }
  const saved = await insertEntity(KIND, activity)
  revalidateActivityPage(saved.id, saved.slug)
  return saved
}

export async function updateActivity(id: string, patch: Partial<Activity>): Promise<void> {
  await updateEntity(KIND, id, patch)
  // patch usually won't carry `slug` (the edit form never touches it), so
  // read it back rather than assuming the id-only path is enough — visitor
  // links built from `slug || id` (regions, hikes) need that path busted too.
  const current = await getActivityById(id)
  revalidateActivityPage(id, current?.slug)
}

export async function deleteActivity(id: string): Promise<void> {
  await deleteEntity(KIND, id)
}

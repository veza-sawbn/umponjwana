// Pure timeslot helpers and the ActivityTimeslot type, kept free of any
// Supabase import so code that only needs to reason about departures (the
// Grand Tour, unit tests) can use them without creating a database client.
// lib/activities.ts re-exports all of it, so existing imports keep working.

type SlotFields = {
  timeslots?: ActivityTimeslot[]
  /** Seats already taken per (date, timeslot), keyed `${date}:${timeslotId}`. */
  slotBookings?: Record<string, number>
}

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

/** The timeslots (if any) that run on the given day, in time order. */
export function timeslotsForDate(activity: Pick<SlotFields, 'timeslots'>, dateStr: string): ActivityTimeslot[] {
  if (!activity.timeslots?.length || !dateStr) return []
  const day = new Date(`${dateStr}T00:00:00`).getDay()
  return activity.timeslots
    .filter(t => !t.days?.length || t.days.includes(day))
    .sort((a, b) => a.time.localeCompare(b.time))
}

export function slotBookedCount(activity: Pick<SlotFields, 'slotBookings'>, dateStr: string, timeslotId: string): number {
  return activity.slotBookings?.[`${dateStr}:${timeslotId}`] ?? 0
}

/** Best-effort remaining seats for display — the source of truth is the
 *  atomic RPC checked at checkout, same as tour departures. */
export function slotRemaining(activity: SlotFields, dateStr: string, timeslotId: string): number {
  const slot = activity.timeslots?.find(t => t.id === timeslotId)
  if (!slot) return 0
  return Math.max(slot.capacity - slotBookedCount(activity, dateStr, timeslotId), 0)
}

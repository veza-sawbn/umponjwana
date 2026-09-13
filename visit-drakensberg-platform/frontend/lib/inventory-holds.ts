import { supabase } from './auth'

/**
 * Inventory holds — the client side of
 * supabase/migrations/20260914_inventory_holds.sql.
 *
 * A hold takes the seats AND records who took them and until when, which is
 * what the old vd_book_seats / vd_book_activity_slot pair could not do: they
 * moved a counter and recorded nothing, so nothing could tell an abandoned
 * checkout from a real booking, nothing could give the seats back on its own,
 * and nothing counted how many an account had already taken.
 *
 * The flow /checkout follows:
 *
 *   1. holdDepartureSeats / holdActivitySlot for each addon, collecting ids
 *   2. on any failure, releaseInventoryHolds(collected) and stop
 *   3. once the booking row exists, claimInventoryHolds(bookingId, collected)
 *
 * A hold nobody claims expires after vd_hold_ttl_minutes (30) and is swept by
 * /api/cron/expire-pending-bookings. So step 2 failing — a closed tab, a
 * crashed browser — costs the operator half an hour of one seat, not the seat.
 */

export type HoldId = string

/** Reserve seats on a tour departure. Returns the hold id. */
export async function holdDepartureSeats(departureId: string, seats: number): Promise<HoldId> {
  const { data, error } = await supabase.rpc('vd_hold_inventory', {
    p_kind: 'departure',
    p_entity_id: departureId,
    p_slot_key: '',
    p_seats: seats,
  })
  if (error) throw new Error(error.message || 'Could not reserve seats')
  return data as HoldId
}

/** Reserve seats on one (date, timeslot) of an activity. Returns the hold id. */
export async function holdActivitySlot(
  activityId: string, dateStr: string, timeslotId: string, seats: number,
): Promise<HoldId> {
  const { data, error } = await supabase.rpc('vd_hold_inventory', {
    p_kind: 'activity_slot',
    p_entity_id: activityId,
    p_slot_key: `${dateStr}:${timeslotId}`,
    p_seats: seats,
  })
  if (error) throw new Error(error.message || 'Could not reserve this timeslot')
  return data as HoldId
}

/**
 * Give back holds that were never claimed — the checkout rollback path.
 * Best-effort per hold: one failure must not strand the others, and the sweep
 * will collect anything this misses.
 */
export async function releaseInventoryHolds(holdIds: HoldId[]): Promise<void> {
  await Promise.all(holdIds.map(id =>
    supabase.rpc('vd_release_inventory_hold', { p_hold_id: id }).then(({ error }) => {
      if (error) console.error('[holds] release failed:', error.message)
    }),
  ))
}

/**
 * Attach holds to the booking that now owns them. From here the booking's
 * lifecycle decides when the seats come back, so the holds stop expiring on
 * their own — a confirmed booking must not lose its seats to a TTL.
 */
export async function claimInventoryHolds(bookingId: string, holdIds: HoldId[]): Promise<number> {
  if (holdIds.length === 0) return 0
  const { data, error } = await supabase.rpc('vd_claim_inventory_holds', {
    p_booking_id: bookingId,
    p_hold_ids: holdIds,
  })
  if (error) throw new Error(error.message || 'Could not attach your reservation to the booking')
  return (data as number) ?? 0
}

/**
 * Release everything a booking holds — the cancellation path, for the guest,
 * a supplier on the booking, or staff.
 *
 * Replaces the loops the cancellation pages used to run client-side, which
 * re-derived what to release from the addons blob and walked departures and
 * timeslots separately. The server now releases exactly the holds that booking
 * took, and falls back to the same addon walk only for bookings made before
 * holds existed.
 */
export async function releaseBookingInventory(bookingId: string): Promise<number> {
  const { data, error } = await supabase.rpc('vd_release_booking_inventory', {
    p_booking_id: bookingId,
  })
  if (error) {
    // Never blocks a cancellation: the booking being cancelled matters more
    // than the seats coming back this second, and the sweep is the backstop.
    console.error('[holds] booking release failed:', error.message)
    return 0
  }
  return (data as number) ?? 0
}

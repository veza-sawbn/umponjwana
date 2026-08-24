import { supabase } from './auth'
import { getEffectiveSupplierId } from './effective-supplier'
import { bookDepartureSeats, releaseDepartureSeats } from './departures'

// Guests manually recorded against a departure by the supplier — the
// "migrating from Wix Events" path: a departure already has people booked
// on it from outside this platform, and the supplier just needs to record
// who they are, not sell them a seat. See supabase/migrations/
// 20260821_departure_guests.sql for the table/RLS this wraps; unlike
// vd_entities, it has no public read policy since these rows carry PII.

export type DepartureGuest = {
  id: string
  departureId: string
  supplierId: string
  name: string
  email: string | null
  phone: string | null
  seats: number
  notes: string | null
  /** Which DeparturePackage (lib/departures.ts) this guest paid for, if the departure has more than one rate. */
  packageId: string | null
  createdAt: string
}

type GuestRow = {
  id: string
  departure_id: string
  supplier_id: string
  name: string
  email: string | null
  phone: string | null
  seats: number
  notes: string | null
  package_id: string | null
  created_at: string
}

function rowToGuest(row: GuestRow): DepartureGuest {
  return {
    id: row.id,
    departureId: row.departure_id,
    supplierId: row.supplier_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    seats: row.seats,
    notes: row.notes,
    packageId: row.package_id,
    createdAt: row.created_at,
  }
}

/** Guests recorded against one departure, oldest first. */
export async function getGuestsForDeparture(departureId: string): Promise<DepartureGuest[]> {
  const { data } = await supabase
    .from('vd_departure_guests')
    .select('*')
    .eq('departure_id', departureId)
    .order('created_at', { ascending: true })
  return ((data ?? []) as GuestRow[]).map(rowToGuest)
}

/**
 * Records a guest who already booked outside the platform (e.g. migrating
 * a departure's existing Wix Events guest list) and reserves their seats on
 * the departure through the same atomic, capacity-checked RPC the public
 * checkout flow uses (bookDepartureSeats/vd_book_seats) — so a manual entry
 * can never oversell a departure the way a plain field edit could.
 *
 * Also adds the guest to the supplier's contacts (vd_add_supplier_contact,
 * 20260828 migration) whenever they have a name or email — this always
 * happens, it isn't optional, matching how a real checkout booking already
 * creates a contact automatically. Best-effort: a contact-save failure
 * (e.g. neither name nor email given) never blocks saving the guest itself.
 */
export async function addManualGuest(input: {
  departureId: string
  name: string
  email?: string
  phone?: string
  seats?: number
  notes?: string
  /** DeparturePackage id (lib/departures.ts) this guest paid for, if the departure has more than one rate. */
  packageId?: string
}): Promise<DepartureGuest> {
  const supplierId = await getEffectiveSupplierId()
  if (!supplierId) throw new Error('You need to be signed in to add a guest.')
  const name = input.name.trim()
  if (!name) throw new Error('Guest name is required.')
  const seats = Math.max(1, Math.floor(input.seats ?? 1))

  // Reserve the seats first — if the departure doesn't have room, this
  // throws and no guest row is written.
  await bookDepartureSeats(input.departureId, seats)

  const { data, error } = await supabase
    .from('vd_departure_guests')
    .insert({
      departure_id: input.departureId,
      supplier_id: supplierId,
      name,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      seats,
      notes: input.notes?.trim() || null,
      package_id: input.packageId || null,
    })
    .select()
    .maybeSingle()

  if (error || !data) {
    // Roll back the seat reservation so a failed save never leaves phantom
    // booked seats behind.
    await releaseDepartureSeats(input.departureId, seats).catch(() => {})
    throw new Error(error?.message || 'Could not save this guest.')
  }

  await supabase
    .rpc('vd_add_supplier_contact', {
      p_supplier_id: supplierId,
      p_name: name,
      p_email: input.email?.trim() || null,
      p_phone: input.phone?.trim() || null,
    })
    .then(({ error: contactError }) => {
      if (contactError) console.error('[departure-guests] contact save failed:', contactError)
    })

  return rowToGuest(data as GuestRow)
}

/** Removes a manually-added guest and releases their seats back to the departure. */
export async function removeManualGuest(guest: DepartureGuest): Promise<void> {
  const { error } = await supabase.from('vd_departure_guests').delete().eq('id', guest.id)
  if (error) throw new Error(error.message || 'Could not remove this guest.')
  await releaseDepartureSeats(guest.departureId, guest.seats)
}

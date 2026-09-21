import { supabase } from './auth'
import { trackEvent, AnalyticsEvent } from './analytics'

/* ────────────────────────────────────────────────────────────────────────────
 * Saved listings ("favourites") — the persistence behind the heart button on
 * every public listing card and /account/saved.
 *
 * Two stores, one API:
 *
 *   signed in  → `vd_saved_listings` (see the 20260913_saved_listings.sql
 *                migration). RLS scopes every read and write to the caller.
 *   signed out → localStorage.
 *
 * A visitor browsing anonymously is the normal case on this site — most people
 * find a lodge before they make an account — so refusing to save until they
 * sign up would lose the save at exactly the moment they wanted it. Guest
 * saves go to localStorage and mergeGuestSaves() folds them into the account
 * the first time that browser signs in, so nothing is dropped on the way.
 *
 * BROWSER-ONLY: localStorage and the client-component Supabase client. Do not
 * import from a Server Component.
 * ──────────────────────────────────────────────────────────────────────────── */

/** What kind of thing was saved. Drives the label and the link on the card. */
export type SavedListingType =
  | 'stay'
  | 'activity'
  | 'hike'
  | 'tour'
  | 'package'
  | 'experience'

export type SavedListing = {
  id: string
  type: SavedListingType
  title: string
  /** Region/town/meeting point — whatever the listing shows as its place. */
  location?: string
  /** Per-night for a stay, per-person for everything else; null when the
   *  listing quotes on request. */
  price?: number | null
  image?: string
  rating?: number
  /** Where the card links. Derived from type+id when a caller omits it. */
  href?: string
  /** ISO-8601. Set on save; the sort key on /account/saved. */
  savedAt?: string
}

/** The listing as a caller hands it over — savedAt is ours to stamp. */
export type SaveableListing = Omit<SavedListing, 'savedAt'>

export const SAVED_TYPE_LABEL: Record<SavedListingType, string> = {
  stay: 'Stay',
  activity: 'Activity',
  hike: 'Hike',
  tour: 'Tour',
  package: 'Package',
  experience: 'Experience',
}

/** Price suffix per type — a stay quotes per night, the rest per person. */
export const SAVED_TYPE_PRICE_SUFFIX: Record<SavedListingType, string> = {
  stay: '/night',
  activity: '/person',
  hike: '',
  tour: '/person',
  package: '/person',
  experience: '/person',
}

const TYPE_ROUTE: Record<SavedListingType, string> = {
  stay: '/stays',
  activity: '/activities',
  hike: '/hikes',
  tour: '/tours',
  package: '/packages',
  experience: '/experiences',
}

/**
 * The identity of a save. Type-qualified rather than the bare id because the
 * saveable things come from three different stores (vd_entities, site_content
 * trails, editorial) and nothing guarantees their ids never collide.
 */
export function savedKey(type: SavedListingType, id: string): string {
  return `${type}:${id}`
}

export function listingHref(listing: Pick<SavedListing, 'type' | 'id' | 'href'>): string {
  return listing.href || `${TYPE_ROUTE[listing.type]}/${listing.id}`
}

/* ── Guest store ─────────────────────────────────────────────────────────── */

const GUEST_KEY = 'vd_saved_listings_v1'

function readGuestSaves(): SavedListing[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedListing[]).filter(l => l?.id && l?.type) : []
  } catch {
    return []
  }
}

function writeGuestSaves(listings: SavedListing[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(listings))
  } catch {
    // Private-mode / quota — the save is lost, but nothing else should break.
  }
}

/* ── Row mapping ─────────────────────────────────────────────────────────── */

type Row = {
  listing_id: string
  listing_type: string
  value: Record<string, unknown> | null
  created_at: string
}

function rowToListing(r: Row): SavedListing {
  const value = (r.value ?? {}) as Partial<SavedListing>
  return {
    ...value,
    id: r.listing_id,
    type: r.listing_type as SavedListingType,
    // A row saved before a field existed (or by an older client) still has to
    // render — fall back to the id rather than an empty card.
    title: value.title || r.listing_id,
    savedAt: r.created_at,
  }
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

/**
 * Every listing the visitor has saved, newest first. Reads the account when
 * signed in and localStorage otherwise, so callers never branch on auth.
 */
export async function getSavedListings(): Promise<SavedListing[]> {
  const userId = await currentUserId()
  if (!userId) {
    return readGuestSaves().sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
  }
  try {
    const { data } = await supabase
      .from('vd_saved_listings')
      .select('listing_id, listing_type, value, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return (data as Row[]).map(rowToListing)
  } catch {}
  return []
}

/* ── Writes ──────────────────────────────────────────────────────────────── */

/**
 * Saves a listing. Idempotent — saving something already saved refreshes its
 * snapshot (a re-priced room, a new hero photo) rather than erroring.
 */
export async function saveListing(listing: SaveableListing): Promise<void> {
  const savedAt = new Date().toISOString()
  const userId = await currentUserId()

  if (!userId) {
    const existing = readGuestSaves()
    const without = existing.filter(l => savedKey(l.type, l.id) !== savedKey(listing.type, listing.id))
    writeGuestSaves([{ ...listing, savedAt }, ...without])
  } else {
    const { error } = await supabase
      .from('vd_saved_listings')
      .upsert(
        {
          user_id: userId,
          listing_id: listing.id,
          listing_type: listing.type,
          value: { ...listing, href: listingHref(listing) },
        },
        { onConflict: 'user_id,listing_type,listing_id' },
      )
    if (error) throw error
  }

  void trackEvent(AnalyticsEvent.FAVOURITE_ADDED, {
    listing_id: listing.id,
    listing_type: listing.type,
    listing_title: listing.title,
  })
}

/** Removes a save. A no-op when it wasn't saved. */
export async function unsaveListing(type: SavedListingType, id: string): Promise<void> {
  const userId = await currentUserId()

  if (!userId) {
    writeGuestSaves(readGuestSaves().filter(l => savedKey(l.type, l.id) !== savedKey(type, id)))
  } else {
    const { error } = await supabase
      .from('vd_saved_listings')
      .delete()
      .eq('user_id', userId)
      .eq('listing_type', type)
      .eq('listing_id', id)
    if (error) throw error
  }

  void trackEvent(AnalyticsEvent.FAVOURITE_REMOVED, { listing_id: id, listing_type: type })
}

/**
 * Folds anything saved while signed out into the account, then clears the
 * guest store so the merge happens exactly once per browser.
 *
 * `ignoreDuplicates` keeps whichever save the account already has: if the
 * visitor saved the same lodge on their phone last week, the older account
 * save wins and this browser's copy is discarded rather than resurfacing the
 * listing at the top of their list.
 *
 * Returns how many saves were carried over, so the caller can tell the
 * visitor it happened.
 */
export async function mergeGuestSaves(): Promise<number> {
  const guest = readGuestSaves()
  if (guest.length === 0) return 0

  const userId = await currentUserId()
  if (!userId) return 0

  const { error } = await supabase
    .from('vd_saved_listings')
    .upsert(
      guest.map(l => ({
        user_id: userId,
        listing_id: l.id,
        listing_type: l.type,
        value: { ...l, href: listingHref(l) },
        created_at: l.savedAt || new Date().toISOString(),
      })),
      { onConflict: 'user_id,listing_type,listing_id', ignoreDuplicates: true },
    )
  // Leave the guest store alone on failure so the next sign-in retries the
  // merge instead of silently dropping the saves.
  if (error) return 0

  writeGuestSaves([])
  return guest.length
}

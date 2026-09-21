'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  getSavedListings,
  mergeGuestSaves,
  saveListing as persistSave,
  savedKey,
  unsaveListing as persistUnsave,
  type SaveableListing,
  type SavedListing,
  type SavedListingType,
} from './saved-listings'
import { onAuthStateChange } from './auth'

/* ────────────────────────────────────────────────────────────────────────────
 * One saved-listings store for the whole app.
 *
 * A listings page renders dozens of cards, each with its own heart. If every
 * heart owned its own state it would need its own "am I saved?" query on
 * mount, and the same lodge appearing in two carousels would show two
 * different states after a tap. So the full set is loaded once here and every
 * SaveButton reads from it.
 *
 * Toggling is optimistic: the heart fills on tap and rolls back if the write
 * fails. A save is a low-stakes, high-frequency interaction — waiting on a
 * round trip before the heart moves makes the whole page feel broken.
 * ──────────────────────────────────────────────────────────────────────────── */

type SavedListingsValue = {
  /** Every save, newest first. */
  saved: SavedListing[]
  /** False until the first load resolves — hold "0 saved" copy behind it. */
  ready: boolean
  isSaved: (type: SavedListingType, id: string) => boolean
  /** Saves or unsaves, whichever the listing isn't. Resolves to its new state. */
  toggleSaved: (listing: SaveableListing) => Promise<boolean>
  removeSaved: (type: SavedListingType, id: string) => Promise<void>
  /** Re-reads the store — for a page that needs the freshest snapshot. */
  refresh: () => Promise<void>
}

const SavedListingsContext = createContext<SavedListingsValue>({
  saved: [],
  ready: false,
  isSaved: () => false,
  toggleSaved: async () => false,
  removeSaved: async () => {},
  refresh: async () => {},
})

export function SavedListingsProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<SavedListing[]>([])
  const [ready, setReady] = useState(false)
  // Guards against a slow first load landing on top of a save the visitor
  // made while it was still in flight.
  const loadToken = useRef(0)

  const load = useCallback(async () => {
    const token = ++loadToken.current
    const listings = await getSavedListings()
    if (token !== loadToken.current) return
    setSaved(listings)
    setReady(true)
  }, [])

  useEffect(() => { void load() }, [load])

  // Signing in pulls anything saved as a guest into the account, then
  // re-reads; signing out drops back to whatever this browser has locally.
  useEffect(() => {
    const { data } = onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        try {
          const merged = await mergeGuestSaves()
          if (merged > 0) {
            toast.success(`${merged} saved listing${merged !== 1 ? 's' : ''} added to your account`)
          }
        } catch {
          // Merge failed — the guest store is left intact and retried on the
          // next sign-in. Still reload, so the account's own saves show.
        }
        await load()
      } else if (event === 'SIGNED_OUT') {
        await load()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [load])

  const savedKeys = useMemo(
    () => new Set(saved.map(l => savedKey(l.type, l.id))),
    [saved],
  )

  const isSaved = useCallback(
    (type: SavedListingType, id: string) => savedKeys.has(savedKey(type, id)),
    [savedKeys],
  )

  const toggleSaved = useCallback(async (listing: SaveableListing): Promise<boolean> => {
    const key = savedKey(listing.type, listing.id)
    const wasSaved = savedKeys.has(key)
    const previous = saved

    // Optimistic — the heart moves now, the write catches up.
    setSaved(wasSaved
      ? previous.filter(l => savedKey(l.type, l.id) !== key)
      : [{ ...listing, savedAt: new Date().toISOString() }, ...previous])

    try {
      if (wasSaved) await persistUnsave(listing.type, listing.id)
      else await persistSave(listing)
      return !wasSaved
    } catch {
      setSaved(previous)
      toast.error(wasSaved ? 'Could not remove that listing' : 'Could not save that listing')
      return wasSaved
    }
  }, [saved, savedKeys])

  const removeSaved = useCallback(async (type: SavedListingType, id: string) => {
    const key = savedKey(type, id)
    const previous = saved
    setSaved(previous.filter(l => savedKey(l.type, l.id) !== key))
    try {
      await persistUnsave(type, id)
    } catch {
      setSaved(previous)
      toast.error('Could not remove that listing')
    }
  }, [saved])

  const value = useMemo<SavedListingsValue>(
    () => ({ saved, ready, isSaved, toggleSaved, removeSaved, refresh: load }),
    [saved, ready, isSaved, toggleSaved, removeSaved, load],
  )

  return (
    <SavedListingsContext.Provider value={value}>
      {children}
    </SavedListingsContext.Provider>
  )
}

export function useSavedListings() {
  return useContext(SavedListingsContext)
}

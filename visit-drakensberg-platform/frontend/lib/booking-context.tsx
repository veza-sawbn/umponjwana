'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { MeetAndGreetDetails } from './transport'

export type BookingAddon = {
  id: string
  type: 'activity' | 'hike' | 'tour' | 'event'
  title: string
  operator?: string
  supplierId?: string
  date?: string
  price_per_person: number
  guests: number
  location?: string
  lat?: string
  lng?: string
}

export type BookingStay = {
  id: string
  title: string
  region: string
  price_per_night: number
  roomId?: string
  roomName?: string
  img?: string
  address?: string
  lat?: string
  lng?: string
}

export type ShuttleOption = {
  id: string
  label: string
  price: number
  description: string
  pickup?: string
  destination?: string
  pickupLat?: string
  pickupLng?: string
  destinationLat?: string
  destinationLng?: string
  /** Transport partner chosen by the customer before checkout. */
  supplierId?: string
  companyId?: string
  companyName?: string
  vehicleId?: string
  vehicleName?: string
  /** Flight / arrival details for the partner's meet & greet. */
  meetAndGreet?: MeetAndGreetDetails
  date?: string
  passengers?: number
  shuttleType?: string
  durationMinutes?: number
  vehicleType?: string
  distanceKm?: number
  durationText?: string
}

// ── Destination intelligence ──────────────────────────────────────────────────

/** A previous destination search — persisted to power contextual recommendations. */
export type TripSearch = {
  region: string
  checkIn: string
  checkOut: string
  guests: number
  searchedAt: string
}

/** A listing the visitor has saved or recently viewed. */
export type TrackedListing = {
  id: string
  title: string
  type: string
  region?: string
  viewedAt?: string
}

export type BookingState = {
  region: string
  /** The active destination hub (slug) resolved from the current stay/region — used
   *  by SmartRecommendations, the Navbar context strip, and the trip planner. */
  currentDestination: string
  checkIn: string
  checkOut: string
  guests: number
  stay: BookingStay | null
  addons: BookingAddon[]
  /** Every private-shuttle leg the guest has added — one per far-apart
   *  activity/stay transfer, all carried into the same booking. */
  shuttles: ShuttleOption[]
  /** Up to 8 most-recent destination searches — drives "previous searches" UX. */
  previousSearches: TripSearch[]
  /** Listings the visitor has explicitly saved. */
  savedListings: TrackedListing[]
  /** Listings viewed in the current session — used for recency signals. */
  recentlyViewedListings: TrackedListing[]
}

type BookingActions = {
  setSearch: (region: string, checkIn: string, checkOut: string, guests: number) => void
  setCurrentDestination: (destination: string) => void
  setStay: (stay: BookingStay | null) => void
  addAddon: (addon: BookingAddon) => void
  removeAddon: (id: string) => void
  addShuttle: (shuttle: ShuttleOption) => void
  removeShuttle: (id: string) => void
  updateShuttle: (id: string, patch: Partial<ShuttleOption>) => void
  /** Save a listing to the visitor's saved list (de-duplicated by id). */
  saveListing: (listing: TrackedListing) => void
  /** Remove a previously-saved listing. */
  removeSavedListing: (id: string) => void
  /** Record that the visitor viewed a listing (kept as last 20). */
  trackListingView: (listing: TrackedListing) => void
  clearBooking: () => void
  hasActiveSearch: boolean
  nights: number
  totalPrice: number
  /** false until the cart has been restored from localStorage — guard any
   *  "empty cart" redirect behind this to avoid bouncing a full cart. */
  hydrated: boolean
}

const EMPTY: BookingState = {
  region: '',
  currentDestination: '',
  checkIn: '',
  checkOut: '',
  guests: 2,
  stay: null,
  addons: [],
  shuttles: [],
  previousSearches: [],
  savedListings: [],
  recentlyViewedListings: [],
}

const BookingContext = createContext<BookingState & BookingActions>({
  ...EMPTY,
  setSearch: () => {},
  setCurrentDestination: () => {},
  setStay: () => {},
  addAddon: () => {},
  removeAddon: () => {},
  addShuttle: () => {},
  removeShuttle: () => {},
  updateShuttle: () => {},
  saveListing: () => {},
  removeSavedListing: () => {},
  trackListingView: () => {},
  clearBooking: () => {},
  hasActiveSearch: false,
  nights: 0,
  totalPrice: 0,
  hydrated: false,
})

const STORAGE_KEY = 'vd_booking_v1'

function calcNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0
  const diff = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  return Math.max(0, Math.round(diff))
}

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BookingState>(EMPTY)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Migrate carts saved before multi-shuttle support: a single
        // `shuttle` field becomes a one-item `shuttles` array.
        if (parsed && 'shuttle' in parsed && !('shuttles' in parsed)) {
          parsed.shuttles = parsed.shuttle ? [parsed.shuttle] : []
          delete parsed.shuttle
        }
        setState({ ...EMPTY, ...parsed })
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Persist to localStorage on change — only after hydration, so the initial
  // EMPTY render can never overwrite a saved cart.
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [state, hydrated])

  const setSearch = useCallback((region: string, checkIn: string, checkOut: string, guests: number) => {
    setState(s => ({
      ...s,
      region,
      checkIn,
      checkOut,
      guests,
      // Seed currentDestination from region on first search if not already set
      currentDestination: s.currentDestination || region,
      // Record search history (capped at 8, de-duplicated by region+dates)
      previousSearches: [
        { region, checkIn, checkOut, guests, searchedAt: new Date().toISOString() },
        ...s.previousSearches.filter(
          ps => !(ps.region === region && ps.checkIn === checkIn && ps.checkOut === checkOut)
        ),
      ].slice(0, 8),
    }))
  }, [])

  const setCurrentDestination = useCallback((destination: string) => {
    setState(s => ({ ...s, currentDestination: destination }))
  }, [])

  const saveListing = useCallback((listing: TrackedListing) => {
    setState(s => ({
      ...s,
      savedListings: s.savedListings.some(l => l.id === listing.id)
        ? s.savedListings
        : [...s.savedListings, listing],
    }))
  }, [])

  const removeSavedListing = useCallback((id: string) => {
    setState(s => ({ ...s, savedListings: s.savedListings.filter(l => l.id !== id) }))
  }, [])

  const trackListingView = useCallback((listing: TrackedListing) => {
    setState(s => ({
      ...s,
      recentlyViewedListings: [
        { ...listing, viewedAt: new Date().toISOString() },
        ...s.recentlyViewedListings.filter(l => l.id !== listing.id),
      ].slice(0, 20),
    }))
  }, [])

  const setStay = useCallback((stay: BookingStay | null) => {
    setState(s => ({ ...s, stay }))
  }, [])

  const addAddon = useCallback((addon: BookingAddon) => {
    setState(s => ({
      ...s,
      addons: s.addons.some(a => a.id === addon.id)
        ? s.addons
        : [...s.addons, addon],
    }))
  }, [])

  const removeAddon = useCallback((id: string) => {
    setState(s => ({ ...s, addons: s.addons.filter(a => a.id !== id) }))
  }, [])

  const addShuttle = useCallback((shuttle: ShuttleOption) => {
    setState(s => ({
      ...s,
      shuttles: s.shuttles.some(sh => sh.id === shuttle.id)
        ? s.shuttles
        : [...s.shuttles, shuttle],
    }))
  }, [])

  const removeShuttle = useCallback((id: string) => {
    setState(s => ({ ...s, shuttles: s.shuttles.filter(sh => sh.id !== id) }))
  }, [])

  const updateShuttle = useCallback((id: string, patch: Partial<ShuttleOption>) => {
    setState(s => ({
      ...s,
      shuttles: s.shuttles.map(sh => sh.id === id ? { ...sh, ...patch } : sh),
    }))
  }, [])

  const clearBooking = useCallback(() => {
    setState(EMPTY)
  }, [])

  const nights = calcNights(state.checkIn, state.checkOut)

  const totalPrice =
    (state.stay ? state.stay.price_per_night * nights : 0) +
    state.addons.reduce((sum, a) => sum + a.price_per_person * a.guests, 0) +
    state.shuttles.reduce((sum, sh) => sum + sh.price, 0)

  const hasActiveSearch = !!(state.checkIn && state.checkOut)

  return (
    <BookingContext.Provider value={{
      ...state,
      setSearch,
      setCurrentDestination,
      setStay,
      addAddon,
      removeAddon,
      addShuttle,
      removeShuttle,
      updateShuttle,
      saveListing,
      removeSavedListing,
      trackListingView,
      clearBooking,
      hasActiveSearch,
      nights,
      totalPrice,
      hydrated,
    }}>
      {children}
    </BookingContext.Provider>
  )
}

export function useBooking() {
  return useContext(BookingContext)
}

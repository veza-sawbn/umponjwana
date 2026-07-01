'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type BookingAddon = {
  id: string
  type: 'activity' | 'hike' | 'tour' | 'event'
  title: string
  operator?: string
  supplierId?: string
  date?: string
  price_per_person: number
  guests: number
}

export type BookingStay = {
  id: string
  title: string
  region: string
  price_per_night: number
  img?: string
}

export type ShuttleOption = {
  id: string
  label: string
  price: number
  description: string
  pickup?: string
  destination?: string
  date?: string
  passengers?: number
  shuttleType?: string
  durationMinutes?: number
  vehicleType?: string
}

export type TripSearch = {
  region: string
  checkIn: string
  checkOut: string
  guests: number
  searchedAt: string
}

export type TrackedListing = {
  id: string
  title: string
  type: string
  region?: string
  viewedAt?: string
}

export type BookingState = {
  region: string
  currentDestination: string
  checkIn: string
  checkOut: string
  guests: number
  stay: BookingStay | null
  addons: BookingAddon[]
  shuttle: ShuttleOption | null
  previousSearches: TripSearch[]
  savedListings: TrackedListing[]
  recentlyViewedListings: TrackedListing[]
}

type BookingActions = {
  setSearch: (region: string, checkIn: string, checkOut: string, guests: number) => void
  setCurrentDestination: (destination: string) => void
  setStay: (stay: BookingStay | null) => void
  addAddon: (addon: BookingAddon) => void
  removeAddon: (id: string) => void
  setShuttle: (shuttle: ShuttleOption | null) => void
  saveListing: (listing: TrackedListing) => void
  trackListingView: (listing: TrackedListing) => void
  clearBooking: () => void
  hasActiveSearch: boolean
  nights: number
  totalPrice: number
}

const EMPTY: BookingState = {
  region: '',
  currentDestination: '',
  checkIn: '',
  checkOut: '',
  guests: 2,
  stay: null,
  addons: [],
  shuttle: null,
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
  setShuttle: () => {},
  saveListing: () => {},
  trackListingView: () => {},
  clearBooking: () => {},
  hasActiveSearch: false,
  nights: 0,
  totalPrice: 0,
})

const STORAGE_KEY = 'vd_booking_v1'

function calcNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0
  const diff = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  return Math.max(0, Math.round(diff))
}

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BookingState>(EMPTY)

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setState({ ...EMPTY, ...JSON.parse(saved) })
    } catch {}
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [state])

  const setSearch = useCallback((region: string, checkIn: string, checkOut: string, guests: number) => {
    setState(s => ({
      ...s,
      region,
      currentDestination: s.currentDestination || region,
      checkIn,
      checkOut,
      guests,
      previousSearches: [
        { region, checkIn, checkOut, guests, searchedAt: new Date().toISOString() },
        ...s.previousSearches,
      ].slice(0, 8),
    }))
  }, [])

  const setCurrentDestination = useCallback((destination: string) => {
    setState(s => ({ ...s, currentDestination: destination }))
  }, [])

  const setStay = useCallback((stay: BookingStay | null) => {
    setState(s => ({ ...s, stay, region: stay?.region || s.region, currentDestination: stay?.region || s.currentDestination }))
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

  const setShuttle = useCallback((shuttle: ShuttleOption | null) => {
    setState(s => ({ ...s, shuttle }))
  }, [])

  const saveListing = useCallback((listing: TrackedListing) => {
    setState(s => ({ ...s, savedListings: [listing, ...s.savedListings.filter(item => item.id !== listing.id)].slice(0, 40) }))
  }, [])

  const trackListingView = useCallback((listing: TrackedListing) => {
    setState(s => ({ ...s, recentlyViewedListings: [{ ...listing, viewedAt: new Date().toISOString() }, ...s.recentlyViewedListings.filter(item => item.id !== listing.id)].slice(0, 12) }))
  }, [])

  const clearBooking = useCallback(() => {
    setState(EMPTY)
  }, [])

  const nights = calcNights(state.checkIn, state.checkOut)

  const totalPrice =
    (state.stay ? state.stay.price_per_night * nights : 0) +
    state.addons.reduce((sum, a) => sum + a.price_per_person * a.guests, 0) +
    (state.shuttle ? state.shuttle.price : 0)

  const hasActiveSearch = !!(state.checkIn && state.checkOut)

  return (
    <BookingContext.Provider value={{
      ...state,
      setSearch,
      setCurrentDestination,
      setStay,
      addAddon,
      removeAddon,
      setShuttle,
      saveListing,
      trackListingView,
      clearBooking,
      hasActiveSearch,
      nights,
      totalPrice,
    }}>
      {children}
    </BookingContext.Provider>
  )
}

export function useBooking() {
  return useContext(BookingContext)
}

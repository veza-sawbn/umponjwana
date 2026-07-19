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

export type BookingState = {
  region: string
  checkIn: string
  checkOut: string
  guests: number
  stay: BookingStay | null
  addons: BookingAddon[]
  shuttle: ShuttleOption | null
}

type BookingActions = {
  setSearch: (region: string, checkIn: string, checkOut: string, guests: number) => void
  setStay: (stay: BookingStay | null) => void
  addAddon: (addon: BookingAddon) => void
  removeAddon: (id: string) => void
  setShuttle: (shuttle: ShuttleOption | null) => void
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
  checkIn: '',
  checkOut: '',
  guests: 2,
  stay: null,
  addons: [],
  shuttle: null,
}

const BookingContext = createContext<BookingState & BookingActions>({
  ...EMPTY,
  setSearch: () => {},
  setStay: () => {},
  addAddon: () => {},
  removeAddon: () => {},
  setShuttle: () => {},
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
      if (saved) setState(JSON.parse(saved))
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
    setState(s => ({ ...s, region, checkIn, checkOut, guests }))
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

  const setShuttle = useCallback((shuttle: ShuttleOption | null) => {
    setState(s => ({ ...s, shuttle }))
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
      setStay,
      addAddon,
      removeAddon,
      setShuttle,
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

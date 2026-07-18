'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type GooglePlaceSelection = {
  address: string
  lat?: string
  lng?: string
}

declare global {
  interface Window {
    google?: any
    __googleMapsPromise?: Promise<void>
  }
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.maps?.places) return Promise.resolve()
  if (window.__googleMapsPromise) return window.__googleMapsPromise

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'))
  }

  window.__googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')))
      return
    }

    const script = document.createElement('script')
    script.dataset.googleMaps = 'true'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places&loading=async`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Maps failed to load'))
    document.head.appendChild(script)
  })

  return window.__googleMapsPromise
}

export function hasGoogleMapsKey() {
  return Boolean(GOOGLE_MAPS_API_KEY)
}

export type LatLngPoint = { lat: number; lng: number }
export type DistanceResult = { distanceKm: number; durationMinutes: number; durationText: string }

type DistanceOrigin = string | LatLngPoint

/**
 * DistanceMatrixService lives in the "routes" library, which the classic `libraries=` script
 * param does not support — it must be fetched via importLibrary() instead (Google's newer
 * dynamic-library loading, used whenever the script tag includes `loading=async`).
 */
async function getDistanceMatrixService(): Promise<any | null> {
  if (!window.google?.maps) return null
  if (window.google.maps.DistanceMatrixService) return new window.google.maps.DistanceMatrixService()
  if (typeof window.google.maps.importLibrary !== 'function') return null
  try {
    const routesLibrary = await window.google.maps.importLibrary('routes')
    return new routesLibrary.DistanceMatrixService()
  } catch {
    return null
  }
}

/** Calls the Google Distance Matrix service to get driving distance/duration between two points or addresses. */
export async function calculateDrivingDistance(origin: DistanceOrigin, destination: DistanceOrigin): Promise<DistanceResult | null> {
  if (typeof window === 'undefined') return null
  try {
    await loadGoogleMaps()
  } catch {
    return null
  }
  if (!window.google?.maps) return null
  const service = await getDistanceMatrixService()
  if (!service) return null

  const toMapsPoint = (point: DistanceOrigin) => (typeof point === 'string' ? point : new window.google!.maps.LatLng(point.lat, point.lng))

  return new Promise((resolve) => {
    service.getDistanceMatrix(
      {
        origins: [toMapsPoint(origin)],
        destinations: [toMapsPoint(destination)],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
      },
      (response: any, status: string) => {
        const element = response?.rows?.[0]?.elements?.[0]
        if (status !== 'OK' || !element || element.status !== 'OK') {
          resolve(null)
          return
        }
        resolve({
          distanceKm: Math.round(((element.distance?.value ?? 0) / 100)) / 10,
          durationMinutes: Math.round((element.duration?.value ?? 0) / 60),
          durationText: element.duration?.text ?? '',
        })
      }
    )
  })
}

/** Calls the Google Distance Matrix service once to get driving distance/duration from one origin to many destinations. */
export async function calculateDrivingDistances(origin: DistanceOrigin, destinations: DistanceOrigin[]): Promise<(DistanceResult | null)[]> {
  if (destinations.length === 0) return []
  if (typeof window === 'undefined') return destinations.map(() => null)
  try {
    await loadGoogleMaps()
  } catch {
    return destinations.map(() => null)
  }
  if (!window.google?.maps) return destinations.map(() => null)
  const service = await getDistanceMatrixService()
  if (!service) return destinations.map(() => null)

  const toMapsPoint = (point: DistanceOrigin) => (typeof point === 'string' ? point : new window.google!.maps.LatLng(point.lat, point.lng))

  return new Promise((resolve) => {
    service.getDistanceMatrix(
      {
        origins: [toMapsPoint(origin)],
        destinations: destinations.map(toMapsPoint),
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
      },
      (response: any, status: string) => {
        const elements = response?.rows?.[0]?.elements
        if (status !== 'OK' || !Array.isArray(elements)) {
          resolve(destinations.map(() => null))
          return
        }
        resolve(elements.map((element: any) => {
          if (!element || element.status !== 'OK') return null
          return {
            distanceKm: Math.round(((element.distance?.value ?? 0) / 100)) / 10,
            durationMinutes: Math.round((element.duration?.value ?? 0) / 60),
            durationText: element.duration?.text ?? '',
          }
        }))
      }
    )
  })
}

export type DistancePlace = { address: string; lat?: string; lng?: string }

/** Watches an origin and a list of destinations, (re)calculating driving distances in the background in a single request. */
export function useAutoDrivingDistances(origin: DistancePlace | null, destinations: DistancePlace[]) {
  const [results, setResults] = useState<(DistanceResult | null)[]>([])
  const [status, setStatus] = useState<'idle' | 'calculating' | 'done' | 'error'>('idle')

  const originKey = origin ? (origin.lat && origin.lng ? `${origin.lat},${origin.lng}` : origin.address.trim()) : ''
  const destinationsKey = destinations.map(d => (d.lat && d.lng ? `${d.lat},${d.lng}` : d.address.trim())).join('|')

  useEffect(() => {
    if (!originKey || destinations.length === 0) {
      setStatus('idle')
      setResults([])
      return
    }

    let cancelled = false
    setStatus('calculating')

    const timer = setTimeout(() => {
      const originPoint: DistanceOrigin = origin!.lat && origin!.lng ? { lat: Number(origin!.lat), lng: Number(origin!.lng) } : origin!.address
      const destinationPoints: DistanceOrigin[] = destinations.map(d => (d.lat && d.lng ? { lat: Number(d.lat), lng: Number(d.lng) } : d.address))

      calculateDrivingDistances(originPoint, destinationPoints).then((res) => {
        if (cancelled) return
        setResults(res)
        setStatus(res.some(Boolean) ? 'done' : 'error')
      })
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originKey, destinationsKey])

  return { results, status }
}

/** Watches an origin/destination pair and (re)calculates driving distance in the background whenever both are set. */
export function useAutoDrivingDistance(origin: DistancePlace, destination: DistancePlace) {
  const [result, setResult] = useState<DistanceResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'calculating' | 'done' | 'error'>('idle')

  const originKey = origin.lat && origin.lng ? `${origin.lat},${origin.lng}` : origin.address.trim()
  const destinationKey = destination.lat && destination.lng ? `${destination.lat},${destination.lng}` : destination.address.trim()

  useEffect(() => {
    if (!originKey || !destinationKey) {
      setStatus('idle')
      setResult(null)
      return
    }

    let cancelled = false
    setStatus('calculating')

    const timer = setTimeout(() => {
      const originPoint: DistanceOrigin = origin.lat && origin.lng ? { lat: Number(origin.lat), lng: Number(origin.lng) } : origin.address
      const destinationPoint: DistanceOrigin = destination.lat && destination.lng ? { lat: Number(destination.lat), lng: Number(destination.lng) } : destination.address

      calculateDrivingDistance(originPoint, destinationPoint).then((res) => {
        if (cancelled) return
        setResult(res)
        setStatus(res ? 'done' : 'error')
      })
    }, 600)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originKey, destinationKey])

  return { result, status }
}

// ── Places autocomplete (no map) ────────────────────────────────────────────
// A plain type-and-select field: the user types a place name, we fetch
// suggestions from Google Places and resolve the chosen one to an address +
// coordinates. Works with both the current Places API (AutocompleteSuggestion
// / Place) and the classic one (AutocompleteService / PlacesService),
// whichever the key supports.

type Suggestion = {
  placeId: string
  main: string
  secondary: string
  description: string
  prediction?: any // new-API prediction, resolvable via toPlace()
}

async function getPlacesLibrary(): Promise<any | null> {
  if (typeof window === 'undefined') return null
  try {
    await loadGoogleMaps()
  } catch {
    return null
  }
  if (!window.google?.maps) return null
  const loaded = window.google.maps.places
  if (loaded?.AutocompleteSuggestion || loaded?.AutocompleteService) return loaded
  if (typeof window.google.maps.importLibrary === 'function') {
    try {
      return await window.google.maps.importLibrary('places')
    } catch {
      return null
    }
  }
  return loaded ?? null
}

function latLngToString(value: any): string | undefined {
  if (value === null || value === undefined) return undefined
  const n = typeof value === 'function' ? value() : value
  return Number.isFinite(Number(n)) ? String(n) : undefined
}

export function GoogleAddressField({
  label,
  value,
  lat,
  lng,
  placeholder,
  required,
  inputClassName,
  labelClassName = 'block text-sm font-medium text-gray-700 mb-1',
  onChange,
}: {
  label: string
  value: string
  lat?: string
  lng?: string
  placeholder?: string
  required?: boolean
  inputClassName: string
  labelClassName?: string
  onChange: (selection: GooglePlaceSelection) => void
}) {
  const id = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionTokenRef = useRef<any>(null)
  const autocompleteServiceRef = useRef<any>(null)
  const requestSeqRef = useRef(0)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [status, setStatus] = useState<'ready' | 'missing-key' | 'error'>(GOOGLE_MAPS_API_KEY ? 'ready' : 'missing-key')

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  async function fetchSuggestions(text: string) {
    const seq = ++requestSeqRef.current
    const places = await getPlacesLibrary()
    if (!places) { setStatus('error'); return }

    try {
      if (places.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        if (!sessionTokenRef.current && places.AutocompleteSessionToken) {
          sessionTokenRef.current = new places.AutocompleteSessionToken()
        }
        const { suggestions: fetched } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: text,
          includedRegionCodes: ['za'],
          sessionToken: sessionTokenRef.current ?? undefined,
        })
        if (seq !== requestSeqRef.current) return
        const mapped: Suggestion[] = (fetched ?? [])
          .filter((s: any) => s.placePrediction)
          .map((s: any) => ({
            placeId: s.placePrediction.placeId,
            main: s.placePrediction.mainText?.text ?? s.placePrediction.text?.text ?? '',
            secondary: s.placePrediction.secondaryText?.text ?? '',
            description: s.placePrediction.text?.text ?? s.placePrediction.mainText?.text ?? '',
            prediction: s.placePrediction,
          }))
        setSuggestions(mapped)
        setOpen(mapped.length > 0)
        setHighlight(-1)
        return
      }

      if (places.AutocompleteService) {
        if (!autocompleteServiceRef.current) autocompleteServiceRef.current = new places.AutocompleteService()
        autocompleteServiceRef.current.getPlacePredictions(
          { input: text, componentRestrictions: { country: 'za' } },
          (predictions: any[] | null, predStatus: string) => {
            if (seq !== requestSeqRef.current) return
            if (predStatus !== 'OK' || !predictions) { setSuggestions([]); setOpen(false); return }
            const mapped: Suggestion[] = predictions.map(p => ({
              placeId: p.place_id,
              main: p.structured_formatting?.main_text ?? p.description,
              secondary: p.structured_formatting?.secondary_text ?? '',
              description: p.description,
            }))
            setSuggestions(mapped)
            setOpen(mapped.length > 0)
            setHighlight(-1)
          },
        )
        return
      }

      setStatus('error')
    } catch {
      if (seq === requestSeqRef.current) setStatus('error')
    }
  }

  function handleInput(text: string) {
    onChange({ address: text })
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 250)
  }

  async function select(suggestion: Suggestion) {
    setOpen(false)
    setSuggestions([])
    // Show the picked name immediately; coordinates follow once resolved.
    onChange({ address: suggestion.description || suggestion.main })

    const places = await getPlacesLibrary()
    if (!places) return
    try {
      if (suggestion.prediction?.toPlace) {
        const place = suggestion.prediction.toPlace()
        await place.fetchFields({ fields: ['formattedAddress', 'location', 'displayName'] })
        onChange({
          address: place.formattedAddress || suggestion.description || suggestion.main,
          lat: latLngToString(place.location?.lat),
          lng: latLngToString(place.location?.lng),
        })
        sessionTokenRef.current = null
        return
      }
      if (places.PlacesService) {
        const service = new places.PlacesService(document.createElement('div'))
        service.getDetails(
          { placeId: suggestion.placeId, fields: ['formatted_address', 'geometry', 'name'] },
          (place: any, detailStatus: string) => {
            if (detailStatus !== 'OK' || !place) return
            const location = place.geometry?.location
            onChange({
              address: place.formatted_address || place.name || suggestion.description,
              lat: latLngToString(location?.lat),
              lng: latLngToString(location?.lng),
            })
          },
        )
      }
    } catch {}
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      select(suggestions[highlight >= 0 ? highlight : 0])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="relative">
        <label htmlFor={id} className={labelClassName}>
          {label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}
        </label>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={inputClassName}
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
            {suggestions.map((s, i) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(s)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${i === highlight ? 'bg-[#F7F5F2]' : 'bg-white'}`}
                >
                  <span className="block font-medium text-gray-800">{s.main}</span>
                  {s.secondary && <span className="block text-xs text-gray-400">{s.secondary}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {status === 'missing-key' && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable Google place search.</p>}
      {status === 'error' && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">Google place search could not load. Check that the key allows the Places API.</p>}
    </div>
  )
}

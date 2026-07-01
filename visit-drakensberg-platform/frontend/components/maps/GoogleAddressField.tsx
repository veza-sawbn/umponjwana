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
const DEFAULT_CENTER = { lat: -29.0, lng: 29.25 }

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places,routes&loading=async`
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

/** Calls the Google Distance Matrix service to get driving distance/duration between two points or addresses. */
export async function calculateDrivingDistance(origin: DistanceOrigin, destination: DistanceOrigin): Promise<DistanceResult | null> {
  if (typeof window === 'undefined') return null
  try {
    await loadGoogleMaps()
  } catch {
    return null
  }
  if (!window.google?.maps) return null

  const toMapsPoint = (point: DistanceOrigin) => (typeof point === 'string' ? point : new window.google!.maps.LatLng(point.lat, point.lng))

  return new Promise((resolve) => {
    const service = new window.google.maps.DistanceMatrixService()
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

  const toMapsPoint = (point: DistanceOrigin) => (typeof point === 'string' ? point : new window.google!.maps.LatLng(point.lat, point.lng))

  return new Promise((resolve) => {
    const service = new window.google.maps.DistanceMatrixService()
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
  const inputRef = useRef<HTMLInputElement | null>(null)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const map = useRef<any>(null)
  const marker = useRef<any>(null)
  const id = useId()
  const [status, setStatus] = useState<'ready' | 'missing-key' | 'loading' | 'error'>(GOOGLE_MAPS_API_KEY ? 'loading' : 'missing-key')

  const numericLat = lat ? Number(lat) : undefined
  const numericLng = lng ? Number(lng) : undefined
  const hasCoordinates = Number.isFinite(numericLat) && Number.isFinite(numericLng)

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return
    let cancelled = false

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return
        setStatus('ready')

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'za' },
          fields: ['formatted_address', 'geometry', 'name'],
          types: ['geocode', 'establishment'],
        })

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          const location = place.geometry?.location
          onChange({
            address: place.formatted_address || place.name || inputRef.current?.value || '',
            lat: location ? String(location.lat()) : undefined,
            lng: location ? String(location.lng()) : undefined,
          })
        })
      })
      .catch(() => setStatus('error'))

    return () => { cancelled = true }
  }, [onChange])

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !window.google?.maps) return

    const center = hasCoordinates ? { lat: numericLat!, lng: numericLng! } : DEFAULT_CENTER
    if (!map.current) {
      map.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: hasCoordinates ? 14 : 9,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
      marker.current = new window.google.maps.Marker({ map: map.current })
    }

    map.current.setCenter(center)
    map.current.setZoom(hasCoordinates ? 14 : 9)
    marker.current.setPosition(hasCoordinates ? center : null)
  }, [hasCoordinates, numericLat, numericLng, status])

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={id} className={labelClassName}>
          {label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}
        </label>
        <input ref={inputRef} id={id} type="text" value={value} onChange={(e) => onChange({ address: e.target.value })} placeholder={placeholder} className={inputClassName} />
      </div>
      <div ref={mapRef} className="h-48 rounded-xl border border-gray-200 bg-gradient-to-br from-green-100 to-blue-100" />
      {status === 'missing-key' && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable Google address autocomplete and map previews.</p>}
      {status === 'error' && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">Google Maps could not load. Check that the key allows Maps JavaScript API and Places API.</p>}
    </div>
  )
}

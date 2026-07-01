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

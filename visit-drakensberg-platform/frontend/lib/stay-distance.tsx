'use client'
import { useEffect, useState } from 'react'
import { Car, Navigation } from 'lucide-react'
import { useBooking } from './booking-context'
import { calculateDrivingDistance, type DistanceResult } from '@/components/maps/GoogleAddressField'

// When the visitor has already chosen a stay (booking cart), cards for trails,
// activities and trekking experiences show the driving distance between the
// stay and the item's meeting/starting point (Google Distance Matrix), with a
// straight-line estimate shown until the driving result arrives and as the
// fallback when Google Maps is unavailable.

export type StayCoords = { title: string; lat: number; lng: number }

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const rad = (v: number) => (v * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useStayCoords(): StayCoords | null {
  const { stay } = useBooking()
  if (!stay) return null
  const lat = parseFloat(stay.lat ?? '')
  const lng = parseFloat(stay.lng ?? '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null
  return { title: stay.title, lat, lng }
}

export function distanceFromStayKm(stay: StayCoords | null, lat?: string | number, lng?: string | number): number | null {
  if (!stay) return null
  const la = typeof lat === 'string' ? parseFloat(lat) : lat
  const ln = typeof lng === 'string' ? parseFloat(lng) : lng
  if (la === undefined || ln === undefined || !Number.isFinite(la) || !Number.isFinite(ln)) return null
  if (la === 0 && ln === 0) return null
  return haversineKm(stay.lat, stay.lng, la, ln)
}

export function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`
}

// One Distance Matrix request per unique stay→point pair, shared across every
// card and re-render (failures are cached too, so a missing API key can't
// trigger a request per card).
const drivingCache = new Map<string, Promise<DistanceResult | null>>()
function cachedDrivingDistance(origin: StayCoords, lat: number, lng: number): Promise<DistanceResult | null> {
  const key = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}|${lat.toFixed(5)},${lng.toFixed(5)}`
  let promise = drivingCache.get(key)
  if (!promise) {
    promise = calculateDrivingDistance({ lat: origin.lat, lng: origin.lng }, { lat, lng })
    drivingCache.set(key, promise)
  }
  return promise
}

/** Renders the driving distance from the chosen stay ("N km drive from your stay"),
 *  or nothing when no stay is chosen or coordinates are missing. Shows a
 *  straight-line estimate while the driving distance loads / when Google Maps
 *  is unavailable. */
export function StayDistance({ lat, lng, className = '' }: { lat?: string | number; lng?: string | number; className?: string }) {
  const stay = useStayCoords()
  const straightKm = distanceFromStayKm(stay, lat, lng)
  const [driving, setDriving] = useState<DistanceResult | null>(null)

  const targetLat = typeof lat === 'string' ? parseFloat(lat) : lat
  const targetLng = typeof lng === 'string' ? parseFloat(lng) : lng

  useEffect(() => {
    setDriving(null)
    if (!stay || straightKm === null || targetLat === undefined || targetLng === undefined) return
    let cancelled = false
    cachedDrivingDistance(stay, targetLat, targetLng).then(r => { if (!cancelled) setDriving(r) })
    return () => { cancelled = true }
  }, [stay?.lat, stay?.lng, targetLat, targetLng, straightKm]) // eslint-disable-line react-hooks/exhaustive-deps

  if (straightKm === null) return null
  if (driving) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-sans text-[11px] text-[#2d6a4f] ${className}`}
        title={`Driving distance from ${stay!.title}${driving.durationText ? ` · about ${driving.durationText}` : ''}`}
      >
        <Car size={10} /> {formatKm(driving.distanceKm)}{driving.durationText ? ` (${driving.durationText})` : ''} drive from your stay
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1 font-sans text-[11px] text-[#2d6a4f] ${className}`}
      title={`Straight-line distance from ${stay!.title} — calculating driving distance…`}
    >
      <Navigation size={10} /> ~{formatKm(straightKm)} from your stay
    </span>
  )
}

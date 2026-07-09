'use client'
import { Navigation } from 'lucide-react'
import { useBooking } from './booking-context'

// When the visitor has already chosen a stay (booking cart), cards for trails,
// activities and trekking experiences show the straight-line distance between
// the stay and the item's meeting/starting point.

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

/** Renders "~N km from your stay", or nothing when no stay is chosen or coordinates are missing. */
export function StayDistance({ lat, lng, className = '' }: { lat?: string | number; lng?: string | number; className?: string }) {
  const stay = useStayCoords()
  const km = distanceFromStayKm(stay, lat, lng)
  if (km === null) return null
  return (
    <span
      className={`inline-flex items-center gap-1 font-sans text-[11px] text-[#2d6a4f] ${className}`}
      title={`Straight-line distance from ${stay!.title}`}
    >
      <Navigation size={10} /> ~{formatKm(km)} from your stay
    </span>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, Star, Mountain, Zap, Compass, Bus, Plus, Navigation } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import { useShuttleRecommendations } from '@/lib/shuttle-service'
import { useAutoDrivingDistances, type DistancePlace } from '@/components/maps/GoogleAddressField'
import { haversineKm } from '@/lib/stay-distance'
import { getTrails, trailStartPoint, type Trail } from '@/lib/trails'
import { getActivities, type Activity } from '@/lib/activities'
import { getUpcomingExperiences, type TrekkingExperience } from '@/lib/experiences'
import { regionsMatch } from '@/lib/regions'
import { formatMoney } from '@/lib/allocation'

interface SmartRecommendation {
  title: string
  type: 'Trail' | 'Activity' | 'Experience'
  location: string
  rating?: number | null
  price?: number | null
  image: string
  href: string
  lat?: string
  lng?: string
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  Trail: <Mountain size={10} />,
  Activity: <Zap size={10} />,
  Experience: <Compass size={10} />,
}

const TYPE_COLOR: Record<string, string> = {
  Trail: 'text-[#2d6a4f]',
  Activity: 'text-[#C9A96E]',
  Experience: 'text-[#C9A96E]',
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80'

interface Props {
  region: string
  excludeListingId?: string
  originLocation?: string
  originLat?: string
  originLng?: string
  /** Visitor's stay dates — narrows guided-experience departures to ones that
   *  actually fall inside the trip, instead of just "upcoming in this region". */
  checkIn?: string
  checkOut?: string
}

function formatDistance(result: { distanceKm: number; durationText: string } | null | undefined) {
  if (!result) return null
  return `${result.distanceKm} km · ~${result.durationText} away`
}

/**
 * "While you're in {region}" panel on the stay booking sidebar. Pulls real
 * published trails, active activities and upcoming guided-trekking
 * departures from Supabase — filtered to the same region as the selected
 * accommodation (and, for dated departures, to the visitor's actual stay
 * dates when known) — no mock/hardcoded listings.
 */
export default function SmartRecommendations({ region, excludeListingId, originLocation, originLat, originLng, checkIn, checkOut }: Props) {
  const booking = useBooking()
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([])
  const shuttleRecommendations = useShuttleRecommendations(booking)

  useEffect(() => {
    if (!region) { setRecommendations([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)

    Promise.all([
      getTrails().catch(() => [] as Trail[]),
      getActivities().catch(() => [] as Activity[]),
      getUpcomingExperiences().catch(() => [] as TrekkingExperience[]),
    ]).then(([trails, activities, experiences]) => {
      if (cancelled) return

      const trailItems: SmartRecommendation[] = trails
        .filter(t => t.status === 'published' && t.id !== excludeListingId && regionsMatch(t.region, region))
        .map(t => {
          const start = trailStartPoint(t)
          return {
            title: t.name,
            type: 'Trail' as const,
            location: t.region,
            price: null,
            image: t.image || FALLBACK_IMAGE,
            href: `/hikes/${t.id}`,
            lat: start ? String(start.lat) : undefined,
            lng: start ? String(start.lng) : undefined,
          }
        })

      const activityItems: SmartRecommendation[] = activities
        .filter(a => a.status === 'active' && a.id !== excludeListingId && regionsMatch(a.region, region))
        .map(a => ({
          title: a.name,
          type: 'Activity' as const,
          location: a.region,
          price: a.pricePerPerson || null,
          image: a.photos?.[0] || FALLBACK_IMAGE,
          href: `/activities/${a.id}`,
          lat: a.gpsLat || undefined,
          lng: a.gpsLng || undefined,
        }))

      // Scheduled departures that fall inside the visitor's actual stay dates
      // once known; otherwise just the soonest upcoming ones in the region.
      const experienceItems: SmartRecommendation[] = experiences
        .filter(e => regionsMatch(e.region, region))
        .filter(e => (!checkIn || !checkOut) ? true : (e.departureDate >= checkIn && e.departureDate <= checkOut))
        .map(e => ({
          title: e.title,
          type: 'Experience' as const,
          location: e.trailName || e.region,
          rating: e.rating,
          price: e.pricePerPerson || null,
          image: FALLBACK_IMAGE,
          href: `/experiences/${e.id}`,
          lat: e.gpsLat || undefined,
          lng: e.gpsLng || undefined,
        }))

      // Combine all types, then sort nearest-first when origin coordinates are
      // available so activities, trails and experiences compete on proximity
      // rather than type order. Items without GPS coords sink to the end.
      const all = [...experienceItems, ...trailItems, ...activityItems]
      const oLat = originLat ? parseFloat(originLat) : NaN
      const oLng = originLng ? parseFloat(originLng) : NaN
      if (Number.isFinite(oLat) && Number.isFinite(oLng)) {
        all.sort((a, b) => {
          const dA = a.lat && a.lng ? haversineKm(oLat, oLng, parseFloat(a.lat), parseFloat(a.lng)) : Infinity
          const dB = b.lat && b.lng ? haversineKm(oLat, oLng, parseFloat(b.lat), parseFloat(b.lng)) : Infinity
          return dA - dB
        })
      }
      // Show up to 6 so multiple listing types can be represented
      setRecommendations(all.slice(0, 6))
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [region, excludeListingId, checkIn, checkOut, originLat, originLng])

  const origin: DistancePlace | null = originLocation ? { address: `${originLocation}, South Africa`, lat: originLat, lng: originLng } : null
  const destinations: DistancePlace[] = [
    ...recommendations.map(item => ({ address: `${item.location}, South Africa`, lat: item.lat, lng: item.lng })),
    ...shuttleRecommendations.map(shuttle => ({ address: `${shuttle.destination || shuttle.label}, South Africa` })),
  ]
  const { results: distances, status: distanceStatus } = useAutoDrivingDistances(origin, destinations)
  const recommendationDistances = distances.slice(0, recommendations.length)
  const shuttleDistances = distances.slice(recommendations.length)

  if (!loading && recommendations.length === 0 && shuttleRecommendations.length === 0) return null

  return (
    <div className="bg-[#F7F5F2] border border-gray-200 p-5">
      <div className="mb-4">
        <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] block mb-1">Smart Booking</span>
        <h3 className="font-display italic text-xl text-[#000000]">While You're in {region}</h3>
        <p className="font-sans text-xs text-gray-400 mt-1">Trails, activities and guided experiences near your stay</p>
      </div>

      {shuttleRecommendations.length > 0 && (
        <div className="space-y-3 mb-4">
          {shuttleRecommendations.map((shuttle, i) => {
            const shuttleDistanceLabel = formatDistance(shuttleDistances[i])
            return (
              <button
                key={shuttle.id}
                onClick={() => booking.addShuttle(shuttle)}
                className="w-full text-left group flex gap-3 bg-white border border-[#2d6a4f]/30 hover:border-[#2d6a4f] transition-colors p-3"
              >
                <div className="w-14 h-14 shrink-0 bg-[#2d6a4f]/10 flex items-center justify-center text-[#2d6a4f]">
                  <Bus size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1 font-sans text-[9px] tracking-[0.12em] uppercase text-[#2d6a4f]">Private Transfer Available</span>
                  <p className="font-display italic text-sm text-[#000000] leading-tight group-hover:text-[#2d6a4f] transition-colors">{shuttle.label}</p>
                  <p className="font-sans text-[10px] text-gray-400 mt-1">Travel date: {shuttle.date} · {shuttle.passengers} passenger{shuttle.passengers !== 1 ? 's' : ''}</p>
                  {origin && (
                    <p className="font-sans text-[10px] text-[#2d6a4f]/70 mt-0.5 flex items-center gap-1">
                      <Navigation size={9} />
                      {distanceStatus === 'calculating' ? 'Calculating distance…' : shuttleDistanceLabel || '—'}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display italic text-sm text-[#2d6a4f]">{formatMoney(shuttle.price)}</p>
                  <p className="font-sans text-[9px] text-gray-400 inline-flex items-center gap-1 justify-end"><Plus size={9} /> Add</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <p className="font-sans text-xs text-gray-400 text-center py-4">Finding things nearby…</p>
      ) : recommendations.length > 0 ? (
        <div className="space-y-3">
          {recommendations.map((item, i) => {
            const distanceLabel = formatDistance(recommendationDistances[i]) || (distanceStatus === 'calculating' && origin ? 'Calculating…' : null)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex gap-3 bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors p-3"
              >
                <div className="w-14 h-14 shrink-0 overflow-hidden">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`inline-flex items-center gap-1 font-sans text-[9px] tracking-[0.12em] uppercase ${TYPE_COLOR[item.type]}`}>
                      {TYPE_ICON[item.type]}
                      {item.type}
                    </span>
                    {distanceLabel && (
                      <span className="font-sans text-[9px] text-gray-300">{distanceLabel}</span>
                    )}
                  </div>
                  <p className="font-display italic text-sm text-[#000000] leading-tight group-hover:text-[#2d6a4f] transition-colors">{item.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="font-sans text-[10px] text-gray-400 flex items-center gap-0.5">
                      <MapPin size={8} />{item.location}
                    </p>
                    {item.rating ? (
                      <span className="font-sans text-[10px] text-gray-400 flex items-center gap-0.5">
                        <Star size={8} className="text-[#C9A96E] fill-[#C9A96E]" />
                        {item.rating}
                      </span>
                    ) : null}
                  </div>
                </div>
                {item.price ? (
                  <div className="shrink-0 text-right">
                    <p className="font-display italic text-sm text-[#2d6a4f]">{formatMoney(item.price)}</p>
                    <p className="font-sans text-[9px] text-gray-400">pp</p>
                  </div>
                ) : null}
              </Link>
            )
          })}
        </div>
      ) : (
        <p className="font-sans text-xs text-gray-400 text-center py-4">No trails or activities published for {region} yet.</p>
      )}

      {recommendations.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link href={`/hikes?region=${encodeURIComponent(region)}`}
            className="font-sans text-xs text-[#2d6a4f] hover:underline">
            Hikes →
          </Link>
          <span className="text-gray-200 select-none">·</span>
          <Link href={`/activities?region=${encodeURIComponent(region)}`}
            className="font-sans text-xs text-[#2d6a4f] hover:underline">
            Activities →
          </Link>
          <span className="text-gray-200 select-none">·</span>
          <Link href={`/stays?region=${encodeURIComponent(region)}`}
            className="font-sans text-xs text-[#2d6a4f] hover:underline">
            Stays →
          </Link>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, Star, Mountain, Zap, Calendar } from 'lucide-react'
import { getTrails, type Trail } from '@/lib/trails'
import { getActivities, type Activity } from '@/lib/activities'

interface SmartRecommendation {
  title: string
  type: 'Trail' | 'Activity' | 'Experience' | 'Event'
  location: string
  rating?: number
  price?: number | null
  image: string
  href: string
  distance?: string
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  Trail: <Mountain size={10} />,
  Activity: <Zap size={10} />,
  Experience: <Star size={10} />,
  Event: <Calendar size={10} />,
}

const TYPE_COLOR: Record<string, string> = {
  Trail: 'text-[#2d6a4f]',
  Activity: 'text-[#C9A96E]',
  Experience: 'text-[#C9A96E]',
  Event: 'text-blue-400',
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=400&q=80'

// Normalise region names so "Northern Berg" matches "Royal Natal National Park" etc.
function trailMatchesRegion(trail: Trail, region: string): boolean {
  const r = region.toLowerCase()
  const tr = (trail.region || '').toLowerCase()
  if (tr.includes(r) || r.includes(tr)) return true
  if (r.includes('northern') && (tr.includes('northern') || tr.includes('royal natal') || tr.includes('cathedral'))) return true
  if (r.includes('central') && (tr.includes('central') || tr.includes("giant") || tr.includes('champagne'))) return true
  if (r.includes('southern') && (tr.includes('southern') || tr.includes('sani') || tr.includes('bushman'))) return true
  return false
}

function activityMatchesRegion(activity: Activity, region: string): boolean {
  const r = region.toLowerCase()
  const mp = (activity.meetingPoint || '').toLowerCase()
  const cat = (activity.category || '').toLowerCase()
  return mp.includes(r.split(' ')[0]) || r.includes(mp.split(' ')[0])
}

interface Props {
  region: string
  excludeListingId?: string
}

export default function SmartRecommendations({ region, excludeListingId }: Props) {
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [trails, activities] = await Promise.all([getTrails(), getActivities()])

      const trailItems: SmartRecommendation[] = trails
        .filter(t => t.status === 'published' && trailMatchesRegion(t, region))
        .slice(0, 3)
        .map(t => ({
          title: t.name,
          type: 'Trail' as const,
          location: t.region,
          image: t.image || FALLBACK_IMAGE,
          href: `/hikes/${t.id}`,
          distance: t.distance,
        }))

      const activityItems: SmartRecommendation[] = activities
        .filter(a => a.status === 'active' && a.id !== excludeListingId && activityMatchesRegion(a, region))
        .slice(0, 2)
        .map(a => ({
          title: a.name,
          type: 'Activity' as const,
          location: a.meetingPoint || region,
          price: a.pricePerPerson,
          image: FALLBACK_IMAGE,
          href: `/activities/${a.id}`,
        }))

      const combined = [...trailItems, ...activityItems].slice(0, 4)

      // If no region-specific results, show published trails as fallback
      if (!cancelled) {
        if (combined.length === 0) {
          const fallback: SmartRecommendation[] = trails
            .filter(t => t.status === 'published')
            .slice(0, 4)
            .map(t => ({
              title: t.name,
              type: 'Trail' as const,
              location: t.region,
              image: t.image || FALLBACK_IMAGE,
              href: `/hikes/${t.id}`,
              distance: t.distance,
            }))
          setRecommendations(fallback)
        } else {
          setRecommendations(combined)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [region, excludeListingId])

  if (recommendations.length === 0) return null

  return (
    <div className="bg-[#F7F5F2] border border-gray-200 p-5">
      <div className="mb-4">
        <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] block mb-1">Smart Booking</span>
        <h3 className="font-display italic text-xl text-[#000000]">While You're in {region}</h3>
        <p className="font-sans text-xs text-gray-400 mt-1">Trails, activities and events near your stay</p>
      </div>

      <div className="space-y-3">
        {recommendations.map(item => (
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
                {item.distance && (
                  <span className="font-sans text-[9px] text-gray-300">{item.distance}</span>
                )}
              </div>
              <p className="font-display italic text-sm text-[#000000] leading-tight group-hover:text-[#2d6a4f] transition-colors">{item.title}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="font-sans text-[10px] text-gray-400 flex items-center gap-0.5">
                  <MapPin size={8} />{item.location}
                </p>
                {item.rating && (
                  <span className="font-sans text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Star size={8} className="text-[#C9A96E] fill-[#C9A96E]" />
                    {item.rating}
                  </span>
                )}
              </div>
            </div>
            {item.price && (
              <div className="shrink-0 text-right">
                <p className="font-display italic text-sm text-[#2d6a4f]">R{item.price.toLocaleString()}</p>
                <p className="font-sans text-[9px] text-gray-400">pp</p>
              </div>
            )}
          </Link>
        ))}
      </div>

      <Link
        href={`/hikes?region=${encodeURIComponent(region)}`}
        className="mt-4 block text-center font-sans text-xs text-[#2d6a4f] hover:underline"
      >
        Explore all {region} listings →
      </Link>
    </div>
  )
}

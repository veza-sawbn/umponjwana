'use client'

import Link from 'next/link'
import { MapPin, Star, Mountain, Zap, Calendar, Bus, Plus, Navigation } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import { useShuttleRecommendations } from '@/lib/shuttle-service'
import { useAutoDrivingDistances, type DistancePlace } from '@/components/maps/GoogleAddressField'

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

const REGION_DATA: Record<string, SmartRecommendation[]> = {
  'Northern Berg': [
    { title: 'Cathedral Peak Summit', type: 'Trail', location: 'Cathedral Peak', rating: 4.7, price: null, image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=400&q=80', href: '/hikes/cathedral-peak', distance: '~12km' },
    { title: 'Tugela Falls Circuit', type: 'Trail', location: 'Royal Natal National Park', rating: 4.9, price: null, image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80', href: '/hikes/tugela-falls', distance: '~14km' },
    { title: 'Berg Photography Tour', type: 'Activity', location: 'Northern Berg', rating: 4.8, price: 950, image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80', href: '/activities/a1' },
    { title: 'Guided Rock Climbing', type: 'Activity', location: 'Amphitheatre', rating: 4.9, price: 750, image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', href: '/activities/a1' },
    { title: 'Drakensberg Boys Choir', type: 'Event', location: 'Drakensberg Boys Choir School', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80', href: '/events/boys-choir' },
  ],
  'Central Berg': [
    { title: "Giant's Castle via Meander", type: 'Trail', location: "Giant's Castle", rating: 4.6, price: null, image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80', href: '/hikes/giants-castle', distance: '~18km' },
    { title: 'Fairy Glen Waterfall Walk', type: 'Trail', location: 'Central Berg', rating: 4.6, price: null, image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80', href: '/hikes/fairy-glen', distance: '~7km' },
    { title: 'San Rock Art Full-Day Tour', type: 'Experience', location: "Giant's Castle", rating: 4.9, price: 620, image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80', href: '/activities/a2' },
    { title: 'Bearded Vulture Hide', type: 'Experience', location: "Giant's Castle", rating: 4.8, price: 480, image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80', href: '/activities/a3' },
    { title: 'Midlands Meander Art Route', type: 'Event', location: 'Midlands', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', href: '/events/midlands-meander' },
  ],
  'Southern Berg': [
    { title: 'Sani Pass to Lesotho', type: 'Trail', location: 'Sani Pass', rating: 4.9, price: null, image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80', href: '/hikes/sani-pass', distance: '~8km' },
    { title: "Bushman's Nek Loop", type: 'Trail', location: 'Southern Berg', rating: 4.5, price: null, image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=400&q=80', href: '/hikes/bushmans-nek', distance: '~10km' },
    { title: 'Sani Pass 4WD Tour', type: 'Activity', location: 'Sani Pass', rating: 4.8, price: 850, image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80', href: '/activities/sani-4wd' },
    { title: 'Zulu Cultural Village', type: 'Experience', location: 'Southern Foothills', rating: 4.7, price: 350, image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80', href: '/activities/zulu-village' },
  ],
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

interface Props {
  region: string
  excludeListingId?: string
  originLocation?: string
  originLat?: string
  originLng?: string
}

function formatDistance(result: { distanceKm: number; durationText: string } | null | undefined) {
  if (!result) return null
  return `${result.distanceKm} km · ~${result.durationText} away`
}

export default function SmartRecommendations({ region, excludeListingId, originLocation, originLat, originLng }: Props) {
  const booking = useBooking()
  const recommendations = (REGION_DATA[region] || REGION_DATA['Central Berg']).slice(0, 4)
  const shuttleRecommendations = useShuttleRecommendations(booking)

  const origin: DistancePlace | null = originLocation ? { address: `${originLocation}, South Africa`, lat: originLat, lng: originLng } : null
  const destinations: DistancePlace[] = [
    ...recommendations.map(item => ({ address: `${item.location}, South Africa` })),
    ...shuttleRecommendations.map(shuttle => ({ address: `${shuttle.destination || shuttle.label}, South Africa` })),
  ]
  const { results: distances, status: distanceStatus } = useAutoDrivingDistances(origin, destinations)
  const recommendationDistances = distances.slice(0, recommendations.length)
  const shuttleDistances = distances.slice(recommendations.length)

  if (recommendations.length === 0) return null

  return (
    <div className="bg-[#F7F5F2] border border-gray-200 p-5">
      <div className="mb-4">
        <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] block mb-1">Smart Booking</span>
        <h3 className="font-display italic text-xl text-[#000000]">While You're in {region}</h3>
        <p className="font-sans text-xs text-gray-400 mt-1">Trails, activities and events near your stay</p>
      </div>

      {shuttleRecommendations.length > 0 && (
        <div className="space-y-3 mb-4">
          {shuttleRecommendations.map((shuttle, i) => {
            const shuttleDistanceLabel = formatDistance(shuttleDistances[i])
            return (
              <button
                key={shuttle.id}
                onClick={() => booking.setShuttle(shuttle)}
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
                  <p className="font-display italic text-sm text-[#2d6a4f]">R{shuttle.price.toLocaleString()}</p>
                  <p className="font-sans text-[9px] text-gray-400 inline-flex items-center gap-1 justify-end"><Plus size={9} /> Add</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="space-y-3">
        {recommendations.map((item, i) => {
          const liveDistance = formatDistance(recommendationDistances[i])
          const distanceLabel = liveDistance || (distanceStatus === 'calculating' && origin ? 'Calculating…' : item.distance)
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
          )
        })}
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

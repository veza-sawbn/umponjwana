'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SlidersHorizontal, X } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import EditablePageHeader from '@/components/editor/EditablePageHeader'
import { getProperties, type Property } from '@/lib/properties'
import { getRoomsByProperty } from '@/lib/rooms'

type StayCard = {
  id: string
  title: string
  location: string
  price: number
  rating?: number
  reviews?: number
  img?: string
  category: string
  amenities: string[]
  guests?: number
  discount?: number
  featured?: boolean
}

function propToCard(p: Property, minPrice = 0): StayCard {
  const amenityMap: Record<string, string> = {
    'Swimming Pool': 'pool', 'Wi-Fi': 'wifi', 'Braai Facilities': 'braai',
    'Hiking Trails Access': 'hiking', 'Restaurant': 'restaurant', 'Spa': 'spa',
  }
  return {
    id: p.id,
    title: p.name,
    location: p.region || p.address,
    price: minPrice,
    category: p.type,
    amenities: p.amenities.map(a => amenityMap[a] ?? a.toLowerCase()),
    img: p.photos[0] || undefined,
  }
}

const AMENITY_OPTS = ['pool', 'wifi', 'braai', 'hiking']
const SORT_OPTS = ['Recommended', 'Price: Low to High', 'Price: High to Low', 'Rating']

export default function StaysPage() {
  const [sortBy, setSortBy] = useState('Recommended')
  const [maxPrice, setMaxPrice] = useState(5000)
  const [amenities, setAmenities] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [liveProperties, setLiveProperties] = useState<StayCard[]>([])

  useEffect(() => {
    getProperties().then(async props => {
      const active = props.filter(p => p.status === 'active')
      const cards = await Promise.all(active.map(async p => {
        const rooms = await getRoomsByProperty(p.id)
        const minPrice = rooms.length > 0 ? Math.min(...rooms.map(r => r.basePrice)) : 0
        return propToCard(p, minPrice)
      }))
      setLiveProperties(cards)
    })
  }, [])

  const toggleAmenity = (a: string) =>
    setAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a])

  const filtered = liveProperties
    .filter((s) => (!s.price || s.price <= maxPrice) && (!amenities.length || amenities.every((a) => s.amenities.includes(a))))
    .sort((a, b) => {
      if (sortBy === 'Price: Low to High') return a.price - b.price
      if (sortBy === 'Price: High to Low') return b.price - a.price
      if (sortBy === 'Rating') return (b.rating ?? 0) - (a.rating ?? 0)
      return 0
    })

  return (
    <main className="bg-mist min-h-screen pt-16">
      {/* Header */}
      <EditablePageHeader section="stays_page" />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8">
          <p className="font-sans text-sm text-forest/50">
            <span className="text-forest font-medium">{filtered.length}</span> stays
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-2 font-sans text-sm border border-black/15 bg-white px-4 py-2 hover:border-forest transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="font-sans text-sm border border-black/15 bg-white px-4 py-2 focus:outline-none hover:border-forest transition-colors"
            >
              {SORT_OPTS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-white border border-black/8 p-6 mb-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="font-sans text-xs tracking-[0.15em] uppercase text-forest/40 mb-3">Max price / night</p>
              <div className="flex items-center justify-between font-sans text-sm text-forest mb-2">
                <span>R0</span><span className="font-medium">R{maxPrice.toLocaleString()}</span>
              </div>
              <input type="range" min={0} max={5000} step={100} value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-forest" />
            </div>
            <div>
              <p className="font-sans text-xs tracking-[0.15em] uppercase text-forest/40 mb-3">Amenities</p>
              <div className="space-y-2">
                {AMENITY_OPTS.map((a) => (
                  <label key={a} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={amenities.includes(a)} onChange={() => toggleAmenity(a)}
                      className="accent-forest w-3.5 h-3.5" />
                    <span className="font-sans text-sm text-forest/70 capitalize">{a}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-2 flex items-end">
              <button onClick={() => { setAmenities([]); setMaxPrice(5000) }}
                className="font-sans text-xs text-forest/40 hover:text-forest transition-colors inline-flex items-center gap-1">
                <X className="w-3 h-3" /> Clear filters
              </button>
            </div>
          </div>
        )}

        {/* Grid */}
        {filtered.length === 0 && (
          <p className="font-sans text-sm text-forest/40 py-16 text-center">No stays match these filters yet.</p>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
          {filtered.map((stay) => {
            const discountedPrice = stay.discount ? Math.round(stay.price * (1 - stay.discount / 100)) : null
            return (
              <Link key={stay.id} href={`/stays/${stay.id}`} className="group block">
                <div className="relative overflow-hidden aspect-[4/3] mb-4 bg-[#2d6a4f]/10">
                  {stay.img ? (
                    <img src={stay.img} alt={stay.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#C9A96E]/10">
                      <span className="font-display italic text-2xl text-[#C9A96E]/40">{stay.category}</span>
                    </div>
                  )}
                  {stay.featured && (
                    <span className="absolute top-3 left-3 font-sans text-[10px] tracking-[0.15em] uppercase bg-gold text-forest px-2.5 py-1">
                      Featured
                    </span>
                  )}
                  {stay.discount && (
                    <span className="absolute top-3 right-3 font-sans text-[10px] tracking-[0.1em] bg-forest text-white px-2 py-1">
                      -{stay.discount}%
                    </span>
                  )}
                </div>
                <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{stay.category} · {stay.location}</p>
                <h3 className="font-display text-xl text-forest leading-snug mb-2 group-hover:text-sage transition-colors">{stay.title}</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {stay.rating ? (
                      <>
                        <span className="text-gold text-sm">★</span>
                        <span className="font-sans text-sm text-forest/70">{stay.rating}</span>
                        {stay.reviews && <span className="font-sans text-xs text-forest/35">({stay.reviews})</span>}
                      </>
                    ) : (
                      <span className="font-sans text-xs text-forest/35">New listing</span>
                    )}
                  </div>
                  <div className="text-right">
                    {stay.price > 0 ? (
                      discountedPrice ? (
                        <div>
                          <span className="font-sans text-xs text-forest/35 line-through mr-1">R{stay.price.toLocaleString()}</span>
                          <span className="font-display text-lg text-forest">R{discountedPrice.toLocaleString()}</span>
                          <span className="font-sans text-xs text-forest/40"> /night</span>
                        </div>
                      ) : (
                        <span>
                          <span className="font-display text-lg text-forest">R{stay.price.toLocaleString()}</span>
                          <span className="font-sans text-xs text-forest/40"> /night</span>
                        </span>
                      )
                    ) : (
                      <span className="font-sans text-xs text-forest/40">Contact for rates</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
      <Footer />
    </main>
  )
}

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { Calendar, Users, MapPin, ArrowRight, Search, SlidersHorizontal, X, Check, Bed } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import { getRegionNames, DEFAULT_REGIONS } from '@/lib/regions'

/* ── Mock data ─────────────────────────────────────────────────────────────── */

const ALL_STAYS = [
  { id: 's1', title: 'Cathedral Peak Mountain Lodge', region: 'Northern Berg', price: 1850, rating: 4.9, reviews: 142, img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80', available: true },
  { id: 's2', title: 'Amphitheatre Backpackers', region: 'Royal Natal', price: 320, rating: 4.7, reviews: 89, img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80', available: true },
  { id: 's3', title: 'Sani Lodge Drakensberg', region: 'Southern Berg', price: 2200, rating: 4.8, reviews: 67, img: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&q=80', available: true },
  { id: 's4', title: "Drakensberg Sun Resort", region: 'Central Berg', price: 1400, rating: 4.5, reviews: 210, img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80', available: false },
  { id: 's5', title: "Monk's Cowl Tented Camp", region: 'Central Berg', price: 950, rating: 4.6, reviews: 54, img: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80', available: true },
  { id: 's6', title: 'Royal Natal National Park Hotel', region: 'Royal Natal', price: 1650, rating: 4.8, reviews: 183, img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80', available: true },
]

const ALL_HIKES = [
  { id: 'tugela-falls', title: 'Tugela Falls Circuit', region: 'Royal Natal', distance: '14 km', difficulty: 'Hard', duration: '6–8 h', img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80' },
  { id: 'amphitheatre', title: 'Amphitheatre via Chain Ladder', region: 'Royal Natal', distance: '8 km', difficulty: 'Moderate', duration: '4–5 h', img: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80' },
  { id: 'fairy-glen', title: 'Fairy Glen Waterfall Walk', region: 'Central Berg', distance: '5 km', difficulty: 'Easy', duration: '2 h', img: 'https://images.unsplash.com/photo-1542587222-e14b891ee40b?w=600&q=80' },
  { id: 'cathedral-peak', title: 'Cathedral Peak Summit', region: 'Northern Berg', distance: '16 km', difficulty: 'Hard', duration: '8 h', img: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600&q=80' },
  { id: 'giants-castle', title: "Giant's Castle via Meander", region: "Giant's Castle", distance: '18 km', difficulty: 'Moderate', duration: '7–9 h', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80' },
]

const ALL_ACTIVITIES = [
  { id: 'a1', title: 'Guided Rock Climbing', region: 'Royal Natal', price: 750, category: 'Adventure', img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80' },
  { id: 'a2', title: 'San Rock Art Full-Day Tour', region: "Giant's Castle", price: 620, category: 'Culture', img: 'https://images.unsplash.com/photo-1529946179074-1f3cf40c0a0e?w=600&q=80' },
  { id: 'a3', title: 'Fly Fishing on the Mlambonja', region: 'Central Berg', price: 890, category: 'Nature', img: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&q=80' },
  { id: 'a4', title: 'Horse Riding in the Foothills', region: 'Southern Berg', price: 680, category: 'Adventure', img: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80' },
  { id: 'a5', title: 'Abseiling at Sani Pass', region: 'Sani Pass', price: 720, category: 'Adventure', img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=600&q=80' },
]

const ALL_EVENTS = [
  { id: 'e1', title: 'Drakensberg Star Gazing Night', region: 'Northern Berg', date: '20 Jul 2026', price: 350, img: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&q=80' },
  { id: 'e2', title: 'Winter Wildflower Walk', region: 'Central Berg', date: '1–31 Jul 2026', price: 180, img: 'https://images.unsplash.com/photo-1487530811015-780780bfe571?w=600&q=80' },
  { id: 'e3', title: 'Berg & Braai Sunset Special', region: 'Champagne Valley', date: '25 Jul 2026', price: 450, img: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=600&q=80' },
  { id: 'e4', title: 'San Rock Art Photography Workshop', region: "Giant's Castle", date: '5 Aug 2026', price: 950, img: 'https://images.unsplash.com/photo-1529946179074-1f3cf40c0a0e?w=600&q=80' },
  { id: 'e5', title: 'Drakensberg Boys Choir Performance', region: 'Central Berg', date: '19 Jul 2026', price: 280, img: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=600&q=80' },
]

const ALL_RESTAURANTS = [
  { id: 'r1', title: 'The Escarpment Restaurant', region: 'Northern Berg', cuisine: 'Modern South African', price_range: 'R180–R350', rating: 4.7, img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80' },
  { id: 'r2', title: 'Champagne Terrace', region: 'Champagne Valley', cuisine: 'Steakhouse & Grill', price_range: 'R120–R280', rating: 4.5, img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80' },
  { id: 'r3', title: 'Sani Top Chalet Bar', region: 'Sani Pass', cuisine: 'Pub Grub & Local', price_range: 'R80–R180', rating: 4.3, img: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=600&q=80' },
  { id: 'r4', title: "The Drakensberg Kitchen", region: 'Central Berg', cuisine: 'Farm-to-Table', price_range: 'R160–R320', rating: 4.8, img: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=600&q=80' },
]

/* ── Helpers ───────────────────────────────────────────────────────────────── */

const DIFF_COLOR: Record<string, string> = { Easy: '#4A7251', Moderate: '#C9A96E', Hard: '#c0392b', Strenuous: '#c0392b' }

function nights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return null
  const diff = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  return diff > 0 ? diff : null
}

function fmt(date: string) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

/* ── Section wrappers ─────────────────────────────────────────────────────── */

function SectionHeader({ label, heading, count, href }: { label: string; heading: string; count: number; href: string }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#C9A96E] mb-1">{label}</p>
        <h2 className="font-display italic text-2xl text-[#000000]">{heading}</h2>
      </div>
      <Link href={href} className="font-sans text-xs text-[#2d6a4f] hover:underline hidden sm:block">
        See all ({count}) →
      </Link>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

function SearchResults() {
  const params = useSearchParams()
  const router = useRouter()
  const booking = useBooking()

  const regionParam = params.get('region') || booking.region || ''
  const checkInParam = params.get('check_in') || booking.checkIn || ''
  const checkOutParam = params.get('check_out') || booking.checkOut || ''
  const guestsParam = parseInt(params.get('guests') || String(booking.guests) || '2')

  const [region, setRegion] = useState(regionParam)
  const [checkIn, setCheckIn] = useState(checkInParam)
  const [checkOut, setCheckOut] = useState(checkOutParam)
  const [guests, setGuests] = useState(guestsParam)
  const [showFilters, setShowFilters] = useState(false)
  const [regionOptions, setRegionOptions] = useState(DEFAULT_REGIONS.map(r => r.name))
  const [availableOnly, setAvailableOnly] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    getRegionNames().then(setRegionOptions)
  }, [])
  const numNights = nights(checkIn, checkOut)

  function refine() {
    booking.setSearch(region, checkIn, checkOut, guests)
    const p = new URLSearchParams()
    if (region) p.set('region', region)
    if (checkIn) p.set('check_in', checkIn)
    if (checkOut) p.set('check_out', checkOut)
    p.set('guests', String(guests))
    router.push(`/search?${p.toString()}`)
  }

  // Filter by region when one is selected
  function matchRegion(r: string) {
    return !region || r.toLowerCase().includes(region.toLowerCase())
  }

  const stays = ALL_STAYS.filter(s => matchRegion(s.region) && (!availableOnly || s.available))
  const hikes = ALL_HIKES.filter(h => matchRegion(h.region))
  const activities = ALL_ACTIVITIES.filter(a => matchRegion(a.region))
  const events = ALL_EVENTS.filter(e => matchRegion(e.region))
  const restaurants = ALL_RESTAURANTS.filter(r => matchRegion(r.region))

  const hasResults = stays.length + hikes.length + activities.length + events.length + restaurants.length > 0

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      {/* Sticky search refinement bar */}
      <div className="bg-white border-b border-gray-200 mt-16 sticky top-16 z-30">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Region */}
            <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 bg-[#F7F5F2]">
              <MapPin size={12} className="text-gray-400" />
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="font-sans text-sm bg-transparent focus:outline-none"
              >
                <option value="">All Drakensberg</option>
                {regionOptions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 bg-[#F7F5F2]">
              <Calendar size={12} className="text-gray-400" />
              <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} min={today}
                className="font-sans text-sm bg-transparent focus:outline-none" />
              <span className="text-gray-300">→</span>
              <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} min={checkIn || today}
                className="font-sans text-sm bg-transparent focus:outline-none" />
            </div>

            {/* Guests */}
            <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 bg-[#F7F5F2]">
              <Users size={12} className="text-gray-400" />
              <button onClick={() => setGuests(g => Math.max(1, g - 1))} className="text-gray-400 hover:text-[#2d6a4f] font-bold w-4 text-center">−</button>
              <span className="font-sans text-sm min-w-[2ch] text-center">{guests}</span>
              <button onClick={() => setGuests(g => g + 1)} className="text-gray-400 hover:text-[#2d6a4f] font-bold w-4 text-center">+</button>
              <span className="font-sans text-xs text-gray-400">guests</span>
            </div>

            <button
              onClick={refine}
              className="bg-[#2d6a4f] text-white px-5 py-2 font-sans text-sm hover:bg-[#235a3f] transition-colors flex items-center gap-1.5"
            >
              <Search size={13} /> Update
            </button>

            <button
              onClick={() => setShowFilters(v => !v)}
              className={`ml-auto flex items-center gap-1.5 px-4 py-2 border font-sans text-xs transition-colors ${showFilters ? 'border-[#2d6a4f] text-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 text-gray-600 hover:border-[#2d6a4f]'}`}
            >
              <SlidersHorizontal size={13} /> Filters
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4 items-center">
              <label className="flex items-center gap-2 font-sans text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)} className="accent-[#2d6a4f]" />
                Available stays only
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Results summary */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 pt-10 pb-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-display italic text-3xl text-[#000000]">
            {region || 'All Drakensberg'}
          </h1>
          {(checkIn || checkOut) && (
            <span className="font-sans text-sm text-gray-500">
              {fmt(checkIn)} {checkOut && `→ ${fmt(checkOut)}`}
              {numNights && ` · ${numNights} night${numNights !== 1 ? 's' : ''}`}
            </span>
          )}
          {guests > 0 && (
            <span className="font-sans text-sm text-gray-500">· {guests} guest{guests !== 1 ? 's' : ''}</span>
          )}
        </div>
        {!hasResults && (
          <p className="font-sans text-sm text-gray-500 mt-2">No results found. Try a different region or remove filters.</p>
        )}
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-20 space-y-16">

        {/* ── Accommodation ── */}
        {stays.length > 0 && (
          <section>
            <SectionHeader label="Where to sleep" heading="Accommodation" count={stays.length} href="/stays" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {stays.map(stay => {
                const isSelected = booking.stay?.id === stay.id
                return (
                  <div key={stay.id} className={`group bg-white flex flex-col ${!stay.available ? 'opacity-60' : ''} border ${isSelected ? 'border-[#2d6a4f]' : 'border-transparent'}`}>
                    <Link href={`/stays/${stay.id}?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}`}>
                      <div className="aspect-[4/3] overflow-hidden relative">
                        <img src={stay.img} alt={stay.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        {isSelected && (
                          <div className="absolute top-3 left-3 bg-[#2d6a4f] text-white font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 flex items-center gap-1">
                            <Check size={10} /> Selected
                          </div>
                        )}
                        {!stay.available && (
                          <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                            <span className="bg-white font-sans text-xs px-3 py-1.5 border border-gray-300 text-gray-500">Unavailable for these dates</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{stay.region}</span>
                          <span className="font-sans text-xs text-[#2d6a4f]">★ {stay.rating} <span className="text-gray-400">({stay.reviews})</span></span>
                        </div>
                        <h3 className="font-display italic text-lg mb-2">{stay.title}</h3>
                        <div className="flex items-end justify-between">
                          <span className="font-sans text-xs text-gray-400">
                            {numNights ? `R ${(stay.price * numNights).toLocaleString()} total` : 'From'}
                          </span>
                          <p className="font-display italic text-xl text-[#2d6a4f]">
                            R {stay.price.toLocaleString()}<span className="font-sans text-xs text-gray-400">/night</span>
                          </p>
                        </div>
                      </div>
                    </Link>
                    {stay.available && (
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => isSelected
                            ? booking.setStay(null)
                            : booking.setStay({ id: stay.id, title: stay.title, region: stay.region, price_per_night: stay.price, img: stay.img })
                          }
                          className={`w-full py-2.5 font-sans text-sm transition-colors flex items-center justify-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#2d6a4f] text-white hover:bg-red-600'
                              : 'border border-[#2d6a4f] text-[#2d6a4f] hover:bg-[#2d6a4f] hover:text-white'
                          }`}
                        >
                          {isSelected ? <><X size={13} /> Remove</> : <><Bed size={13} /> Select this Stay</>}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-4 sm:hidden">
              <Link href="/stays" className="font-sans text-sm text-[#2d6a4f]">See all accommodation →</Link>
            </div>
          </section>
        )}

        {/* ── Hikes ── */}
        {hikes.length > 0 && (
          <section>
            <SectionHeader label="On foot" heading="Hikes & Trails" count={hikes.length} href="/hikes" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {hikes.map(h => (
                <Link key={h.id} href={`/hikes/${h.id}`} className="group bg-white">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={h.img} alt={h.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h.region}</span>
                      <span className="font-sans text-xs px-2 py-0.5" style={{ color: DIFF_COLOR[h.difficulty], background: DIFF_COLOR[h.difficulty] + '20' }}>{h.difficulty}</span>
                    </div>
                    <h3 className="font-display italic text-lg mb-2">{h.title}</h3>
                    <p className="font-sans text-xs text-gray-400">{h.distance} · {h.duration}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Activities ── */}
        {activities.length > 0 && (
          <section>
            <SectionHeader label="Things to do" heading="Activities & Experiences" count={activities.length} href="/activities" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activities.map(a => (
                <Link key={a.id} href={`/activities/${a.id}`} className="group bg-white">
                  <div className="aspect-[4/3] overflow-hidden relative">
                    <img src={a.img} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <span className="absolute top-3 left-3 bg-black/60 text-white font-sans text-[10px] tracking-[0.12em] uppercase px-2.5 py-1">{a.category}</span>
                  </div>
                  <div className="p-4">
                    <span className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{a.region}</span>
                    <h3 className="font-display italic text-lg mt-1 mb-2">{a.title}</h3>
                    <p className="font-display italic text-xl text-[#2d6a4f]">R {a.price.toLocaleString()} <span className="font-sans text-xs text-gray-400">pp</span></p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Events ── */}
        {events.length > 0 && (
          <section>
            <SectionHeader label="What's on" heading="Events & Specials" count={events.length} href="/events" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {events.map(ev => (
                <Link key={ev.id} href="/events" className="group bg-white">
                  <div className="aspect-[3/2] overflow-hidden">
                    <img src={ev.img} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  </div>
                  <div className="p-4">
                    <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-[#C9A96E] mb-1">{ev.date}</p>
                    <h3 className="font-display italic text-base mb-1 group-hover:text-[#2d6a4f] transition-colors">{ev.title}</h3>
                    <p className="font-sans text-xs text-gray-400 mb-2">{ev.region}</p>
                    <p className="font-display italic text-lg text-[#2d6a4f]">R {ev.price}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Restaurants ── */}
        {restaurants.length > 0 && (
          <section>
            <SectionHeader label="Where to eat" heading="Restaurants & Dining" count={restaurants.length} href="/dining" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {restaurants.map(r => (
                <div key={r.id} className="bg-white">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={r.img} alt={r.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{r.region}</span>
                      <span className="font-sans text-xs text-[#2d6a4f]">★ {r.rating}</span>
                    </div>
                    <h3 className="font-display italic text-base mb-1">{r.title}</h3>
                    <p className="font-sans text-xs text-gray-400">{r.cuisine}</p>
                    <p className="font-sans text-xs text-gray-500 mt-1">{r.price_range} per person</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>
      <Footer />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  )
}

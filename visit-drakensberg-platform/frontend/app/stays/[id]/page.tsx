'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { MapPin, Star, Users, Wifi, Flame, Utensils, Car, ArrowLeft, Calendar, Coffee, Waves, TreePine, ShieldCheck, BedDouble } from 'lucide-react'
import SmartRecommendations from '@/components/booking/SmartRecommendations'
import { useBooking } from '@/lib/booking-context'
import { Check } from 'lucide-react'
import { getPropertyById, type Property } from '@/lib/properties'
import { getRoomsByProperty, type Room } from '@/lib/rooms'

// Hardcoded showcase stays (keep existing behaviour for demo IDs)
const HARDCODED: Record<string, any> = {
  s1: {
    title: 'Cathedral Peak Mountain Lodge',
    category: 'Mountain Lodge',
    location: 'Cathedral Peak, Northern Berg',
    region: 'Northern Berg',
    rating: 4.9,
    review_count: 142,
    member_since: '2019',
    response_rate: '97%',
    description: 'Perched beneath the towering Cathedral Peak massif, this classic mountain lodge offers an authentic Drakensberg experience. The lodge has been a beloved fixture in the Northern Berg since 1939, offering warm hospitality, fine dining and uninterrupted access to the surrounding wilderness.',
    highlights: ['Situated at 1,400m altitude', 'Direct trailhead access', 'Licensed restaurant & bar', 'Guided hikes on request'],
    price_from: 1850,
    hero: 'bg-[#1a1a2e]',
    amenities: [
      { label: 'Free WiFi', icon: Wifi },
      { label: 'Fireplace', icon: Flame },
      { label: 'Restaurant', icon: Utensils },
      { label: 'Parking', icon: Car },
      { label: 'Breakfast', icon: Coffee },
      { label: 'Pool', icon: Waves },
    ],
    images: [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1400&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    ],
    rooms: [
      { id: 'r1', name: 'Mountain View Suite', description: 'Panoramic floor-to-ceiling views of the massif. King bed, en-suite bathroom with soaking tub.', max_guests: 2, price_per_night: 2200, amenities: ['En-suite', 'Soaking tub', 'Fireplace', 'Mountain view', 'King bed'] },
      { id: 'r2', name: 'Garden Chalet', description: 'Self-contained chalet set in the garden. Ideal for families with a private braai area.', max_guests: 4, price_per_night: 1850, amenities: ['Private braai', 'Kitchen', 'Family room', 'Garden access'] },
      { id: 'r3', name: 'Classic Double', description: 'Comfortable and cosy, with a private balcony overlooking the valley.', max_guests: 2, price_per_night: 1450, amenities: ['En-suite', 'Balcony', 'Double bed'] },
      { id: 'r4', name: 'Backpacker Dorm', description: 'Shared dormitory with 6 beds, lockers and access to communal kitchen.', max_guests: 6, price_per_night: 380, amenities: ['Shared bathroom', 'Lockers', 'Kitchen access', 'Bunk beds'] },
    ],
    reviews_list: [
      { name: 'Sarah van der Merwe', rating: 5, date: 'June 2026', comment: 'The location is simply breathtaking. Woke up every morning to mist rolling off the peaks. The staff are exceptional.' },
      { name: 'James Fourie', rating: 5, date: 'May 2026', comment: 'We have stayed here three times and it never disappoints. The Mountain View Suite is worth every cent.' },
      { name: 'Priya Naidoo', rating: 4, date: 'April 2026', comment: 'Beautiful setting, great food. The only minor issue was the WiFi being slow in our room, but that is hardly what you come here for!' },
      { name: 'Tom Kruger', rating: 5, date: 'March 2026', comment: 'Perfect base for day hikes. The lodge provided packed lunches and arranged permits. Could not have been smoother.' },
    ],
  },
  s2: {
    title: 'Tendele Tented Camp',
    category: 'Luxury Tented Camp',
    location: 'Royal Natal National Park',
    region: 'Northern Berg',
    rating: 4.8,
    review_count: 87,
    member_since: '2021',
    response_rate: '99%',
    description: 'An exclusive tented camp within the Royal Natal National Park, Tendele offers a genuine wilderness immersion steps from the Amphitheatre and Tugela Falls.',
    highlights: ['Inside Royal Natal National Park', 'Solar-powered off-grid camp', 'Private deck per tent', 'Fully catered'],
    price_from: 2400,
    hero: 'bg-[#2d6a4f]',
    amenities: [{ label: 'Full Board', icon: Utensils }, { label: 'Firepit', icon: Flame }, { label: 'Nature Walks', icon: TreePine }, { label: 'Parking', icon: Car }],
    images: ['https://images.unsplash.com/photo-1533873984035-25970ab07461?w=1400&q=80', 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80', 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800&q=80', 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80'],
    rooms: [
      { id: 'r1', name: 'Escarpment Tent', description: 'King-size bed, private en-suite with outdoor shower. Direct views of the Amphitheatre wall.', max_guests: 2, price_per_night: 3200, amenities: ['En-suite', 'Outdoor shower', 'Private deck', 'Escarpment view'] },
      { id: 'r2', name: 'Family Tent', description: 'Two rooms connected by a shared lounge area. Ideal for families.', max_guests: 4, price_per_night: 2800, amenities: ['Two rooms', 'Shared lounge', 'Family layout', 'En-suite'] },
    ],
    reviews_list: [
      { name: 'Megan & Luke H.', rating: 5, date: 'June 2026', comment: 'Our honeymoon stay. Completely secluded, exceptional food, and waking up to the Amphitheatre every morning was surreal.' },
    ],
  },
  s3: {
    title: "Giant's Castle Restcamp",
    category: 'Self-Catering Restcamp',
    location: "Giant's Castle, Central Berg",
    region: 'Central Berg',
    rating: 4.5,
    review_count: 203,
    member_since: '2018',
    response_rate: '94%',
    description: "Ezemvelo KZN Wildlife's flagship restcamp in the Giant's Castle Game Reserve. The camp sits at 1,750m and is the gateway to over 5,000 San Bushman rock art paintings.",
    highlights: ['San rock art access on doorstep', 'Eland and vulture hide nearby', 'Lammergeier hide bookings', 'National Heritage Site'],
    price_from: 680,
    hero: 'bg-[#8B4513]',
    amenities: [{ label: 'Self-Catering', icon: Utensils }, { label: 'Fireplace', icon: Flame }, { label: 'Parking', icon: Car }, { label: 'Nature Walks', icon: TreePine }],
    images: ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1400&q=80', 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80', 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80', 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80'],
    rooms: [
      { id: 'r1', name: 'Luxury Cottage', description: 'Two-bedroom self-catering cottage with a fully equipped kitchen, fireplace and braai area.', max_guests: 4, price_per_night: 1250, amenities: ['2 bedrooms', 'Kitchen', 'Braai', 'Fireplace'] },
      { id: 'r2', name: 'Standard Chalet', description: 'En-suite chalet sleeping 2, with a kitchenette and covered stoep.', max_guests: 2, price_per_night: 780, amenities: ['En-suite', 'Kitchenette', 'Stoep', 'Mountain view'] },
      { id: 'r3', name: 'Budget Rondavel', description: 'Circular rondavel with twin beds and shared bathroom facilities.', max_guests: 2, price_per_night: 480, amenities: ['Twin beds', 'Shared bathroom', 'Camp shop access'] },
    ],
    reviews_list: [
      { name: 'Nokukhanya Zulu', rating: 5, date: 'May 2026', comment: 'The rock art experience is like nothing else. A knowledgeable Ezemvelo guide made the history come alive.' },
      { name: 'Riaan Botha', rating: 4, date: 'March 2026', comment: 'Excellent value. The luxury cottage was well-equipped. Bring your own firewood and supplies from town.' },
    ],
  },
}

const AMENITY_ICONS: Record<string, React.ComponentType<any>> = {
  'Wi-Fi': Wifi, 'Swimming Pool': Waves, 'Braai Facilities': Flame, 'Restaurant': Utensils,
  'Bar': Utensils, 'Spa': ShieldCheck, 'Gym': ShieldCheck, 'Laundry': ShieldCheck,
  'Airport Transfers': Car, 'Hiking Trails Access': TreePine, 'Pet-Friendly': TreePine,
  'Wheelchair Access': ShieldCheck,
}

function propToStay(prop: Property, rooms: Room[]) {
  const minPrice = rooms.length > 0 ? Math.min(...rooms.map(r => r.basePrice)) : 0
  return {
    title: prop.name,
    category: prop.type,
    location: prop.region || prop.address,
    address: prop.address || prop.region,
    gpsLat: prop.gpsLat,
    gpsLng: prop.gpsLng,
    region: prop.region || '',
    rating: null as null | number,
    review_count: 0,
    member_since: new Date(prop.createdAt).getFullYear().toString(),
    response_rate: '—',
    description: prop.description,
    highlights: prop.amenities.slice(0, 4),
    price_from: minPrice,
    hero: 'bg-[#2d6a4f]',
    amenities: prop.amenities.map(a => ({ label: a, icon: AMENITY_ICONS[a] ?? ShieldCheck })),
    images: prop.photos.length > 0 ? prop.photos : ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80'],
    checkIn: prop.checkIn,
    checkOut: prop.checkOut,
    rooms: rooms.map(r => ({
      id: r.id,
      name: r.name,
      description: [r.bedConfig, r.enSuite ? 'En-suite' : '', r.sizeSqm ? `${r.sizeSqm}m²` : ''].filter(Boolean).join(' · '),
      max_guests: r.maxOccupancy,
      price_per_night: r.basePrice,
      amenities: [...(r.features ?? []), ...(r.inclusions ?? [])],
    })),
    reviews_list: [] as any[],
  }
}

export default function StayDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const booking = useBooking()

  const [stay, setStay] = useState<any>(HARDCODED[id] || null)
  const [loading, setLoading] = useState(!HARDCODED[id])

  const [selectedRoom, setSelectedRoom] = useState<any>(null)
  const [showRooms, setShowRooms] = useState(false)
  const [checkIn, setCheckIn] = useState(booking.checkIn || '')
  const [checkOut, setCheckOut] = useState(booking.checkOut || '')
  const [guests, setGuests] = useState(booking.guests || 2)

  useEffect(() => {
    if (HARDCODED[id]) return
    Promise.all([getPropertyById(id), getRoomsByProperty(id)]).then(([prop, rooms]) => {
      if (prop) setStay(propToStay(prop, rooms))
      setLoading(false)
    })
  }, [id])

  const isSelectedStay = booking.stay?.id === id
  const nights = checkIn && checkOut
    ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
    : 1
  const total = selectedRoom ? selectedRoom.price_per_night * nights : null

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!stay) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex flex-col items-center justify-center gap-4">
        <Navbar />
        <p className="font-sans text-black/40">Property not found.</p>
        <Link href="/stays" className="font-sans text-sm text-[#C9A96E] hover:underline">← Back to Stays</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      {/* Hero header */}
      <section className={`${stay.hero} text-white py-20 px-6 lg:px-12 mt-16`}>
        <div className="max-w-[1440px] mx-auto">
          <Link href="/stays" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={16} /> All Stays
          </Link>
          <span className="inline-block font-sans text-[10px] tracking-[0.14em] uppercase bg-[#C9A96E]/20 text-[#C9A96E] px-3 py-1.5 mb-4">{stay.category}</span>
          <h1 className="font-display italic text-5xl lg:text-6xl mb-4">{stay.title}</h1>
          <div className="flex flex-wrap items-center gap-5 font-sans text-sm text-white/60">
            <span className="flex items-center gap-1.5"><MapPin size={14} />{stay.location}</span>
            {stay.rating && (
              <span className="flex items-center gap-1.5">
                <Star size={14} className="text-[#C9A96E] fill-[#C9A96E]" />
                <span className="text-white">{stay.rating}</span>
                <span>({stay.review_count} reviews)</span>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Photo gallery */}
      <div className="grid grid-cols-4 grid-rows-2 h-[52vh] min-h-[340px] gap-px">
        <div className="col-span-2 row-span-2 overflow-hidden">
          <img src={stay.images[0]} alt={stay.title} className="w-full h-full object-cover" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="overflow-hidden bg-[#2d6a4f]/10">
            {stay.images[i] ? (
              <img src={stay.images[i]} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-sans text-xs text-gray-400">Photo {i + 1}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Highlights strip */}
      {stay.highlights?.length > 0 && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-5 flex flex-wrap gap-6">
            {stay.highlights.map((h: string) => (
              <div key={h} className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-[#C9A96E] shrink-0" />
                <span className="font-sans text-sm text-gray-700">{h}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Main content */}
          <div className="lg:col-span-2 space-y-14">

            {/* About */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">About this Stay</h2>
              <p className="font-sans text-gray-700 leading-relaxed">{stay.description}</p>
              {stay.checkIn && (
                <div className="mt-4 flex gap-6 font-sans text-sm text-gray-500">
                  <span>Check-in: <strong>{stay.checkIn}</strong></span>
                  <span>Check-out: <strong>{stay.checkOut}</strong></span>
                </div>
              )}
            </div>

            {/* Amenities */}
            {stay.amenities?.length > 0 && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-5">Amenities</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {stay.amenities.map((a: any) => {
                    const Icon = a.icon
                    return (
                      <div key={a.label} className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-3.5">
                        <Icon size={16} className="text-[#2d6a4f]" />
                        <span className="font-sans text-sm text-gray-700">{a.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Rooms */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display italic text-2xl text-[#000000]">Choose Your Room</h2>
                {stay.rooms.length > 0 && (
                  <button
                    onClick={() => setShowRooms(v => !v)}
                    className="lg:hidden font-sans text-sm border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2 hover:bg-[#2d6a4f] hover:text-white transition-colors"
                  >
                    {showRooms ? 'Hide Rooms' : `View Rooms (${stay.rooms.length})`}
                  </button>
                )}
              </div>
              {stay.rooms.length === 0 ? (
                <div className="bg-white border border-gray-200 p-8 text-center">
                  <BedDouble size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="font-sans text-sm text-gray-400">No rooms listed yet — contact the property directly.</p>
                </div>
              ) : (
                <div className={`space-y-4 ${!showRooms ? 'hidden lg:block' : ''}`}>
                  {stay.rooms.map((room: any) => (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={`bg-white border cursor-pointer transition-all ${selectedRoom?.id === room.id ? 'border-[#2d6a4f] shadow-sm' : 'border-gray-200 hover:border-gray-400'}`}
                    >
                      {selectedRoom?.id === room.id && (
                        <div className="bg-[#2d6a4f] px-5 py-1.5">
                          <span className="font-sans text-[10px] tracking-[0.12em] uppercase text-white">Selected</span>
                        </div>
                      )}
                      <div className="p-5 flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1.5">
                            <h3 className="font-display italic text-xl">{room.name}</h3>
                            <span className="flex items-center gap-1 font-sans text-xs text-gray-400">
                              <Users size={11} /> up to {room.max_guests}
                            </span>
                          </div>
                          <p className="font-sans text-sm text-gray-600 leading-relaxed mb-3">{room.description}</p>
                          {room.amenities?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {room.amenities.map((a: string) => (
                                <span key={a} className="bg-[#F7F5F2] px-2.5 py-1 font-sans text-xs text-gray-600">{a}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0 pl-4">
                          <p className="font-display italic text-2xl text-[#2d6a4f]">R {room.price_per_night.toLocaleString()}</p>
                          <p className="font-sans text-xs text-gray-400">/night</p>
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedRoom(room) }}
                            className={`mt-3 px-4 py-2 font-sans text-xs transition-colors ${selectedRoom?.id === room.id ? 'bg-[#2d6a4f] text-white' : 'border border-[#2d6a4f] text-[#2d6a4f] hover:bg-[#2d6a4f] hover:text-white'}`}
                          >
                            {selectedRoom?.id === room.id ? '✓ Selected' : 'Select'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews */}
            {stay.reviews_list?.length > 0 && (
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <h2 className="font-display italic text-2xl text-[#000000]">Guest Reviews</h2>
                  {stay.rating && (
                    <div className="flex items-center gap-1.5">
                      <Star size={16} className="text-[#C9A96E] fill-[#C9A96E]" />
                      <span className="font-display italic text-xl">{stay.rating}</span>
                      <span className="font-sans text-sm text-gray-400">({stay.review_count})</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stay.reviews_list.map((r: any, i: number) => (
                    <div key={i} className="bg-white border border-gray-200 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-sm shrink-0">
                            {r.name[0]}
                          </div>
                          <div>
                            <p className="font-sans text-sm font-medium leading-tight">{r.name}</p>
                            <p className="font-sans text-xs text-gray-400">{r.date}</p>
                          </div>
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          {Array.from({ length: r.rating }).map((_, j) => (
                            <Star key={j} size={11} className="text-[#C9A96E] fill-[#C9A96E]" />
                          ))}
                        </div>
                      </div>
                      <p className="font-sans text-sm text-gray-700 leading-relaxed">{r.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Provider */}
            <div className="bg-white border border-gray-200 p-6">
              <h3 className="font-display italic text-xl mb-4">About the Host</h3>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display italic text-2xl mb-1">{stay.title}</p>
                  <div className="flex gap-5 font-sans text-sm text-gray-500">
                    {stay.member_since && <span>Member since {stay.member_since}</span>}
                    {stay.response_rate && stay.response_rate !== '—' && <span>Response rate: {stay.response_rate}</span>}
                  </div>
                </div>
                <button className="shrink-0 border border-[#2d6a4f] text-[#2d6a4f] px-5 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
                  Contact Host
                </button>
              </div>
            </div>
          </div>

          {/* Booking sidebar */}
          <div>
            <div className="bg-white border border-gray-200 p-6 sticky top-24">
              <div className="mb-5">
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">From</p>
                <p className="font-display italic text-3xl text-[#2d6a4f]">
                  {stay.price_from > 0 ? `R ${stay.price_from.toLocaleString()}` : 'Contact for rates'}
                  {stay.price_from > 0 && <span className="font-sans text-sm text-gray-400">/night</span>}
                </p>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="block font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-1.5">Check-in</label>
                  <div className="flex items-center gap-2 border border-gray-300 px-3 py-2.5">
                    <Calendar size={14} className="text-gray-400 shrink-0" />
                    <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="flex-1 font-sans text-sm focus:outline-none bg-transparent" />
                  </div>
                </div>
                <div>
                  <label className="block font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-1.5">Check-out</label>
                  <div className="flex items-center gap-2 border border-gray-300 px-3 py-2.5">
                    <Calendar size={14} className="text-gray-400 shrink-0" />
                    <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="flex-1 font-sans text-sm focus:outline-none bg-transparent" />
                  </div>
                </div>
                <div>
                  <label className="block font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-1.5">Guests</label>
                  <select value={guests} onChange={e => setGuests(parseInt(e.target.value))} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none bg-white">
                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} guest{n !== 1 ? 's' : ''}</option>)}
                  </select>
                </div>
                {stay.rooms.length > 0 && (
                  <>
                    <div className={showRooms ? '' : 'hidden lg:block'}>
                      <label className="block font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-1.5">Room</label>
                      <select value={selectedRoom?.id || ''} onChange={e => setSelectedRoom(stay.rooms.find((r: any) => r.id === e.target.value) || null)} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none bg-white">
                        <option value="">Select a room…</option>
                        {stay.rooms.map((r: any) => <option key={r.id} value={r.id}>{r.name} — R {r.price_per_night.toLocaleString()}/night</option>)}
                      </select>
                    </div>
                    {!showRooms && (
                      <button
                        onClick={() => setShowRooms(true)}
                        className="lg:hidden w-full border border-[#2d6a4f] text-[#2d6a4f] py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
                      >
                        View Rooms ({stay.rooms.length})
                      </button>
                    )}
                  </>
                )}
              </div>

              {total && (
                <div className="border-t border-gray-100 pt-4 mb-5">
                  <div className="flex justify-between font-sans text-sm mb-1 text-gray-600">
                    <span>R {selectedRoom.price_per_night.toLocaleString()} × {nights} night{nights !== 1 ? 's' : ''}</span>
                    <span>R {total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-sans text-sm font-medium pt-3 mt-2 border-t border-gray-100">
                    <span>Total</span>
                    <span className="text-[#2d6a4f]">R {total.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (!selectedRoom) return
                  booking.setSearch(stay.region, checkIn, checkOut, guests)
                  booking.setStay({ id, title: stay.title, region: stay.region, price_per_night: selectedRoom.price_per_night, img: stay.images?.[0], address: stay.address, lat: stay.gpsLat, lng: stay.gpsLng })
                  router.push(`/search?region=${encodeURIComponent(stay.region)}&check_in=${checkIn}&check_out=${checkOut}&guests=${guests}`)
                }}
                className={`w-full py-3.5 font-sans text-sm font-medium transition-colors ${selectedRoom ? 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                {selectedRoom ? (isSelectedStay ? <span className="flex items-center justify-center gap-2"><Check size={14} /> Stay Selected — View Trip</span> : 'Select & Browse Activities') : 'Select a Room First'}
              </button>
              {isSelectedStay && (
                <button onClick={() => router.push('/checkout/shuttle')} className="w-full mt-2 py-3 font-sans text-sm border border-[#2d6a4f] text-[#2d6a4f] hover:bg-[#2d6a4f] hover:text-white transition-colors">
                  Proceed to Checkout →
                </button>
              )}
              <p className="font-sans text-xs text-center text-gray-400 mt-3">Free cancellation up to 48 hours before check-in</p>

              <div className="mt-6">
                <SmartRecommendations
                  region={stay.region}
                  excludeListingId={id}
                  originLocation={stay.address || stay.location}
                  originLat={stay.gpsLat}
                  originLng={stay.gpsLng}
                />
              </div>

              <div className="mt-5 border-t border-gray-100 pt-5">
                <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-1">Location</p>
                <p className="font-sans text-sm text-gray-700 mb-3">{stay.location}</p>
                <div className="bg-[#e8e4df] h-32 flex items-center justify-center">
                  <span className="font-sans text-xs text-gray-400">Map view</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

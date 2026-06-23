'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { MapPin, Star, Users, Wifi, Flame, Utensils, Car, ArrowLeft, Calendar } from 'lucide-react'

const STAYS: Record<string, any> = {
  s1: {
    title: 'Cathedral Peak Mountain Lodge', location: 'Cathedral Peak, Northern Berg', rating: 4.9, reviews: 142,
    description: 'Perched beneath the towering Cathedral Peak massif, this classic mountain lodge offers an authentic Drakensberg experience. The lodge has been a beloved fixture in the Northern Berg since 1939, offering warm hospitality, fine dining and uninterrupted access to the surrounding wilderness.',
    price_from: 1850,
    amenities: [
      { label: 'Free WiFi', icon: Wifi }, { label: 'Fireplace', icon: Flame }, { label: 'Restaurant', icon: Utensils }, { label: 'Parking', icon: Car },
    ],
    images: ['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1400&q=80', 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80', 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80'],
    rooms: [
      { id: 'r1', name: 'Mountain View Suite', description: 'Panoramic floor-to-ceiling views of the massif. King bed, en-suite bathroom with soaking tub.', max_guests: 2, price_per_night: 2200, amenities: ['En-suite', 'Soaking tub', 'Fireplace', 'Mountain view', 'King bed'] },
      { id: 'r2', name: 'Garden Chalet', description: 'Self-contained chalet set in the garden. Ideal for families with a private braai area.', max_guests: 4, price_per_night: 1850, amenities: ['Private braai', 'Kitchen', 'Family room', 'Garden access'] },
      { id: 'r3', name: 'Classic Double', description: 'Comfortable and cosy, with a private balcony overlooking the valley.', max_guests: 2, price_per_night: 1450, amenities: ['En-suite', 'Balcony', 'Double bed'] },
      { id: 'r4', name: 'Backpacker Dorm', description: 'Shared dormitory with 6 beds, lockers and access to communal kitchen.', max_guests: 6, price_per_night: 380, amenities: ['Shared bathroom', 'Lockers', 'Kitchen access', 'Bunk beds'] },
    ],
  },
}

const REVIEWS = [
  { name: 'Sarah van der Merwe', rating: 5, date: 'June 2026', comment: 'The location is simply breathtaking. Woke up every morning to mist rolling off the peaks. The staff are exceptional.' },
  { name: 'James Fourie', rating: 5, date: 'May 2026', comment: 'We have stayed here three times and it never disappoints. The Mountain View Suite is worth every cent.' },
  { name: 'Priya Naidoo', rating: 4, date: 'April 2026', comment: 'Beautiful setting, great food. The only minor issue was the WiFi being slow in our room, but that is hardly what you come here for!' },
  { name: 'Tom Kruger', rating: 5, date: 'March 2026', comment: 'Perfect base for day hikes. The lodge provided packed lunches and arranged permits. Could not have been smoother.' },
]

export default function StayDetailPage() {
  const { id } = useParams() as { id: string }
  const stay = STAYS[id] || STAYS['s1']

  const [selectedRoom, setSelectedRoom] = useState<any>(null)
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(2)

  const nights = checkIn && checkOut ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 1
  const total = selectedRoom ? selectedRoom.price_per_night * nights : null

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      {/* Gallery */}
      <div className="mt-16 grid grid-cols-3 grid-rows-2 h-[60vh] min-h-[400px] gap-1">
        <div className="col-span-2 row-span-2 overflow-hidden">
          <img src={stay.images[0]} alt={stay.title} className="w-full h-full object-cover" />
        </div>
        <div className="overflow-hidden">
          <img src={stay.images[1] || stay.images[0]} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="overflow-hidden">
          <img src={stay.images[2] || stay.images[0]} alt="" className="w-full h-full object-cover" />
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 font-sans text-xs text-gray-400 mb-6">
              <Link href="/stays" className="hover:text-[#2d6a4f] transition-colors">Stays</Link>
              <span>/</span>
              <span>{stay.title}</span>
            </div>

            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="font-display italic text-4xl text-[#000000] mb-2">{stay.title}</h1>
                <div className="flex items-center gap-4 font-sans text-sm text-gray-600">
                  <span className="flex items-center gap-1.5"><MapPin size={14} />{stay.location}</span>
                  <span className="flex items-center gap-1.5"><Star size={14} className="text-[#C9A96E] fill-[#C9A96E]" />{stay.rating} <span className="text-gray-400">({stay.reviews} reviews)</span></span>
                </div>
              </div>
            </div>

            <p className="font-sans text-gray-700 leading-relaxed mb-10">{stay.description}</p>

            {/* Amenities */}
            <div className="mb-12">
              <h2 className="font-display italic text-2xl text-[#000000] mb-5">Amenities</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stay.amenities.map((a: any) => {
                  const Icon = a.icon
                  return (
                    <div key={a.label} className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-3">
                      <Icon size={16} className="text-[#2d6a4f]" />
                      <span className="font-sans text-sm">{a.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rooms */}
            <div className="mb-12">
              <h2 className="font-display italic text-2xl text-[#000000] mb-5">Choose Your Room</h2>
              <div className="space-y-4">
                {stay.rooms.map((room: any) => (
                  <div
                    key={room.id}
                    className={`bg-white border cursor-pointer transition-colors ${selectedRoom?.id === room.id ? 'border-[#2d6a4f]' : 'border-gray-200 hover:border-gray-400'}`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <div className="p-5 flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-display italic text-xl">{room.name}</h3>
                          <span className="flex items-center gap-1 font-sans text-xs text-gray-500"><Users size={11} /> {room.max_guests} guests max</span>
                        </div>
                        <p className="font-sans text-sm text-gray-600 mb-3">{room.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {room.amenities.map((a: string) => <span key={a} className="bg-[#F7F5F2] px-2.5 py-1 font-sans text-xs text-gray-600">{a}</span>)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display italic text-2xl text-[#2d6a4f]">R {room.price_per_night.toLocaleString()}</p>
                        <p className="font-sans text-xs text-gray-400">/night</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedRoom(room) }}
                          className={`mt-3 px-4 py-2 font-sans text-xs transition-colors ${selectedRoom?.id === room.id ? 'bg-[#2d6a4f] text-white' : 'border border-[#2d6a4f] text-[#2d6a4f] hover:bg-[#2d6a4f] hover:text-white'}`}
                        >
                          {selectedRoom?.id === room.id ? 'Selected' : 'Select Room'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div>
              <div className="flex items-center gap-4 mb-6">
                <h2 className="font-display italic text-2xl text-[#000000]">Guest Reviews</h2>
                <div className="flex items-center gap-2">
                  <Star size={18} className="text-[#C9A96E] fill-[#C9A96E]" />
                  <span className="font-display italic text-xl">{stay.rating}</span>
                  <span className="font-sans text-sm text-gray-400">({stay.reviews})</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {REVIEWS.map((r, i) => (
                  <div key={i} className="bg-white border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-sm">{r.name[0]}</div>
                        <div>
                          <p className="font-sans text-sm font-medium">{r.name}</p>
                          <p className="font-sans text-xs text-gray-400">{r.date}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} size={11} className="text-[#C9A96E] fill-[#C9A96E]" />)}</div>
                    </div>
                    <p className="font-sans text-sm text-gray-700 leading-relaxed">{r.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Booking sidebar */}
          <div>
            <div className="bg-white border border-gray-200 p-6 sticky top-24">
              <div className="mb-4">
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">From</p>
                <p className="font-display italic text-3xl text-[#2d6a4f]">R {stay.price_from.toLocaleString()}<span className="font-sans text-sm text-gray-400">/night</span></p>
              </div>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Check-in</label>
                  <div className="flex items-center gap-2 border border-gray-300 px-3 py-2.5">
                    <Calendar size={14} className="text-gray-400" />
                    <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="flex-1 font-sans text-sm focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Check-out</label>
                  <div className="flex items-center gap-2 border border-gray-300 px-3 py-2.5">
                    <Calendar size={14} className="text-gray-400" />
                    <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="flex-1 font-sans text-sm focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Guests</label>
                  <select value={guests} onChange={e => setGuests(parseInt(e.target.value))} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none">
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} guest{n !== 1 ? 's' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Room</label>
                  <select value={selectedRoom?.id || ''} onChange={e => setSelectedRoom(stay.rooms.find((r: any) => r.id === e.target.value) || null)} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none">
                    <option value="">Select a room</option>
                    {stay.rooms.map((r: any) => <option key={r.id} value={r.id}>{r.name} — R {r.price_per_night.toLocaleString()}/night</option>)}
                  </select>
                </div>
              </div>

              {total && (
                <div className="border-t border-gray-100 pt-4 mb-4">
                  <div className="flex justify-between font-sans text-sm mb-1">
                    <span className="text-gray-600">R {selectedRoom.price_per_night.toLocaleString()} × {nights} night{nights !== 1 ? 's' : ''}</span>
                    <span>R {total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-sans text-sm font-medium mt-2 pt-2 border-t border-gray-100">
                    <span>Total</span>
                    <span className="text-[#2d6a4f]">R {total.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <button className="w-full bg-[#2d6a4f] text-white py-3.5 font-sans text-sm font-medium hover:bg-[#235a3f] transition-colors">
                {selectedRoom ? 'Book Now' : 'Select a Room to Book'}
              </button>

              <div className="mt-4 bg-[#F7F5F2] p-4">
                <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-1">Location</p>
                <p className="font-sans text-sm text-gray-700">{stay.location}</p>
                <div className="mt-3 bg-[#e8e4df] h-32 flex items-center justify-center">
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

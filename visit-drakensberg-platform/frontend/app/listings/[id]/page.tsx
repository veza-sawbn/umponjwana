'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, MapPin, Star, Wifi, Flame, Utensils, Car, Waves, Coffee, TreePine, ShieldCheck, Users, Calendar, Check, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, staggerChild, fadeUp, scaleFade, fade } from '@/lib/motion'

const ICON_MAP: Record<string, React.ElementType> = {
  'Free WiFi': Wifi,
  'Fireplace': Flame,
  'Restaurant': Utensils,
  'Parking': Car,
  'Breakfast': Coffee,
  'Pool': Waves,
  'Hiking Access': TreePine,
  'Braai Facilities': Flame,
  'Laundry': ShieldCheck,
  'Room Service': Utensils,
}

const LISTING = {
  id: 'cathedral-peak',
  title: 'Cathedral Peak Mountain Lodge',
  category: 'Mountain Lodge',
  location: 'Cathedral Peak, Northern Berg, KwaZulu-Natal',
  region: 'Northern Berg',
  price_per_night: 1850,
  rating: 4.9,
  review_count: 124,
  description: 'Nestled at the foot of the iconic Cathedral Peak, this luxury mountain lodge offers breathtaking views, world-class hospitality, and unrivalled access to the Drakensberg wilderness. Each suite is designed with natural materials that blend seamlessly into the landscape. Wake to birdsong, hike directly from your door, and return to a crackling fireplace.',
  highlights: ['Situated at 1,400m altitude', 'Direct trailhead access', 'Licensed restaurant & bar', 'Guided hikes on request'],
  amenities: ['Free WiFi', 'Fireplace', 'Restaurant', 'Parking', 'Breakfast', 'Pool', 'Hiking Access', 'Room Service'],
  images: [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80',
    'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80',
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80',
  ],
  host: {
    name: 'Thabo Mokoena',
    initials: 'TM',
    since: '2019',
    response_rate: '98%',
    response_time: 'within an hour',
  },
  rooms: [
    { id: 'r1', name: 'Mountain View Suite', description: 'Panoramic floor-to-ceiling views of the massif. King bed, en-suite with soaking tub.', max_guests: 2, price_per_night: 2200, amenities: ['En-suite', 'Soaking tub', 'Fireplace', 'King bed'] },
    { id: 'r2', name: 'Garden Chalet', description: 'Self-contained chalet set in the garden. Ideal for families with a private braai area.', max_guests: 4, price_per_night: 1850, amenities: ['Private braai', 'Kitchen', 'Family room'] },
    { id: 'r3', name: 'Classic Double', description: 'Comfortable and cosy, with a private balcony overlooking the valley.', max_guests: 2, price_per_night: 1450, amenities: ['En-suite', 'Balcony', 'Double bed'] },
    { id: 'r4', name: 'Backpacker Dorm', description: 'Shared dormitory with 6 beds, lockers and communal kitchen.', max_guests: 6, price_per_night: 380, amenities: ['Shared bathroom', 'Lockers', 'Kitchen access'] },
  ],
  reviews: [
    { name: 'Sarah van der Merwe', rating: 5, date: 'June 2026', comment: 'The location is simply breathtaking. Woke up every morning to mist rolling off the peaks. The staff are exceptional.' },
    { name: 'James Fourie', rating: 5, date: 'May 2026', comment: 'We have stayed here three times and it never disappoints. The Mountain View Suite is worth every cent.' },
    { name: 'Priya Naidoo', rating: 4, date: 'April 2026', comment: 'Beautiful setting, great food. The only minor issue was the WiFi being slow in our room, but that is hardly what you come here for!' },
    { name: 'Tom Kruger', rating: 5, date: 'March 2026', comment: 'Perfect base for day hikes. The lodge provided packed lunches and arranged permits. Could not have been smoother.' },
  ],
}

export default function ListingDetailPage() {
  const router = useRouter()
  const booking = useBooking()
  const [activeImg, setActiveImg] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [checkIn, setCheckIn] = useState(booking.checkIn || '')
  const [checkOut, setCheckOut] = useState(booking.checkOut || '')
  const [guests, setGuests] = useState(booking.guests || 2)
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)

  const listing = LISTING
  const isSelected = booking.stay?.id === listing.id

  const nights = (() => {
    if (!checkIn || !checkOut) return 0
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime()
    return Math.max(0, Math.round(diff / 86400000))
  })()

  const room = listing.rooms.find(r => r.id === selectedRoom)
  const pricePerNight = room?.price_per_night ?? listing.price_per_night
  const total = pricePerNight * (nights || 1)

  function handleSelect() {
    if (isSelected) {
      booking.setStay(null)
    } else {
      booking.setSearch(listing.region, checkIn, checkOut, guests)
      booking.setStay({ id: listing.id, title: listing.title, region: listing.region, price_per_night: pricePerNight })
      router.push('/search')
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      {/* Hero header */}
      <section className="bg-[#000000] text-white pt-32 pb-10 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 font-sans text-xs text-white/40 hover:text-white transition-colors mb-6">
            <ArrowLeft size={12} /> Back
          </button>
          <span className="inline-block font-sans text-[10px] tracking-[0.14em] uppercase bg-[#C9A96E]/20 text-[#C9A96E] px-3 py-1.5 mb-4">
            {listing.category}
          </span>
          <h1 className="font-display italic text-4xl lg:text-5xl mb-3">{listing.title}</h1>
          <div className="flex flex-wrap items-center gap-5 font-sans text-sm text-white/60">
            <span className="flex items-center gap-1.5"><MapPin size={13} />{listing.location}</span>
            <span className="flex items-center gap-1.5">
              <Star size={12} className="fill-[#C9A96E] text-[#C9A96E]" />
              {listing.rating} · {listing.review_count} reviews
            </span>
          </div>
        </div>
      </section>

      {/* Image gallery */}
      <div className="grid grid-cols-4 grid-rows-2 gap-0.5 h-[420px] lg:h-[520px] cursor-pointer" onClick={() => setLightbox(activeImg)}>
        <div className="col-span-2 row-span-2 relative overflow-hidden">
          <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" style={{ willChange: 'transform' }} />
        </div>
        {listing.images.slice(1, 5).map((img, i) => (
          <div key={i} className="relative overflow-hidden">
            <img src={img} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" style={{ willChange: 'transform' }} onClick={e => { e.stopPropagation(); setLightbox(i + 1) }} />
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={() => setLightbox(null)}
          >
            <button className="absolute top-5 right-5 text-white/60 hover:text-white transition-colors" onClick={() => setLightbox(null)}>
              <X size={22} />
            </button>
            <button className="absolute left-5 text-white/60 hover:text-white transition-colors" onClick={e => { e.stopPropagation(); setLightbox(l => l !== null ? (l - 1 + listing.images.length) % listing.images.length : 0) }}>
              <ChevronLeft size={32} />
            </button>
            <motion.img
              key={lightbox}
              src={listing.images[lightbox]}
              alt=""
              className="max-h-[90vh] max-w-[90vw] object-contain"
              variants={scaleFade}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={e => e.stopPropagation()}
            />
            <button className="absolute right-5 text-white/60 hover:text-white transition-colors" onClick={e => { e.stopPropagation(); setLightbox(l => l !== null ? (l + 1) % listing.images.length : 0) }}>
              <ChevronRight size={32} />
            </button>
            <div className="absolute bottom-5 flex gap-2">
              {listing.images.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setLightbox(i) }} className={`w-2 h-2 transition-colors ${i === lightbox ? 'bg-[#C9A96E]' : 'bg-white/30'}`} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Left: content */}
          <div className="lg:col-span-2 space-y-12">

            {/* Description + highlights */}
            <motion.div variants={staggerContainer(0.08)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
              <motion.h2 variants={fadeUp} className="font-display italic text-2xl text-[#000000] mb-4">About this property</motion.h2>
              <motion.p variants={fadeUp} className="font-sans text-gray-700 leading-relaxed mb-6">{listing.description}</motion.p>
              <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {listing.highlights.map(h => (
                  <div key={h} className="flex items-center gap-2.5 font-sans text-sm text-gray-700">
                    <Check size={13} className="text-[#2d6a4f] shrink-0" />
                    {h}
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Amenities */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-6">What's included</h2>
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-4 gap-4"
                variants={staggerContainer(0.05)}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
              >
                {listing.amenities.map(a => {
                  const Icon = ICON_MAP[a] ?? ShieldCheck
                  return (
                    <motion.div key={a} variants={staggerChild} className="flex items-center gap-2.5 bg-white border border-gray-100 px-4 py-3">
                      <Icon size={14} className="text-[#2d6a4f] shrink-0" />
                      <span className="font-sans text-sm text-gray-700">{a}</span>
                    </motion.div>
                  )
                })}
              </motion.div>
            </div>

            {/* Room types */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-2">Room types</h2>
              <p className="font-sans text-xs text-gray-400 mb-6">Select a room to update the price</p>
              <div className="space-y-4">
                {listing.rooms.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoom(selectedRoom === r.id ? null : r.id)}
                    className={`w-full text-left p-5 border transition-colors ${selectedRoom === r.id ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 bg-white hover:border-gray-400'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-5 h-5 border-2 shrink-0 mt-0.5 flex items-center justify-center ${selectedRoom === r.id ? 'border-[#2d6a4f] bg-[#2d6a4f]' : 'border-gray-300'}`}>
                          {selectedRoom === r.id && <Check size={11} className="text-white" />}
                        </div>
                        <div>
                          <p className="font-display italic text-lg mb-1">{r.name}</p>
                          <p className="font-sans text-sm text-gray-600 mb-3">{r.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {r.amenities.map(a => (
                              <span key={a} className="font-sans text-[10px] bg-[#F7F5F2] text-gray-500 px-2 py-0.5">{a}</span>
                            ))}
                            <span className="font-sans text-[10px] bg-[#F7F5F2] text-gray-500 px-2 py-0.5 flex items-center gap-1"><Users size={9} />Up to {r.max_guests}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display italic text-2xl text-[#2d6a4f]">R {r.price_per_night.toLocaleString()}</p>
                        <p className="font-sans text-[10px] text-gray-400">per night</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Host */}
            <div className="bg-white border border-gray-200 p-6">
              <h2 className="font-display italic text-2xl text-[#000000] mb-5">About the host</h2>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-xl shrink-0">
                    {listing.host.initials}
                  </div>
                  <div>
                    <p className="font-display italic text-xl mb-0.5">{listing.host.name}</p>
                    <p className="font-sans text-xs text-gray-400">Member since {listing.host.since}</p>
                    <div className="flex gap-4 mt-1.5 font-sans text-xs text-gray-500">
                      <span>Response rate: {listing.host.response_rate}</span>
                      <span>Responds {listing.host.response_time}</span>
                    </div>
                  </div>
                </div>
                <button className="border border-[#2d6a4f] text-[#2d6a4f] px-5 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
                  Contact Host
                </button>
              </div>
            </div>

            {/* Reviews */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="font-display italic text-2xl text-[#000000]">Guest Reviews</h2>
                <div className="flex items-center gap-1.5 font-sans text-sm text-gray-600">
                  <Star size={13} className="fill-[#C9A96E] text-[#C9A96E]" />
                  <span className="font-medium">{listing.rating}</span>
                  <span className="text-gray-400">· {listing.review_count} reviews</span>
                </div>
              </div>
              <motion.div
                className="space-y-4"
                variants={staggerContainer(0.07)}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
              >
                {listing.reviews.map((r, i) => (
                  <motion.div key={i} variants={staggerChild} className="bg-white border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-sm shrink-0">
                          {r.name[0]}
                        </div>
                        <div>
                          <p className="font-sans text-sm font-medium">{r.name}</p>
                          <p className="font-sans text-xs text-gray-400">{r.date}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star key={j} size={11} className={j < r.rating ? 'fill-[#C9A96E] text-[#C9A96E]' : 'text-gray-200'} />
                        ))}
                      </div>
                    </div>
                    <p className="font-sans text-sm text-gray-700 leading-relaxed">{r.comment}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>

          </div>

          {/* Right: booking sidebar */}
          <div>
            <div className="bg-white border border-gray-200 p-6 sticky top-24">
              <div className="mb-5">
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">From per night</p>
                <p className="font-display italic text-3xl text-[#2d6a4f]">
                  R {pricePerNight.toLocaleString()}
                </p>
                {selectedRoom && <p className="font-sans text-xs text-gray-400 mt-0.5">{room?.name}</p>}
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="block font-sans text-[10px] uppercase text-gray-400 mb-1.5">Check-in</label>
                  <div className="flex items-center gap-2 border border-gray-300 px-3 py-2.5">
                    <Calendar size={13} className="text-gray-400 shrink-0" />
                    <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="flex-1 font-sans text-sm focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block font-sans text-[10px] uppercase text-gray-400 mb-1.5">Check-out</label>
                  <div className="flex items-center gap-2 border border-gray-300 px-3 py-2.5">
                    <Calendar size={13} className="text-gray-400 shrink-0" />
                    <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="flex-1 font-sans text-sm focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block font-sans text-[10px] uppercase text-gray-400 mb-1.5">Guests</label>
                  <select value={guests} onChange={e => setGuests(parseInt(e.target.value))} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none">
                    {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} guest{n !== 1 ? 's' : ''}</option>)}
                  </select>
                </div>
              </div>

              {nights > 0 && (
                <div className="border-t border-gray-100 pt-4 mb-5 font-sans text-sm space-y-1.5">
                  <div className="flex justify-between text-gray-600">
                    <span>R {pricePerNight.toLocaleString()} × {nights} night{nights !== 1 ? 's' : ''}</span>
                    <span>R {total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-medium pt-2 border-t border-gray-100 mt-2">
                    <span>Total</span>
                    <span className="text-[#2d6a4f]">R {total.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <motion.button
                onClick={handleSelect}
                className={`w-full py-3.5 font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  isSelected
                    ? 'bg-[#2d6a4f] text-white hover:bg-red-600'
                    : 'bg-[#C9A96E] hover:bg-[#b8935e] text-[#1a1a1a]'
                }`}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.1 }}
              >
                {isSelected ? <><Check size={14} /> Selected — Browse Activities</> : <><Plus size={14} /> Select & Browse Activities</>}
              </motion.button>

              {booking.hasActiveSearch && isSelected && (
                <button
                  onClick={() => router.push('/checkout/shuttle')}
                  className="w-full mt-2 py-3 font-sans text-sm font-medium border border-[#2d6a4f] text-[#2d6a4f] hover:bg-[#2d6a4f] hover:text-white transition-colors"
                >
                  Proceed to Checkout →
                </button>
              )}

              <p className="font-sans text-xs text-center text-gray-400 mt-3">Free cancellation up to 48 hours before check-in</p>

              <div className="mt-5 pt-5 border-t border-gray-100 flex items-start gap-2">
                <ShieldCheck size={13} className="text-[#2d6a4f] shrink-0 mt-0.5" />
                <p className="font-sans text-xs text-gray-500 leading-relaxed">
                  Booking protected — full refund if the supplier cancels
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

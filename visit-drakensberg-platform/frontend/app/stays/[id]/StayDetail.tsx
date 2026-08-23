'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import { MapPin, Star, Users, Wifi, Flame, Utensils, Car, ArrowLeft, Calendar, Waves, TreePine, ShieldCheck, BedDouble } from 'lucide-react'
import SmartRecommendations from '@/components/booking/SmartRecommendations'
import RoomDetailModal, { type RoomDetail } from '@/components/listings/RoomDetailModal'
import { useBooking } from '@/lib/booking-context'
import { Check } from 'lucide-react'
import type { Property } from '@/lib/properties'
import { getRoomUnitsLeft, type Room } from '@/lib/rooms'

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
    rooms: rooms.filter(r => r.status === 'active').map(r => ({
      id: r.id,
      name: r.name,
      description: [r.bedConfig, r.enSuite ? 'En-suite' : '', r.sizeSqm ? `${r.sizeSqm}m²` : ''].filter(Boolean).join(' · '),
      max_guests: r.maxOccupancy,
      price_per_night: r.basePrice,
      amenities: [...(r.features ?? []), ...(r.inclusions ?? [])],
      images: r.images ?? [],
      units: r.units,
      minNights: r.minNights,
      cleaningFee: r.cleaningFee,
    })),
    reviews_list: [] as any[],
  }
}

/**
 * Client island rendered inside the server shell (page.tsx), which already
 * resolved `property` + `rooms` for generateMetadata/JSON-LD and 404s
 * server-side if the id doesn't exist. Everything below — date/guest
 * selection, live room-inventory checking, the booking-cart flow, the room
 * detail modal — stays client-side; only the base property + room catalog
 * lookup moved server-side. See docs/destination-graph/PHASE_B.md.
 */
export default function StayDetail({ property, rooms: roomsData, id }: { property: Property; rooms: Room[]; id: string }) {
  const router = useRouter()
  const booking = useBooking()

  const stay = propToStay(property, roomsData)

  const [selectedRoom, setSelectedRoom] = useState<any>(null)
  const [showRooms, setShowRooms] = useState(false)
  const [roomImage, setRoomImage] = useState<string | null>(null)
  const [detailRoom, setDetailRoom] = useState<RoomDetail | null>(null)
  const [checkIn, setCheckIn] = useState(booking.checkIn || '')
  const [checkOut, setCheckOut] = useState(booking.checkOut || '')
  const [guests, setGuests] = useState(booking.guests || 2)
  // roomId -> units still free for the chosen dates (null = unknown)
  const [unitsLeft, setUnitsLeft] = useState<Record<string, number | null>>({})

  // Live room inventory for the selected dates.
  useEffect(() => {
    if (!stay.rooms.length || !checkIn || !checkOut || checkOut <= checkIn) {
      setUnitsLeft({})
      return
    }
    let cancelled = false
    Promise.all(
      stay.rooms.map(async (r: any) => [r.id, await getRoomUnitsLeft(r.id, checkIn, checkOut)] as const)
    ).then(entries => {
      if (!cancelled) setUnitsLeft(Object.fromEntries(entries))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, checkIn, checkOut])

  const soldOut = (roomId: string) => unitsLeft[roomId] === 0
  // Deselect a room that sells out while chosen dates change
  useEffect(() => {
    if (selectedRoom && soldOut(selectedRoom.id)) setSelectedRoom(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitsLeft])

  const isSelectedStay = booking.stay?.id === id
  const nights = checkIn && checkOut
    ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
    : 1
  const total = selectedRoom ? selectedRoom.price_per_night * nights : null

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

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
                      onClick={() => { if (!soldOut(room.id)) setSelectedRoom(room) }}
                      className={`bg-white border transition-all ${soldOut(room.id) ? 'border-gray-200 opacity-60 cursor-not-allowed' : selectedRoom?.id === room.id ? 'border-[#2d6a4f] shadow-sm cursor-pointer' : 'border-gray-200 hover:border-gray-400 cursor-pointer'}`}
                    >
                      {selectedRoom?.id === room.id && (
                        <div className="bg-[#2d6a4f] px-5 py-1.5">
                          <span className="font-sans text-[10px] tracking-[0.12em] uppercase text-white">Selected</span>
                        </div>
                      )}
                      <div className="p-5 flex items-start justify-between gap-4">
                        {room.images?.length > 0 && (
                          <div className="hidden sm:block w-40 shrink-0">
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setDetailRoom(room) }}
                              className="block w-full aspect-[4/3] overflow-hidden bg-gray-100"
                            >
                              <img src={room.images[0]} alt={room.name} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                            </button>
                            {room.images.length > 1 && (
                              <div className="grid grid-cols-3 gap-1 mt-1">
                                {room.images.slice(1, 4).map((url: string, i: number) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={e => { e.stopPropagation(); setDetailRoom(room) }}
                                    className="relative aspect-square overflow-hidden bg-gray-100"
                                  >
                                    <img src={url} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                                    {i === 2 && room.images.length > 4 && (
                                      <span className="absolute inset-0 bg-black/50 flex items-center justify-center font-sans text-[10px] text-white">
                                        +{room.images.length - 4}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                            <h3 className="font-display italic text-xl">{room.name}</h3>
                            <span className="flex items-center gap-1 font-sans text-xs text-gray-400">
                              <Users size={11} /> up to {room.max_guests}
                            </span>
                            {soldOut(room.id) && (
                              <span className="font-sans text-[10px] tracking-[0.1em] uppercase bg-red-50 text-red-500 px-2 py-0.5">
                                Sold out for these dates
                              </span>
                            )}
                            {!soldOut(room.id) && typeof unitsLeft[room.id] === 'number' && (unitsLeft[room.id] as number) <= 3 && (
                              <span className="font-sans text-[10px] tracking-[0.1em] uppercase bg-[#C9A96E]/15 text-[#8B6914] px-2 py-0.5">
                                Only {unitsLeft[room.id]} left
                              </span>
                            )}
                          </div>
                          <p className="font-sans text-sm text-gray-600 leading-relaxed mb-2">{room.description}</p>
                          {(room.units > 0 || room.minNights > 1 || room.cleaningFee > 0) && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 font-sans text-xs text-gray-400">
                              {room.units > 0 && <span>{room.units} unit{room.units !== 1 ? 's' : ''}</span>}
                              {room.minNights > 1 && <span>Min {room.minNights} nights</span>}
                              {room.cleaningFee > 0 && <span>R{room.cleaningFee} cleaning fee</span>}
                            </div>
                          )}
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
                            onClick={e => { e.stopPropagation(); setDetailRoom(room) }}
                            className="mt-3 block w-full px-4 py-2 font-sans text-xs text-gray-500 border border-gray-200 hover:border-gray-400 hover:text-gray-700 transition-colors"
                          >
                            View Details
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); if (!soldOut(room.id)) setSelectedRoom(room) }}
                            disabled={soldOut(room.id)}
                            className={`mt-3 px-4 py-2 font-sans text-xs transition-colors ${soldOut(room.id) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : selectedRoom?.id === room.id ? 'bg-[#2d6a4f] text-white' : 'border border-[#2d6a4f] text-[#2d6a4f] hover:bg-[#2d6a4f] hover:text-white'}`}
                          >
                            {soldOut(room.id) ? 'Sold out' : selectedRoom?.id === room.id ? '✓ Selected' : 'Select'}
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
                  booking.setStay({ id, title: stay.title, region: stay.region, price_per_night: selectedRoom.price_per_night, roomId: selectedRoom.id, roomName: selectedRoom.name, img: stay.images?.[0], address: stay.address, lat: stay.gpsLat, lng: stay.gpsLng })
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
                  checkIn={checkIn}
                  checkOut={checkOut}
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

      {/* Room detail modal */}
      {detailRoom && (
        <RoomDetailModal
          room={detailRoom}
          soldOut={soldOut(detailRoom.id)}
          unitsLeft={unitsLeft[detailRoom.id] ?? null}
          selected={selectedRoom?.id === detailRoom.id}
          onSelect={() => setSelectedRoom(stay.rooms.find((r: any) => r.id === detailRoom.id) ?? null)}
          onClose={() => setDetailRoom(null)}
          onZoom={url => setRoomImage(url)}
        />
      )}

      {/* Room image lightbox (zoom layer above the detail modal) */}
      {roomImage && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center" onClick={() => setRoomImage(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white font-sans text-2xl leading-none" onClick={() => setRoomImage(null)}>
            ×
          </button>
          <img src={roomImage} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <Footer />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Clock, Users, Star, CheckCircle, Calendar, MapPin } from 'lucide-react'
import UpcomingDepartures from '@/components/tours/UpcomingDepartures'
import { getTourDates } from '@/lib/tour-dates'
import { useBooking } from '@/lib/booking-context'
import { Check, Plus } from 'lucide-react'

const ACTIVITIES: Record<string, any> = {
  a1: {
    title: 'Guided Rock Climbing Experience', category: 'Adventure', location: 'Amphitheatre, Royal Natal', duration: 'Full day (6–8 hrs)', group_size: '2–8 people', price_per_person: 750,
    description: 'Experience the dramatic basalt cliffs of the Drakensberg under the expert supervision of FGASA-certified climbing guides. Routes range from introductory single-pitch climbs to challenging multi-pitch ascents on classic Drakensberg routes. All equipment is provided; no prior experience is necessary for beginner routes.',
    includes: ['All climbing equipment', 'Harness and helmet', 'Instruction and safety briefing', 'Packed lunch', 'Transport from meeting point', 'FGASA-certified guide'],
    what_to_bring: ['Comfortable athletic clothing', 'Closed-toe shoes', '1.5L water', 'Sunscreen and hat', 'Camera'],
    images: ['bg-[#1a1a2e]', 'bg-[#2d6a4f]', 'bg-[#8B4513]'],
    guides: [
      { id: 'g1', full_name: 'Sipho Dlamini', specialties: ['Rock climbing', 'Abseiling'], languages: ['English', 'Zulu'], initials: 'SD' },
      { id: 'g5', full_name: 'Bongani Khumalo', specialties: ['Rock climbing', 'Mountain biking'], languages: ['English', 'Zulu'], initials: 'BK' },
    ],
    supplier: { name: 'Drakensberg Adventures', member_since: '2020', response_rate: '98%' },
  },
  a2: {
    title: 'San Rock Art Full-Day Tour', category: 'Culture & Heritage', location: "Giant's Castle", duration: 'Full day', group_size: '2–15 people', price_per_person: 620,
    description: 'Explore the finest San Bushman rock art sites in the Drakensberg with a qualified heritage guide. Over 5,000 individual images have been documented at the Giant\'s Castle Main Caves alone, making this one of the most significant rock art sites in southern Africa.',
    includes: ['Heritage guide fee', 'Park entry permit', 'Light lunch', 'Information booklet'],
    what_to_bring: ['Comfortable walking shoes', '2L water', 'Hat and sunscreen', 'Notebook'],
    images: ['bg-[#8B4513]', 'bg-[#C9A96E]/60', 'bg-[#1a1a2e]'],
    guides: [
      { id: 'g4', full_name: 'Lerato Sithole', specialties: ['San rock art', 'Heritage tours'], languages: ['English', 'Sotho', 'Zulu'], initials: 'LS' },
    ],
    supplier: { name: 'Berg Cultural Tours', member_since: '2021', response_rate: '95%' },
  },
}

const REVIEWS = [
  { name: 'Mark D.', rating: 5, date: 'June 2026', comment: 'Absolutely world-class experience. Our guide was safety-focused, encouraging and deeply knowledgeable. Reached the top of our first multi-pitch climb!' },
  { name: 'Lindiwe K.', rating: 5, date: 'May 2026', comment: 'Booked for my partner\'s birthday. Neither of us had climbed before — our guide was patient and made us feel completely safe throughout.' },
  { name: 'Tom B.', rating: 4, date: 'April 2026', comment: 'Great day out. The views from the top of the climb were incredible. Recommend bringing your own snacks in addition to the provided lunch.' },
]

export default function ActivityDetailPage() {
  const { id } = useParams() as { id: string }
  const activity = ACTIVITIES[id] || ACTIVITIES['a1']
  const booking = useBooking()

  const [date, setDate] = useState(booking.checkIn || '')
  const [groupSize, setGroupSize] = useState(booking.guests || 2)
  const total = activity.price_per_person * groupSize

  const addonId = `activity-${id}-${date}`
  const isAdded = booking.addons.some(a => a.id === addonId)

  function toggleAddon() {
    if (isAdded) {
      booking.removeAddon(addonId)
    } else {
      booking.addAddon({
        id: addonId,
        type: 'activity',
        title: activity.title,
        date: date || undefined,
        price_per_person: activity.price_per_person,
        guests: groupSize,
      })
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#000000] text-white py-20 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/activities" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={16} /> All Activities
          </Link>
          <span className="inline-block font-sans text-[10px] tracking-[0.14em] uppercase bg-[#C9A96E]/20 text-[#C9A96E] px-3 py-1.5 mb-4">{activity.category}</span>
          <h1 className="font-display italic text-5xl lg:text-6xl mb-4">{activity.title}</h1>
          <div className="flex flex-wrap gap-5 font-sans text-sm text-white/60">
            <span className="flex items-center gap-1.5"><MapPin size={14} />{activity.location}</span>
            <span className="flex items-center gap-1.5"><Clock size={14} />{activity.duration}</span>
            <span className="flex items-center gap-1.5"><Users size={14} />{activity.group_size}</span>
          </div>
        </div>
      </section>

      {/* Image gallery */}
      <div className="grid grid-cols-3 gap-1 h-64">
        <div className={`col-span-1 ${activity.images[0]}`} />
        <div className={`col-span-1 ${activity.images[1]}`} />
        <div className={`col-span-1 ${activity.images[2]}`} />
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">About this Experience</h2>
              <p className="font-sans text-gray-700 leading-relaxed">{activity.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-display italic text-xl text-[#000000] mb-4">What's Included</h3>
                <div className="space-y-2">
                  {activity.includes.map((item: string) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <CheckCircle size={14} className="text-[#2d6a4f] mt-0.5 shrink-0" />
                      <span className="font-sans text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-display italic text-xl text-[#000000] mb-4">What to Bring</h3>
                <div className="space-y-2">
                  {activity.what_to_bring.map((item: string) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <span className="text-[#C9A96E] mt-0.5 shrink-0 text-sm">→</span>
                      <span className="font-sans text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Upcoming departures */}
            <UpcomingDepartures
              dates={getTourDates(id)}
              context="Scheduled departures, packages and experiences for this activity"
            />

            {/* Guides */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-6">Your Instructors & Guides</h2>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {activity.guides.map((guide: any) => (
                  <div key={guide.id} className="bg-white border border-gray-200 p-5 min-w-[220px]">
                    <div className="w-12 h-12 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-xl mb-3">{guide.initials}</div>
                    <h3 className="font-display italic text-lg mb-1">{guide.full_name}</h3>
                    <p className="font-sans text-xs text-gray-500 mb-2">{guide.specialties.join(' · ')}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {guide.languages.map((l: string) => <span key={l} className="bg-[#F7F5F2] px-2 py-0.5 font-sans text-xs">{l}</span>)}
                    </div>
                    <Link href={`/guides/${guide.id}`} className="font-sans text-xs text-[#2d6a4f] hover:underline">View profile →</Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-5">Guest Reviews</h2>
              <div className="space-y-4">
                {REVIEWS.map((r, i) => (
                  <div key={i} className="bg-white border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-sm">{r.name[0]}</div>
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

            {/* Provider */}
            <div className="bg-white border border-gray-200 p-6">
              <h3 className="font-display italic text-xl mb-4">About the Provider</h3>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display italic text-2xl mb-1">{activity.supplier.name}</p>
                  <div className="flex gap-4 font-sans text-sm text-gray-500">
                    <span>Member since {activity.supplier.member_since}</span>
                    <span>Response rate: {activity.supplier.response_rate}</span>
                  </div>
                </div>
                <button className="border border-[#2d6a4f] text-[#2d6a4f] px-5 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
                  Contact Supplier
                </button>
              </div>
            </div>
          </div>

          {/* Booking sidebar */}
          <div>
            <div className="bg-white border border-gray-200 p-6 sticky top-24">
              <div className="mb-5">
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Per person</p>
                <p className="font-display italic text-3xl text-[#2d6a4f]">R {activity.price_per_person.toLocaleString()}</p>
              </div>
              <div className="space-y-4 mb-5">
                <div>
                  <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Select Date</label>
                  <div className="flex items-center gap-2 border border-gray-300 px-3 py-2.5">
                    <Calendar size={14} className="text-gray-400" />
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 font-sans text-sm focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Group Size</label>
                  <select value={groupSize} onChange={e => setGroupSize(parseInt(e.target.value))} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none">
                    {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} person{n !== 1 ? 's' : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mb-5">
                <div className="flex justify-between font-sans text-sm mb-1">
                  <span className="text-gray-600">R {activity.price_per_person.toLocaleString()} × {groupSize}</span>
                  <span>R {total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-sans text-sm font-medium pt-2 border-t border-gray-100 mt-2">
                  <span>Total</span>
                  <span className="text-[#2d6a4f]">R {total.toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={toggleAddon}
                className={`w-full py-3.5 font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  isAdded
                    ? 'bg-[#2d6a4f] text-white hover:bg-red-600'
                    : 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'
                }`}
              >
                {isAdded ? <><Check size={14} /> Added to Booking</> : <><Plus size={14} /> Add to Booking</>}
              </button>
              {booking.hasActiveSearch && (
                <p className="font-sans text-xs text-center text-[#2d6a4f] mt-2">
                  {isAdded ? 'Saved to your trip — continue exploring' : 'Add to your trip and keep browsing'}
                </p>
              )}
              <p className="font-sans text-xs text-center text-gray-400 mt-2">Free cancellation up to 48 hours before</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

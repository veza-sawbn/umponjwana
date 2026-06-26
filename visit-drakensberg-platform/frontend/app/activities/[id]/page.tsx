'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Clock, Users, Star, CheckCircle, Calendar, MapPin } from 'lucide-react'
import UpcomingDepartures from '@/components/tours/UpcomingDepartures'
import { getTourDates } from '@/lib/tour-dates'
import { useBooking } from '@/lib/booking-context'
import { Check, Plus } from 'lucide-react'
import { getActivityById } from '@/lib/activities'

const MOCK_ACTIVITIES: Record<string, any> = {
  a1: {
    title: 'San Rock Art Tour', category: 'Cultural', location: "Giants Castle", duration: '3 h', group_size: '2–15 people', price_per_person: 380,
    description: 'Explore the finest San Bushman rock art sites in the Drakensberg with a qualified heritage guide. Over 5,000 individual images have been documented at the Giant\'s Castle Main Caves alone, making this one of the most significant rock art sites in southern Africa.',
    includes: ['Heritage guide fee', 'Park entry permit', 'Light lunch', 'Information booklet'],
    what_to_bring: ['Comfortable walking shoes', '2L water', 'Hat and sunscreen', 'Notebook'],
    images: ['bg-[#8B4513]', 'bg-[#C9A96E]/60', 'bg-[#1a1a2e]'],
    guides: [
      { id: 'g4', full_name: 'Lerato Sithole', specialties: ['San rock art', 'Heritage tours'], languages: ['English', 'Sotho', 'Zulu'], initials: 'LS' },
    ],
    supplier: { name: 'Berg Cultural Tours', member_since: '2021', response_rate: '95%' },
  },
  a2: {
    title: 'Abseiling at the Amphitheatre', category: 'Adventure', location: 'Royal Natal', duration: '4 h', group_size: '2–8 people', price_per_person: 650,
    description: 'Experience the dramatic basalt cliffs of the Drakensberg under the expert supervision of FGASA-certified guides. Routes range from introductory abseils to challenging multi-pitch descents on classic Drakensberg routes. All equipment is provided; no prior experience is necessary for beginner routes.',
    includes: ['All abseiling equipment', 'Harness and helmet', 'Instruction and safety briefing', 'Packed lunch', 'Transport from meeting point', 'FGASA-certified guide'],
    what_to_bring: ['Comfortable athletic clothing', 'Closed-toe shoes', '1.5L water', 'Sunscreen and hat', 'Camera'],
    images: ['bg-[#1a1a2e]', 'bg-[#2d6a4f]', 'bg-[#8B4513]'],
    guides: [
      { id: 'g1', full_name: 'Sipho Dlamini', specialties: ['Rock climbing', 'Abseiling'], languages: ['English', 'Zulu'], initials: 'SD' },
      { id: 'g5', full_name: 'Bongani Khumalo', specialties: ['Rock climbing', 'Mountain biking'], languages: ['English', 'Zulu'], initials: 'BK' },
    ],
    supplier: { name: 'Drakensberg Adventures', member_since: '2020', response_rate: '98%' },
  },
  a3: {
    title: 'Bearded Vulture Hide', category: 'Wildlife', location: "Giant's Castle Game Reserve", duration: '3 h', group_size: '2–8 people', price_per_person: 290,
    description: 'Sit in a purpose-built hide and observe the rare bearded vulture (lammergeier) at close range as supplementary feeding takes place. Giant\'s Castle hosts one of the highest densities of bearded vultures in southern Africa, and the hide gives an unparalleled viewing experience.',
    includes: ['Hide entry fee', 'Park permit', 'Guided briefing', 'Bird identification sheet'],
    what_to_bring: ['Binoculars', 'Camera with zoom lens', 'Warm layers', '1L water', 'Snacks'],
    images: ['bg-[#2d6a4f]', 'bg-[#8B4513]', 'bg-[#1a1a2e]'],
    guides: [],
    supplier: { name: 'Berg Wildlife Experiences', member_since: '2019', response_rate: '97%' },
  },
  a4: {
    title: 'Fly-Fishing — Trout in the Berg', category: 'Adventure', location: 'Champagne Valley', duration: 'Full day', group_size: '1–4 people', price_per_person: 1200,
    description: 'Cast for wild and stocked rainbow and brown trout in the crystal-clear streams and dams of Champagne Valley. Our qualified fishing guides provide all tackle and instruction — suitable for beginners and experienced anglers alike.',
    includes: ['All tackle and equipment', 'Fishing licence', 'Professional guide', 'Packed lunch', 'Transport on the estate'],
    what_to_bring: ['Polarised sunglasses', 'Comfortable wading shoes', 'Sunscreen', 'Rain jacket'],
    images: ['bg-[#1a1a2e]', 'bg-[#2d6a4f]', 'bg-[#C9A96E]/60'],
    guides: [],
    supplier: { name: 'Champagne Fly-Fishing', member_since: '2018', response_rate: '100%' },
  },
  a5: {
    title: 'Sani Pass 4×4 Day Tour', category: 'Adventure', location: 'Sani Pass', duration: 'Full day', group_size: '2–10 people', price_per_person: 950,
    description: 'Traverse one of South Africa\'s most dramatic mountain passes in a purpose-built 4×4 vehicle. The route climbs from KwaZulu-Natal into the Lesotho highlands, passing through spectacular alpine scenery, and tops out at the highest pub in Africa.',
    includes: ['4×4 vehicle and driver', 'Border crossing assistance', 'Lunch at top', 'Return transport'],
    what_to_bring: ['Passport or ID', 'Warm jacket', 'Camera', 'Sunscreen'],
    images: ['bg-[#8B4513]', 'bg-[#1a1a2e]', 'bg-[#2d6a4f]'],
    guides: [],
    supplier: { name: 'Sani Pass Tours', member_since: '2017', response_rate: '99%' },
  },
  a6: {
    title: 'Horse Riding in the Foothills', category: 'Family', location: 'Central Berg', duration: '2 h', group_size: '2–12 people', price_per_person: 480,
    description: 'Ride through the rolling foothills of the central Drakensberg on well-schooled horses. Suitable for all levels from complete beginners to experienced riders, with routes tailored to the group\'s ability and the day\'s conditions.',
    includes: ['Horse and tack', 'Riding helmet', 'Guide on horseback', 'Safety briefing'],
    what_to_bring: ['Closed-toe shoes', 'Long trousers', 'Sunscreen', 'Water bottle'],
    images: ['bg-[#C9A96E]/60', 'bg-[#2d6a4f]', 'bg-[#8B4513]'],
    guides: [],
    supplier: { name: 'Berg Horse Trails', member_since: '2020', response_rate: '96%' },
  },
  a7: {
    title: 'Sunrise Yoga & Meditation', category: 'Wellness', location: 'Champagne Valley', duration: '2 h', group_size: '2–15 people', price_per_person: 220,
    description: 'Begin your day with a guided yoga and meditation session on an open-air deck overlooking the amphitheatre. Sessions are led by certified instructors and are suitable for all levels. The mountain backdrop and fresh mountain air make for a truly restorative experience.',
    includes: ['Yoga mat and props', 'Certified instructor', 'Herbal tea afterwards'],
    what_to_bring: ['Comfortable clothing', 'Light warm layer', 'Water bottle'],
    images: ['bg-[#2d6a4f]', 'bg-[#C9A96E]/60', 'bg-[#1a1a2e]'],
    guides: [],
    supplier: { name: 'Berg Wellness Retreats', member_since: '2022', response_rate: '94%' },
  },
  a8: {
    title: 'Stargazing Experience', category: 'Family', location: 'Northern Berg', duration: '2.5 h', group_size: '2–20 people', price_per_person: 300,
    description: 'The Drakensberg\'s high altitude and minimal light pollution make it one of the finest stargazing destinations in southern Africa. Our astronomers guide you through the southern sky using high-powered telescopes, laser pointers, and engaging storytelling rooted in both science and San mythology.',
    includes: ['Telescope viewing', 'Astronomer guide', 'Star chart', 'Hot chocolate'],
    what_to_bring: ['Warm jacket', 'Beanie and gloves', 'Red-light torch (optional)'],
    images: ['bg-[#1a1a2e]', 'bg-[#2d6a4f]', 'bg-[#8B4513]'],
    guides: [],
    supplier: { name: 'Berg Stargazing Co.', member_since: '2021', response_rate: '98%' },
  },
}

const REVIEWS = [
  { name: 'Mark D.', rating: 5, date: 'June 2026', comment: 'Absolutely world-class experience. Our guide was safety-focused, encouraging and deeply knowledgeable. Reached the top of our first multi-pitch climb!' },
  { name: 'Lindiwe K.', rating: 5, date: 'May 2026', comment: 'Booked for my partner\'s birthday. Neither of us had climbed before — our guide was patient and made us feel completely safe throughout.' },
  { name: 'Tom B.', rating: 4, date: 'April 2026', comment: 'Great day out. The views from the top of the climb were incredible. Recommend bringing your own snacks in addition to the provided lunch.' },
]

function mapActivityToView(a: any) {
  const durationParts = []
  if (a.durationH) durationParts.push(`${a.durationH}h`)
  if (a.durationM) durationParts.push(`${a.durationM}min`)
  const duration = durationParts.length ? durationParts.join(' ') : 'See details'
  const whatToWear = a.whatToWear
    ? a.whatToWear.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean)
    : []
  return {
    title: a.name,
    category: a.category,
    location: a.meetingPoint || '',
    duration,
    group_size: a.maxGroup ? `Up to ${a.maxGroup} people` : '',
    price_per_person: a.pricePerPerson || 0,
    description: a.description,
    includes: Array.isArray(a.included) ? a.included : [],
    what_to_bring: whatToWear,
    images: ['bg-[#1a1a2e]', 'bg-[#2d6a4f]', 'bg-[#8B4513]'],
    guides: [],
    supplier: { name: a.supplierName || '', member_since: '', response_rate: '' },
  }
}

export default function ActivityDetailPage() {
  const { id } = useParams() as { id: string }
  const [activity, setActivity] = useState<any>(MOCK_ACTIVITIES[id] || null)
  const [loading, setLoading] = useState(!MOCK_ACTIVITIES[id])
  const booking = useBooking()

  useEffect(() => {
    if (MOCK_ACTIVITIES[id]) return
    getActivityById(id)
      .then(data => {
        if (data) setActivity(mapActivityToView(data))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const [date, setDate] = useState(booking.checkIn || '')
  const [groupSize, setGroupSize] = useState(booking.guests || 2)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="font-sans text-gray-500">Loading activity…</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="font-display italic text-2xl text-gray-700">Activity not found</p>
          <Link href="/activities" className="font-sans text-sm text-[#2d6a4f] hover:underline">← Back to Activities</Link>
        </div>
        <Footer />
      </div>
    )
  }

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

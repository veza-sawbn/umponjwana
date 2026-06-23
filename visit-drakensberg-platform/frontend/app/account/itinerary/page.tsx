'use client'

import Link from 'next/link'
import { MapPin, Calendar, Clock, Phone, Mail, Download, ArrowRight } from 'lucide-react'

const ITINERARY = {
  ref: 'DBK-7394-KZN',
  listing: 'Cathedral Peak Mountain Lodge',
  location: 'Cathedral Peak, Northern Berg',
  checkIn: 'Thursday, 15 July 2026',
  checkOut: 'Sunday, 18 July 2026',
  nights: 3,
  guests: 2,
  room: 'Luxury Cottage',
  supplierName: 'Cathedral Peak Lodge',
  supplierPhone: '+27 36 488 1888',
  supplierEmail: 'bookings@cathedralpeaklodge.co.za',
  checkInTime: '14:00',
  checkOutTime: '10:00',
  activities: [
    { date: 'Friday, 16 July 2026', time: '06:00', title: 'Cathedral Peak Summit Hike', location: 'Cathedral Peak Trailhead', type: 'Hike', duration: '8–10 hrs', notes: 'Pack warm layers and start water. Guide meets at the trailhead.' },
    { date: 'Saturday, 17 July 2026', time: '09:00', title: 'San Rock Art Full-Day Tour', location: "Giant's Castle Main Caves", type: 'Experience', duration: '6 hrs', notes: 'Ezemvelo-certified guide included. Drive 45 min from lodge.' },
    { date: 'Saturday, 17 July 2026', time: '17:30', title: 'Bearded Vulture Hide', location: "Giant's Castle Lammergeier Hide", type: 'Wildlife', duration: '2 hrs', notes: 'Pre-book at the rest camp. Bring binoculars.' },
  ],
}

const TYPE_COLOR: Record<string, string> = {
  Hike: 'text-[#2d6a4f] bg-[#2d6a4f]/10',
  Experience: 'text-[#C9A96E] bg-[#C9A96E]/10',
  Wildlife: 'text-blue-600 bg-blue-50',
}

export default function ItineraryPage() {
  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display italic text-3xl text-[#000000]">Your Itinerary</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">Ref: {ITINERARY.ref}</p>
        </div>
        <button className="flex items-center gap-2 border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
          <Download size={13} />
          Download PDF
        </button>
      </div>

      {/* Accommodation card */}
      <div className="bg-[#000000] text-white p-6 mb-8">
        <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] block mb-3">Accommodation</span>
        <h2 className="font-display italic text-3xl mb-1">{ITINERARY.listing}</h2>
        <p className="font-sans text-xs text-white/40 flex items-center gap-1 mb-6">
          <MapPin size={10} />{ITINERARY.location}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Check-in', value: ITINERARY.checkIn, sub: `From ${ITINERARY.checkInTime}` },
            { label: 'Check-out', value: ITINERARY.checkOut, sub: `By ${ITINERARY.checkOutTime}` },
            { label: 'Duration', value: `${ITINERARY.nights} nights`, sub: `${ITINERARY.guests} guests` },
            { label: 'Room', value: ITINERARY.room, sub: 'Self-catering' },
          ].map(item => (
            <div key={item.label} className="border border-white/10 p-3">
              <p className="font-sans text-[10px] uppercase tracking-wider text-white/40 mb-1">{item.label}</p>
              <p className="font-sans text-sm text-white font-medium">{item.value}</p>
              <p className="font-sans text-xs text-white/40">{item.sub}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-5">
          <p className="font-sans text-[10px] uppercase tracking-wider text-white/40 mb-3">Supplier Contact</p>
          <div className="flex flex-wrap gap-5">
            <div className="flex items-center gap-2 text-white/60">
              <Phone size={12} />
              <span className="font-sans text-sm">{ITINERARY.supplierPhone}</span>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <Mail size={12} />
              <span className="font-sans text-sm">{ITINERARY.supplierEmail}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily schedule */}
      <div className="mb-8">
        <h2 className="font-display italic text-2xl text-[#000000] mb-6">Activities & Experiences</h2>

        {/* Group by date */}
        {['Friday, 16 July 2026', 'Saturday, 17 July 2026'].map(date => {
          const dayItems = ITINERARY.activities.filter(a => a.date === date)
          return (
            <div key={date} className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <Calendar size={14} className="text-[#C9A96E]" />
                <h3 className="font-display italic text-xl text-[#000000]">{date}</h3>
              </div>
              <div className="space-y-3 ml-6">
                {dayItems.map((item, i) => (
                  <div key={i} className="bg-white border border-gray-200 p-5 flex gap-4">
                    <div className="text-right shrink-0 w-14">
                      <p className="font-display italic text-lg text-[#2d6a4f]">{item.time}</p>
                    </div>
                    <div className="w-px bg-gray-200 self-stretch mx-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="font-display italic text-lg text-[#000000]">{item.title}</h4>
                        <span className={`shrink-0 font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 ${TYPE_COLOR[item.type] || 'text-gray-500 bg-gray-100'}`}>{item.type}</span>
                      </div>
                      <p className="font-sans text-xs text-gray-500 flex items-center gap-1 mb-2">
                        <MapPin size={9} />{item.location}
                      </p>
                      <p className="font-sans text-xs text-gray-400 flex items-center gap-1 mb-3">
                        <Clock size={9} />Duration: {item.duration}
                      </p>
                      {item.notes && (
                        <p className="font-sans text-xs text-gray-500 italic border-l-2 border-[#C9A96E] pl-3 leading-relaxed">{item.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Departure day */}
      <div className="bg-white border border-gray-200 p-5 mb-8">
        <div className="flex items-center gap-3">
          <Calendar size={14} className="text-[#C9A96E]" />
          <h3 className="font-display italic text-xl text-[#000000]">Sunday, 18 July 2026 — Departure</h3>
        </div>
        <p className="font-sans text-sm text-gray-500 ml-9 mt-2">Check out by 10:00. Please return keys to reception and ensure the property is left in good order.</p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/account" className="group bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors p-4 flex items-center justify-between">
          <span className="font-sans text-sm text-gray-700">All Bookings</span>
          <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
        </Link>
        <Link href="/hikes" className="group bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors p-4 flex items-center justify-between">
          <span className="font-sans text-sm text-gray-700">Explore More Hikes</span>
          <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
        </Link>
        <Link href="/account/saved" className="group bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors p-4 flex items-center justify-between">
          <span className="font-sans text-sm text-gray-700">Saved Listings</span>
          <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
        </Link>
      </div>
    </div>
  )
}

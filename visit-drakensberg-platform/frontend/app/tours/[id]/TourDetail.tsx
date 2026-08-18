'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import {
  ArrowLeft, Mountain, Clock, Users, CheckCircle, Calendar, Shield, Star,
} from 'lucide-react'
import { getDepartures, type Departure } from '@/lib/departures'
import type { Tour } from '@/lib/tours'
import type { NearbyStayResult } from '@/lib/modules'
import NearbyStaysModule from '@/components/modules/NearbyStaysModule'

const DIFF_COLOR: Record<string, string> = { Easy: '#4A7251', Moderate: '#C9A96E', Strenuous: '#c0392b', Extreme: '#7f1d1d' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Client island rendered inside the server shell (page.tsx), which already
 * resolved `tour` (and `nearbyStays`, the automatic-mode module content —
 * see lib/modules.ts) for generateMetadata/JSON-LD and 404s server-side if
 * the id doesn't exist. Upcoming departures are fetched here — dated,
 * time-sensitive booking data, unlike the tour itself, which is evergreen.
 * A departure expiring never affects this page (the point of separating
 * Tours from Departures — see docs/destination-graph/PHASE_A.md "Tours").
 * `nearbyStays` is server-fetched data passed as a prop, not a client
 * fetch, so it renders in the initial server HTML exactly like `tour`
 * itself does — see docs/destination-graph/PHASE_C.md.
 */
export default function TourDetail({ tour, nearbyStays }: { tour: Tour; nearbyStays: NearbyStayResult[] }) {
  const [departures, setDepartures] = useState<Departure[]>([])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    getDepartures().then(all =>
      setDepartures(all.filter(d => d.tourId === tour.id && d.date >= today && d.status !== 'full').sort((a, b) => a.date.localeCompare(b.date)))
    )
  }, [tour.id])

  const diff = tour.difficulty
  const diffColor = DIFF_COLOR[diff] || '#2d6a4f'

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <section className="bg-[#2d6a4f] text-white py-20 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/tours" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={16} /> All Tours
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">
                {tour.trailName || 'Drakensberg'}{tour.days ? ` · ${tour.days} day${tour.days !== 1 ? 's' : ''}` : ''}
              </p>
              <h1 className="font-display italic text-5xl lg:text-6xl mb-4">{tour.name}</h1>
              <div className="flex items-center gap-4 font-sans text-sm text-white/70 flex-wrap">
                <span>{tour.supplierName}</span>
                {tour.rating ? (
                  <span className="flex items-center gap-1"><Star size={13} className="text-[#C9A96E] fill-[#C9A96E]" /> {tour.rating} <span className="text-white/40">({tour.reviewCount} reviews)</span></span>
                ) : null}
              </div>
            </div>
            <span className="font-sans text-sm px-4 py-2 mt-2" style={{ color: diffColor, background: diffColor + '22' }}>
              {diff}
            </span>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Clock, label: 'Duration', value: `${tour.days} day${tour.days !== 1 ? 's' : ''}` },
            { icon: Users, label: 'Max Group', value: `${tour.maxGroup}` },
            { icon: Mountain, label: 'Difficulty', value: tour.difficulty },
            { icon: Calendar, label: 'Upcoming Departures', value: `${departures.length}` },
          ].map(stat => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="flex items-center gap-3">
                <Icon size={20} className="text-[#C9A96E]" />
                <div>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{stat.label}</p>
                  <p className="font-display italic text-xl">{stat.value}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">About this Tour</h2>
              <p className="font-sans text-gray-700 leading-relaxed">{tour.description}</p>
            </div>

            {tour.included?.length > 0 && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">What's Included</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {tour.included.map(item => (
                    <div key={item} className="flex items-start gap-2.5 bg-white border border-gray-200 px-4 py-3">
                      <CheckCircle size={14} className="text-[#2d6a4f] mt-0.5 shrink-0" />
                      <span className="font-sans text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tour.fitnessNotes && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Fitness Requirements</h2>
                <p className="font-sans text-sm text-gray-700 leading-relaxed bg-white border border-gray-200 p-5">{tour.fitnessNotes}</p>
              </div>
            )}

            {tour.trailId && (
              <div className="bg-white border border-gray-200 p-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Hiking Trail</p>
                  <h2 className="font-display italic text-xl text-[#000000]">{tour.trailName || 'View the trail'}</h2>
                  <p className="font-sans text-sm text-gray-500 mt-1">Route maps, elevation, permits and safety information live on the trail page.</p>
                </div>
                <Link href={`/hikes/${tour.trailId}`} className="shrink-0 border border-[#2d6a4f] text-[#2d6a4f] px-5 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
                  <Mountain size={13} className="inline mr-1.5 -mt-0.5" />View Trail Details →
                </Link>
              </div>
            )}

            {/* Upcoming departures — dated, temporal, doesn't affect this evergreen page */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">Upcoming Departures</h2>
              {departures.length > 0 ? (
                <div className="space-y-3">
                  {departures.slice(0, 8).map(d => (
                    <Link key={d.id} href={`/experiences/${d.id}`} className="block bg-white border border-gray-200 p-4 hover:border-[#2d6a4f] transition-colors">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="font-display italic text-lg">{formatDate(d.date)}</p>
                          <p className="font-sans text-xs text-gray-500">{d.guide ? `Guide: ${d.guide} · ` : ''}{d.maxSeats - d.bookedSeats} of {d.maxSeats} spaces left</p>
                        </div>
                        <p className="font-display italic text-lg text-[#2d6a4f] shrink-0">R {d.pricePerPerson.toLocaleString()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="font-sans text-sm text-gray-500 bg-white border border-gray-200 p-5">
                  No scheduled departures right now — request custom dates and the operator will check availability.
                </p>
              )}
            </div>

            <NearbyStaysModule stays={nearbyStays} title="Places to Stay Nearby" />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 p-6 sticky top-24">
              <div className="mb-5">
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">From</p>
                <p className="font-display italic text-3xl text-[#2d6a4f]">R {tour.pricePerPerson.toLocaleString()}<span className="font-sans text-sm text-gray-400"> pp</span></p>
                {!!tour.groupDiscount && tour.groupDiscount > 0 && (
                  <p className="font-sans text-xs text-gray-400 mt-1">{tour.groupDiscount}% off for groups</p>
                )}
              </div>
              {departures.length > 0 ? (
                <Link href={`/experiences/${departures[0].id}`} className="block text-center bg-[#C9A96E] text-[#2d2d2d] py-3 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors">
                  Book Next Departure →
                </Link>
              ) : null}
              <Link
                href={`/experiences/request?trail=${encodeURIComponent(tour.trailId || '')}`}
                className="mt-3 block text-center border border-[#2d6a4f] text-[#2d6a4f] py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
              >
                Book on Custom Dates
              </Link>
              {tour.cancellation && (
                <p className="font-sans text-xs text-center text-gray-400 mt-3 flex items-center justify-center gap-1">
                  <Shield size={11} /> {tour.cancellation}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

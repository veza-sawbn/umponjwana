'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Mountain, Clock, TrendingUp, Users, Star, CheckCircle, ChevronRight, X } from 'lucide-react'
import { getTrails, Trail, DEFAULT_TRAILS } from '@/lib/trails'
import UpcomingDepartures from '@/components/tours/UpcomingDepartures'
import { getDepartures } from '@/lib/departures'
import { getTours } from '@/lib/tours'
import type { TourDate } from '@/components/tours/UpcomingDepartures'

const DIFF_COLOR: Record<string, string> = { Easy: '#4A7251', Moderate: '#C9A96E', Hard: '#c0392b', Strenuous: '#c0392b' }
const DIFF_BG: Record<string, string> = { Easy: '#4A725122', Moderate: '#C9A96E22', Hard: '#c0392b22', Strenuous: '#c0392b22' }

const TRAIL_COLOR: Record<string, string> = {
  Easy: 'bg-[#4A7251]',
  Moderate: 'bg-[#2d6a4f]',
  Strenuous: 'bg-[#1a1a2e]',
  Hard: 'bg-[#1a1a2e]',
}


export default function HikeDetailPage() {
  const { id } = useParams() as { id: string }
  const [trail, setTrail] = useState<Trail | null>(null)
  const [allTrails, setAllTrails] = useState<Trail[]>([])
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const [departures, setDepartures] = useState<TourDate[]>([])

  useEffect(() => {
    getTrails().then(trails => {
      setAllTrails(trails)
      const found = trails.find(t => t.id === id)
      setTrail(found || trails[0])
    })
    Promise.all([getDepartures(), getTours()]).then(([all, tours]) => {
      const activeTourIds = new Set(tours.filter(t => t.status === 'active').map(t => t.id))
      const today = new Date().toISOString().slice(0, 10)
      const tourDates: TourDate[] = all
        .filter(d => d.trailId === id && d.date >= today && d.status !== 'full' && activeTourIds.has(d.tourId))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({
          id: d.id,
          date: d.date,
          type: 'guide' as const,
          operator: d.supplierName || d.tour,
          tourName: d.tour,
          guide: d.guide || undefined,
          spots_total: d.maxSeats,
          spots_remaining: d.maxSeats - d.bookedSeats,
          price_per_person: d.pricePerPerson,
          duration: `${d.tourDays ?? 1} day${(d.tourDays ?? 1) > 1 ? 's' : ''}`,
          tourDays: d.tourDays ?? 1,
        }))
      setDepartures(tourDates)
    })
  }, [id])

  if (!trail) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <Navbar />
        <div className="flex items-center justify-center h-96 mt-16">
          <div className="animate-pulse space-y-4 w-full max-w-2xl px-6">
            <div className="h-10 bg-gray-200 w-2/3" />
            <div className="h-4 bg-gray-200 w-full" />
            <div className="h-4 bg-gray-200 w-4/5" />
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  const diff = trail.difficulty
  const headerBg = TRAIL_COLOR[diff] || 'bg-[#2d6a4f]'
  const related = allTrails.filter(t => t.id !== trail.id && t.status === 'published').slice(0, 2)

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      {/* Hero header */}
      <section className={`${headerBg} text-white py-20 px-6 lg:px-12 mt-16 relative overflow-hidden`}>
        {trail.image && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${trail.image})` }}
          />
        )}
        <div className="max-w-[1440px] mx-auto relative">
          <Link href="/hikes" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={16} /> All Trails
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">{trail.region}</p>
              <h1 className="font-display italic text-5xl lg:text-6xl mb-4">{trail.name}</h1>
              <p className="font-sans text-sm text-white/60">Starting point: {trail.trailhead}</p>
            </div>
            <span className="font-sans text-sm px-4 py-2 mt-2" style={{ color: DIFF_COLOR[diff], background: DIFF_BG[diff] }}>
              {diff}
            </span>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Mountain, label: 'Distance', value: trail.distance },
            { icon: TrendingUp, label: 'Elevation Gain', value: trail.elevation },
            { icon: Clock, label: 'Duration', value: trail.duration },
            { icon: Users, label: 'Difficulty', value: trail.difficulty },
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

            {/* Description */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">About this Trail</h2>
              <p className="font-sans text-gray-700 leading-relaxed">{trail.description}</p>
            </div>

            {/* Upcoming departures */}
            <UpcomingDepartures
              dates={departures}
              context="Guided departures and experiences on this trail"
              trailRegion={trail.region}
            />

            {/* Multi-day breakdown */}
            {trail.is_multi_day && trail.days.length > 0 && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Daily Breakdown</h2>
                <div className="space-y-3">
                  {trail.days.map((day, i) => (
                    <div key={i} className="bg-white border border-gray-200 p-5">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-[#C9A96E] mb-1">Day {i + 1}</p>
                          <h3 className="font-display italic text-lg">{day.label}</h3>
                        </div>
                        <span className="font-sans text-xs px-3 py-1 shrink-0 mt-1" style={{ color: DIFF_COLOR[day.difficulty], background: DIFF_BG[day.difficulty] }}>
                          {day.difficulty}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-6 mb-3">
                        <div>
                          <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Distance</p>
                          <p className="font-display italic text-base">{day.distance || '—'}</p>
                        </div>
                        <div>
                          <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Elevation Gain</p>
                          <p className="font-display italic text-base">{day.elevation || '—'}</p>
                        </div>
                      </div>
                      {day.notes && (
                        <p className="font-sans text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">{day.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Elevation Profile (single-day only) */}
            {!trail.is_multi_day && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Elevation Profile</h2>
                <div className="bg-white border border-gray-200 p-4">
                  <svg viewBox="0 0 400 120" className="w-full h-32" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2d6a4f" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#2d6a4f" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    <polyline fill="url(#elevGrad)" stroke="#2d6a4f" strokeWidth="2"
                      points="0,110 40,100 80,80 120,60 160,35 200,20 240,15 280,25 320,50 360,80 400,110 400,120 0,120" />
                  </svg>
                  <div className="flex justify-between font-sans text-xs text-gray-400 mt-1">
                    <span>Start · {trail.trailhead}</span>
                    <span>Summit</span>
                    <span>Return</span>
                  </div>
                </div>
              </div>
            )}

            {/* Gallery */}
            {(trail.gallery.length > 0 || trail.image) && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Gallery</h2>
                <div className="grid grid-cols-3 gap-2">
                  {/* Hero image as first gallery cell if no dedicated gallery */}
                  {trail.gallery.length === 0 && trail.image && (
                    <div
                      className="aspect-[4/3] bg-cover bg-center cursor-pointer col-span-3"
                      style={{ backgroundImage: `url(${trail.image})` }}
                      onClick={() => setLightboxImg(trail.image)}
                    />
                  )}
                  {trail.gallery.map((url, i) => (
                    <div
                      key={i}
                      className={`aspect-[4/3] bg-cover bg-center cursor-pointer hover:opacity-90 transition-opacity ${i === 0 && trail.gallery.length >= 3 ? 'col-span-2 row-span-2' : ''}`}
                      style={{ backgroundImage: `url(${url})` }}
                      onClick={() => setLightboxImg(url)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* What to bring */}
            {trail.what_to_bring.length > 0 && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">What to Bring</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {trail.what_to_bring.map((item: string) => (
                    <div key={item} className="flex items-start gap-2.5 bg-white border border-gray-200 px-4 py-3">
                      <CheckCircle size={14} className="text-[#2d6a4f] mt-0.5 shrink-0" />
                      <span className="font-sans text-sm text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guides CTA */}
            <div className="bg-white border border-gray-200 p-6 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-display italic text-xl text-[#000000] mb-1">Looking for a guide?</h2>
                <p className="font-sans text-sm text-gray-500">Browse certified local guides who lead experiences on this trail.</p>
              </div>
              <Link href="/guides" className="shrink-0 border border-[#2d6a4f] text-[#2d6a4f] px-5 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
                Find a Guide →
              </Link>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-[#2d6a4f] text-white p-6">
              <h3 className="font-display italic text-xl mb-3">Book a Guided Experience</h3>
              <p className="font-sans text-sm text-white/70 mb-5">A certified guide transforms this trail. Includes permit, safety equipment and deep local knowledge.</p>
              <Link href="/guides" className="block text-center bg-[#C9A96E] text-[#2d2d2d] py-3 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors">
                Find a Guide →
              </Link>
            </div>

            <div className="bg-white border border-gray-200 p-5">
              <h3 className="font-display italic text-xl mb-4">Trail Info</h3>
              <div className="space-y-3 font-sans text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Region</span><span className="text-right ml-4">{trail.region}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Distance</span><span>{trail.distance}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Elevation</span><span>{trail.elevation}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Duration</span><span>{trail.duration}</span></div>
                {trail.is_multi_day && (
                  <div className="flex justify-between"><span className="text-gray-400">Days</span><span>{trail.days.length}</span></div>
                )}
                <div className="flex justify-between items-center"><span className="text-gray-400">Difficulty</span>
                  <span className="px-2.5 py-1 text-xs" style={{ color: DIFF_COLOR[diff], background: DIFF_BG[diff] }}>{diff}</span>
                </div>
                {trail.permit_required && (
                  <div className="flex justify-between"><span className="text-gray-400">Permit</span><span>R{trail.permit_cost} pp</span></div>
                )}
              </div>
            </div>

            {related.length > 0 && (
              <div>
                <h3 className="font-display italic text-xl text-[#000000] mb-4">Related Trails</h3>
                {related.map(r => (
                  <Link key={r.id} href={`/hikes/${r.id}`} className="block bg-white border border-gray-200 p-4 mb-3 hover:border-[#2d6a4f] transition-colors">
                    <p className="font-display italic text-lg mb-1">{r.name}</p>
                    <div className="flex items-center gap-3 font-sans text-xs text-gray-500">
                      <span>{r.distance}</span>
                      <span className="px-2 py-0.5" style={{ color: DIFF_COLOR[r.difficulty], background: DIFF_BG[r.difficulty] }}>{r.difficulty}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setLightboxImg(null)}>
            <X size={24} />
          </button>
          <img src={lightboxImg} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <Footer />
    </div>
  )
}

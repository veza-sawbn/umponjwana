'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import {
  ArrowLeft, Calendar, Clock, Users, MapPin, Star, CheckCircle, Award,
  UserCircle, Mountain, Shield, Plus, Minus, Check, GitCompareArrows,
} from 'lucide-react'
import { getExperienceById, getExperiencesByTrail, type TrekkingExperience } from '@/lib/experiences'
import { useBooking } from '@/lib/booking-context'

// Dedicated commercial booking page for one supplier departure. The hiking
// trail page (/hikes/[id]) stays informational; this is where the experience
// is actually bought.

const DIFF_COLOR: Record<string, string> = {
  Easy: '#4A7251', Moderate: '#C9A96E', Challenging: '#c0392b', Extreme: '#8e44ad', Strenuous: '#c0392b',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function addDays(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function ExperiencePage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const booking = useBooking()
  const [exp, setExp] = useState<TrekkingExperience | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [siblings, setSiblings] = useState<TrekkingExperience[]>([])
  const [guests, setGuests] = useState(1)

  useEffect(() => {
    getExperienceById(id).then(async e => {
      setExp(e)
      setLoaded(true)
      if (e) {
        const same = await getExperiencesByTrail(e.trailId)
        setSiblings(same.filter(s => s.id !== e.id))
      }
    })
  }, [id])

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
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

  if (!exp) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <div className="flex flex-col items-center justify-center h-96 mt-16 text-center px-6">
          <Mountain size={32} className="text-gray-300 mb-4" />
          <h1 className="font-display italic text-3xl mb-2">Experience not found</h1>
          <p className="font-sans text-sm text-gray-500 mb-6">This departure may have been removed or already completed.</p>
          <Link href="/hikes" className="border border-[#2d6a4f] text-[#2d6a4f] px-6 py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
            Browse Hiking Trails
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  const full = exp.spacesAvailable === 0
  const isAdded = booking.addons.some(a => a.id === exp.id)
  const clampedGuests = Math.min(guests, Math.max(1, exp.spacesAvailable))

  function handleBook() {
    if (!exp || full || isAdded) return
    booking.setSearch(
      exp.region || booking.region,
      addDays(exp.departureDate, -1),
      addDays(exp.departureDate, exp.durationDays),
      clampedGuests,
    )
    booking.addAddon({
      id: exp.id,
      type: 'hike',
      title: `${exp.title} — ${exp.operator}${exp.leadGuide ? ` · ${exp.leadGuide}` : ''}`,
      supplierId: exp.operatorId,
      date: exp.departureDate,
      price_per_person: exp.pricePerPerson,
      guests: clampedGuests,
    })
    router.push('/trip')
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      {/* Hero */}
      <section className="bg-[#2d6a4f] text-white py-20 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href={`/hikes/${exp.trailId}`} className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={16} /> {exp.trailName || 'Back to Trail'}
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E]">Trekking Experience{exp.region ? ` · ${exp.region}` : ''}</p>
                {exp.featured && (
                  <span className="inline-flex items-center gap-1 font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 bg-[#C9A96E] text-[#2d2d2d]">
                    <Award size={10} /> Featured
                  </span>
                )}
              </div>
              <h1 className="font-display italic text-5xl lg:text-6xl mb-4">{exp.title}</h1>
              <div className="flex items-center gap-4 font-sans text-sm text-white/70 flex-wrap">
                <span>{exp.operator}</span>
                {exp.leadGuide && <span className="flex items-center gap-1.5"><UserCircle size={14} /> Lead Guide: {exp.leadGuide}</span>}
                {exp.rating !== null ? (
                  <span className="flex items-center gap-1">
                    <Star size={13} className="text-[#C9A96E] fill-[#C9A96E]" /> {exp.rating.toFixed(1)}
                    <span className="text-white/40">({exp.reviewCount} reviews)</span>
                  </span>
                ) : (
                  <span className="text-white/40">New listing</span>
                )}
              </div>
            </div>
            <span className="font-sans text-sm px-4 py-2 mt-2" style={{ color: DIFF_COLOR[exp.difficulty] || '#C9A96E', background: (DIFF_COLOR[exp.difficulty] || '#C9A96E') + '22' }}>
              {exp.difficulty}
            </span>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Calendar, label: 'Departure', value: new Date(exp.departureDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) },
            { icon: Calendar, label: 'Return', value: new Date(exp.returnDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) },
            { icon: Clock, label: 'Duration', value: `${exp.durationDays} day${exp.durationDays !== 1 ? 's' : ''}` },
            { icon: Users, label: 'Available Spaces', value: full ? 'Fully booked' : `${exp.spacesAvailable} of ${exp.spacesTotal}` },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <div key={i} className="flex items-center gap-3">
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
            {/* About */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">About this Experience</h2>
              <p className="font-sans text-gray-700 leading-relaxed">{exp.description}</p>
            </div>

            {/* Included services */}
            {exp.includedServices.length > 0 && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Included Services</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {exp.includedServices.map(s => (
                    <div key={s} className="flex items-start gap-2.5 bg-white border border-gray-200 px-4 py-3">
                      <CheckCircle size={14} className="text-[#2d6a4f] mt-0.5 shrink-0" />
                      <span className="font-sans text-sm text-gray-700">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fitness */}
            {exp.fitnessNotes && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Fitness Requirements</h2>
                <p className="font-sans text-sm text-gray-700 leading-relaxed bg-white border border-gray-200 p-5">{exp.fitnessNotes}</p>
              </div>
            )}

            {/* The trail this runs on */}
            <div className="bg-white border border-gray-200 p-6 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Hiking Trail</p>
                <h2 className="font-display italic text-xl text-[#000000]">{exp.trailName || 'View the trail'}</h2>
                <p className="font-sans text-sm text-gray-500 mt-1">Route maps, elevation, permits and safety information live on the trail page.</p>
              </div>
              <Link href={`/hikes/${exp.trailId}`} className="shrink-0 border border-[#2d6a4f] text-[#2d6a4f] px-5 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
                <Mountain size={13} className="inline mr-1.5 -mt-0.5" />View Trail Details →
              </Link>
            </div>

            {/* Other departures on this trail */}
            {siblings.length > 0 && (
              <div>
                <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
                  <h2 className="font-display italic text-2xl text-[#000000]">Other Departures on this Trail</h2>
                  <Link
                    href={`/experiences/compare?trail=${encodeURIComponent(exp.trailId)}&ids=${[exp.id, ...siblings.map(s => s.id)].slice(0, 4).join(',')}`}
                    className="inline-flex items-center gap-2 font-sans text-sm border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2 hover:bg-[#2d6a4f] hover:text-white transition-colors"
                  >
                    <GitCompareArrows size={14} /> Compare Experiences
                  </Link>
                </div>
                <div className="space-y-3">
                  {siblings.slice(0, 4).map(s => (
                    <Link key={s.id} href={`/experiences/${s.id}`} className="block bg-white border border-gray-200 p-4 hover:border-[#2d6a4f] transition-colors">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="font-display italic text-lg">{s.title}</p>
                          <p className="font-sans text-xs text-gray-500">{s.operator} · {formatDate(s.departureDate)} · {s.durationDays} day{s.durationDays !== 1 ? 's' : ''}</p>
                        </div>
                        <p className="font-display italic text-lg text-[#2d6a4f] shrink-0">R {s.pricePerPerson.toLocaleString()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Booking sidebar */}
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 p-6">
              <div className="flex items-baseline justify-between mb-1">
                <p className="font-display italic text-3xl text-[#2d6a4f]">R {exp.pricePerPerson.toLocaleString()}</p>
                <p className="font-sans text-xs text-gray-400">per person</p>
              </div>
              <p className={`font-sans text-xs mb-5 ${full ? 'text-gray-400' : exp.spacesAvailable <= 2 ? 'text-red-600' : 'text-[#2d6a4f]'}`}>
                <Users size={11} className="inline mr-1 -mt-0.5" />
                {full ? 'Fully booked' : `${exp.spacesAvailable} of ${exp.spacesTotal} spaces available`}
              </p>

              {!full && !isAdded && (
                <div className="flex items-center justify-between mb-4">
                  <span className="font-sans text-sm text-gray-600">Guests</span>
                  <div className="flex items-center border border-gray-200">
                    <button
                      onClick={() => setGuests(g => Math.max(1, g - 1))}
                      disabled={clampedGuests <= 1}
                      className="px-3 py-2 text-gray-500 hover:text-black disabled:opacity-30"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="font-sans text-sm px-3 min-w-[32px] text-center">{clampedGuests}</span>
                    <button
                      onClick={() => setGuests(g => Math.min(exp.spacesAvailable, g + 1))}
                      disabled={clampedGuests >= exp.spacesAvailable}
                      className="px-3 py-2 text-gray-500 hover:text-black disabled:opacity-30"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              )}

              {full ? (
                <span className="block text-center font-sans text-sm text-gray-400 py-3 border border-gray-200">Fully booked</span>
              ) : isAdded ? (
                <button
                  onClick={() => booking.removeAddon(exp.id)}
                  className="w-full font-sans text-sm py-3 bg-[#2d6a4f] text-white hover:bg-red-600 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Check size={14} /> Added to Trip — remove
                </button>
              ) : (
                <>
                  <button
                    onClick={handleBook}
                    className="w-full bg-[#C9A96E] text-[#2d2d2d] py-3 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors"
                  >
                    Book this Experience →
                  </button>
                  {clampedGuests > 1 && (
                    <p className="font-sans text-xs text-gray-400 text-center mt-2">
                      Total: R {(exp.pricePerPerson * clampedGuests).toLocaleString()}
                    </p>
                  )}
                </>
              )}

              <Link
                href={`/experiences/request?trail=${encodeURIComponent(exp.trailId)}`}
                className="mt-3 block text-center border border-[#2d6a4f] text-[#2d6a4f] py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
              >
                Book on Custom Dates
              </Link>
            </div>

            {/* Key facts */}
            <div className="bg-white border border-gray-200 p-5">
              <h3 className="font-display italic text-xl mb-4">Experience Details</h3>
              <div className="space-y-3 font-sans text-sm">
                <div className="flex justify-between gap-4"><span className="text-gray-400">Tour Operator</span><span className="text-right">{exp.operator}</span></div>
                {exp.leadGuide && <div className="flex justify-between gap-4"><span className="text-gray-400">Lead Guide</span><span className="text-right">{exp.leadGuide}</span></div>}
                <div className="flex justify-between gap-4"><span className="text-gray-400">Departure</span><span className="text-right">{formatDate(exp.departureDate)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-400">Return</span><span className="text-right">{formatDate(exp.returnDate)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-400">Duration</span><span>{exp.durationDays} day{exp.durationDays !== 1 ? 's' : ''}</span></div>
                <div className="flex justify-between gap-4 items-center"><span className="text-gray-400">Difficulty</span>
                  <span className="px-2.5 py-1 text-xs" style={{ color: DIFF_COLOR[exp.difficulty] || '#2d6a4f', background: (DIFF_COLOR[exp.difficulty] || '#2d6a4f') + '22' }}>{exp.difficulty}</span>
                </div>
                {exp.region && <div className="flex justify-between gap-4"><span className="text-gray-400">Region</span><span className="text-right">{exp.region}</span></div>}
                {exp.meetingPoint && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400 shrink-0">Meeting Point</span>
                    <span className="text-right"><MapPin size={11} className="inline mr-1 -mt-0.5 text-[#C9A96E]" />{exp.meetingPoint}</span>
                  </div>
                )}
                {exp.minAge > 0 && <div className="flex justify-between gap-4"><span className="text-gray-400">Minimum Age</span><span>{exp.minAge}</span></div>}
                <div className="flex justify-between gap-4"><span className="text-gray-400">Max Group</span><span>{exp.maxGroup}</span></div>
                {exp.accommodationStyle && <div className="flex justify-between gap-4"><span className="text-gray-400">Accommodation</span><span className="text-right">{exp.accommodationStyle}</span></div>}
                {exp.mealsIncluded && <div className="flex justify-between gap-4"><span className="text-gray-400">Meals</span><span className="text-right">{exp.mealsIncluded}</span></div>}
                {exp.cancellation && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400"><Shield size={11} className="inline mr-1 -mt-0.5" />Cancellation</span>
                    <span className="text-right">{exp.cancellation} notice</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

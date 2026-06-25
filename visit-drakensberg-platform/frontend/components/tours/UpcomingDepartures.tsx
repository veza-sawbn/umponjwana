'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Users, Tag, UserCircle, Package, Sparkles, Check, Plus, Minus } from 'lucide-react'
import { motion } from 'framer-motion'
import { useBooking } from '@/lib/booking-context'
import { staggerContainer, staggerChild } from '@/lib/motion'

export type TourDate = {
  id: string
  date: string
  type: 'guide' | 'package' | 'experience'
  operator: string      // supplier / company name
  tourName?: string     // tour product name (shown beneath operator)
  guide?: string
  supplierId?: string
  spots_total: number
  spots_remaining: number
  price_per_person: number
  duration: string
  tourDays?: number     // used to calculate checkout date for accommodation
  notes?: string
  booking_href?: string
}

const TYPE_META: Record<TourDate['type'], { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  guide: { label: 'Guided Departure', color: '#2d6a4f', bg: '#2d6a4f15', Icon: UserCircle },
  package: { label: 'Package', color: '#8B4513', bg: '#8B451315', Icon: Package },
  experience: { label: 'Experience', color: '#C9A96E', bg: '#C9A96E20', Icon: Sparkles },
}

function spotsLabel(remaining: number, total: number) {
  if (remaining === 0) return { text: 'Fully booked', urgent: false, full: true }
  if (remaining <= 2) return { text: `${remaining} spot${remaining === 1 ? '' : 's'} left`, urgent: true, full: false }
  return { text: `${remaining} of ${total} spots`, urgent: false, full: false }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function addDays(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function UpcomingDepartures({
  dates,
  context,
  trailRegion,
}: {
  dates: TourDate[]
  context?: string
  trailRegion?: string
}) {
  const [filter, setFilter] = useState<'all' | TourDate['type']>('all')
  const [guestCounts, setGuestCounts] = useState<Record<string, number>>({})
  const booking = useBooking()
  const router = useRouter()

  function getGuests(id: string, maxSpots: number) {
    return Math.min(guestCounts[id] ?? 1, maxSpots)
  }

  function changeGuests(id: string, delta: number, maxSpots: number) {
    setGuestCounts(prev => ({
      ...prev,
      [id]: Math.max(1, Math.min(maxSpots, (prev[id] ?? 1) + delta)),
    }))
  }

  function handleAdd(d: TourDate) {
    const guests = getGuests(d.id, d.spots_remaining)
    const days = d.tourDays ?? 1
    // Night before departure → night after last day of tour
    booking.setSearch(
      trailRegion ?? booking.region,
      addDays(d.date, -1),
      addDays(d.date, days),
      guests,
    )
    booking.addAddon({
      id: d.id,
      type: d.type === 'guide' ? 'hike' : d.type === 'package' ? 'activity' : 'tour',
      title: `${d.operator}${d.guide ? ` · ${d.guide}` : ''}`,
      supplierId: d.supplierId,
      date: d.date,
      price_per_person: d.price_per_person,
      guests,
    })
    router.push('/trip')
  }

  const visible = dates.filter(d => filter === 'all' || d.type === filter)
  const hasTypes = new Set(dates.map(d => d.type))

  if (dates.length === 0) return null

  return (
    <div>
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-display italic text-2xl text-[#000000]">Upcoming Departures</h2>
          {context && <p className="font-sans text-xs text-gray-400 mt-0.5">{context}</p>}
        </div>
        {hasTypes.size > 1 && (
          <div className="flex gap-1.5">
            {(['all', ...Array.from(hasTypes)] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilter(t as typeof filter)}
                className={`font-sans text-[10px] tracking-[0.1em] uppercase px-3 py-1.5 transition-colors ${
                  filter === t
                    ? 'bg-[#2d6a4f] text-white'
                    : 'border border-gray-200 text-gray-600 bg-white hover:border-[#2d6a4f] hover:text-[#2d6a4f]'
                }`}
              >
                {t === 'all' ? 'All' : TYPE_META[t as TourDate['type']].label}
              </button>
            ))}
          </div>
        )}
      </div>

      <motion.div
        className="space-y-3"
        variants={staggerContainer(0.04)}
        initial="hidden"
        animate="show"
      >
        {visible.map(d => {
          const meta = TYPE_META[d.type]
          const Icon = meta.Icon
          const spots = spotsLabel(d.spots_remaining, d.spots_total)
          const isAdded = booking.addons.some(a => a.id === d.id)
          const guests = getGuests(d.id, d.spots_remaining)

          return (
            <motion.div key={d.id} variants={staggerChild} className={`bg-white border ${spots.full ? 'border-gray-100 opacity-60' : 'border-gray-200'} p-5`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Left: date + type + operator */}
                <div className="flex items-start gap-4">
                  <div className="text-center shrink-0 bg-[#F7F5F2] px-3 py-2 min-w-[56px]">
                    <p className="font-sans text-[10px] text-gray-400 uppercase tracking-wide">
                      {new Date(d.date).toLocaleDateString('en-ZA', { month: 'short' })}
                    </p>
                    <p className="font-display italic text-2xl text-[#000000] leading-none">
                      {new Date(d.date).getDate()}
                    </p>
                    <p className="font-sans text-[10px] text-gray-400">
                      {new Date(d.date).toLocaleDateString('en-ZA', { weekday: 'short' })}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1 font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1"
                        style={{ color: meta.color, background: meta.bg }}
                      >
                        <Icon size={10} />
                        {meta.label}
                      </span>
                      {d.notes && (
                        <span className="font-sans text-[10px] text-gray-400">{d.notes}</span>
                      )}
                    </div>
                    <p className="font-display italic text-lg leading-snug">{d.operator}</p>
                    {d.tourName && d.tourName !== d.operator && (
                      <p className="font-sans text-xs text-black/50 mt-0.5">{d.tourName}</p>
                    )}
                    {d.guide && (
                      <p className="font-sans text-xs text-[#2d6a4f] mt-0.5 flex items-center gap-1">
                        <UserCircle size={11} /> {d.guide}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 font-sans text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(d.date)}</span>
                      <span className="flex items-center gap-1"><Tag size={11} />{d.duration}</span>
                    </div>
                  </div>
                </div>

                {/* Right: price + guest picker + CTA */}
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <div className="text-right">
                    <p className="font-display italic text-xl text-[#2d6a4f]">R {d.price_per_person.toLocaleString()}</p>
                    <p className="font-sans text-[10px] text-gray-400">per person</p>
                  </div>

                  {!spots.full && !isAdded && (
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-xs text-gray-400">Spots:</span>
                      <div className="flex items-center border border-gray-200 rounded">
                        <button
                          onClick={() => changeGuests(d.id, -1, d.spots_remaining)}
                          className="px-2 py-1 text-gray-500 hover:text-black disabled:opacity-30"
                          disabled={guests <= 1}
                        >
                          <Minus size={11} />
                        </button>
                        <span className="font-sans text-sm px-2 min-w-[24px] text-center">{guests}</span>
                        <button
                          onClick={() => changeGuests(d.id, 1, d.spots_remaining)}
                          className="px-2 py-1 text-gray-500 hover:text-black disabled:opacity-30"
                          disabled={guests >= d.spots_remaining}
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <span
                      className={`font-sans text-[10px] px-2.5 py-1 ${
                        spots.full
                          ? 'bg-gray-100 text-gray-400'
                          : spots.urgent
                          ? 'bg-red-50 text-red-600'
                          : 'bg-[#2d6a4f]/8 text-[#2d6a4f]'
                      }`}
                    >
                      <Users size={10} className="inline mr-1" />
                      {spots.text}
                    </span>
                    {spots.full ? (
                      <span className="font-sans text-xs text-gray-400 px-5 py-2.5 border border-gray-200">Full</span>
                    ) : isAdded ? (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.1 }}
                        onClick={() => booking.removeAddon(d.id)}
                        className="font-sans text-sm px-5 py-2.5 bg-[#2d6a4f] text-white hover:bg-red-600 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Check size={13} /> Added
                      </motion.button>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.1 }}
                        onClick={() => handleAdd(d)}
                        className="font-sans text-sm px-5 py-2.5 bg-[#2d6a4f] text-white hover:bg-[#235a3f] transition-colors inline-flex items-center gap-1.5"
                      >
                        <Plus size={13} /> Add to Trip
                      </motion.button>
                    )}
                  </div>

                  {!spots.full && !isAdded && guests > 1 && (
                    <p className="font-sans text-[10px] text-gray-400">
                      Total: R {(d.price_per_person * guests).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      <div className="mt-5 bg-[#F7F5F2] border border-gray-200 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-sans text-sm text-gray-700 font-medium">Can't find the right date?</p>
          <p className="font-sans text-xs text-gray-400">Request a private departure for your group</p>
        </div>
        <Link href="/guides" className="font-sans text-sm border border-[#2d6a4f] text-[#2d6a4f] px-5 py-2.5 hover:bg-[#2d6a4f] hover:text-white transition-colors">
          Enquire about private dates →
        </Link>
      </div>
    </div>
  )
}

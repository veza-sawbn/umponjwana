'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Users, Tag, ChevronRight, UserCircle, Package, Sparkles, Check, Plus } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'

export type TourDate = {
  id: string
  date: string           // ISO date string
  type: 'guide' | 'package' | 'experience'
  operator: string
  guide?: string
  spots_total: number
  spots_remaining: number
  price_per_person: number
  duration: string
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

export default function UpcomingDepartures({ dates, context }: { dates: TourDate[]; context?: string }) {
  const [filter, setFilter] = useState<'all' | TourDate['type']>('all')
  const booking = useBooking()

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
        {/* Type filter pills — only show when multiple types present */}
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

      <div className="space-y-3">
        {visible.map(d => {
          const meta = TYPE_META[d.type]
          const Icon = meta.Icon
          const spots = spotsLabel(d.spots_remaining, d.spots_total)

          return (
            <div key={d.id} className={`bg-white border ${spots.full ? 'border-gray-100 opacity-60' : 'border-gray-200'} p-5`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Left: date + type + operator */}
                <div className="flex items-start gap-4">
                  {/* Date block */}
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
                    {d.guide && (
                      <p className="font-sans text-xs text-gray-500 mt-0.5">Guide: {d.guide}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 font-sans text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(d.date)}</span>
                      <span className="flex items-center gap-1"><Tag size={11} />{d.duration}</span>
                    </div>
                  </div>
                </div>

                {/* Right: price + spots + CTA */}
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <div className="text-right">
                    <p className="font-display italic text-xl text-[#2d6a4f]">R {d.price_per_person.toLocaleString()}</p>
                    <p className="font-sans text-[10px] text-gray-400">per person</p>
                  </div>
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
                    ) : (() => {
                      const isAdded = booking.addons.some(a => a.id === d.id)
                      return (
                        <button
                          onClick={() => isAdded
                            ? booking.removeAddon(d.id)
                            : booking.addAddon({
                                id: d.id,
                                type: d.type === 'guide' ? 'hike' : d.type === 'package' ? 'activity' : 'tour',
                                title: `${d.operator}${d.guide ? ` · ${d.guide}` : ''}`,
                                date: d.date,
                                price_per_person: d.price_per_person,
                                guests: booking.guests || 1,
                              })
                          }
                          className={`font-sans text-sm px-5 py-2.5 transition-colors inline-flex items-center gap-1.5 ${
                            isAdded
                              ? 'bg-[#2d6a4f] text-white hover:bg-red-600'
                              : 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'
                          }`}
                        >
                          {isAdded ? <><Check size={13} /> Added</> : <><Plus size={13} /> Add to Trip</>}
                        </button>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

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

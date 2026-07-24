'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar, Users, Clock, MapPin, Star, UserCircle, Sparkles, Award,
  CheckCircle, GitCompareArrows,
} from 'lucide-react'
import type { TrekkingExperience } from '@/lib/experiences'
import { StayDistance } from '@/lib/stay-distance'

// "Upcoming Trekking Experiences" — the marketplace extension of a hiking
// trail page. The trail remains the primary content; these are the commercial
// departures offered by marketplace suppliers on this specific trail.

const DIFF_COLOR: Record<string, string> = {
  Easy: '#4A7251', Moderate: '#C9A96E', Challenging: '#c0392b', Extreme: '#8e44ad', Strenuous: '#c0392b',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TrailExperiences({
  trailId,
  experiences,
  title = 'Upcoming Trekking Experiences',
  subtitle = 'Commercial departures offered by marketplace suppliers on this trail',
  titleHref,
}: {
  trailId: string
  experiences: TrekkingExperience[]
  title?: string
  subtitle?: string
  titleHref?: string
}) {
  const [selected, setSelected] = useState<string[]>([])
  const router = useRouter()

  if (experiences.length === 0) return null

  function toggleCompare(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-4))
  }

  function goCompare() {
    router.push(`/experiences/compare?trail=${encodeURIComponent(trailId)}&ids=${selected.join(',')}`)
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-2 flex-wrap gap-3">
        <div>
          <h2 className="font-display italic text-2xl text-[#000000]">
            {titleHref ? (
              <Link href={titleHref} className="hover:text-[#2d6a4f] transition-colors">{title}</Link>
            ) : title}
          </h2>
          {subtitle && <p className="font-sans text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {experiences.length > 1 && (
          <button
            onClick={goCompare}
            disabled={selected.length < 2}
            className={`inline-flex items-center gap-2 font-sans text-sm px-4 py-2 transition-colors ${
              selected.length >= 2
                ? 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'
                : 'border border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <GitCompareArrows size={14} />
            Compare Experiences{selected.length > 0 ? ` (${selected.length})` : ''}
          </button>
        )}
      </div>
      {experiences.length > 1 && (
        <p className="font-sans text-[11px] text-gray-400 mb-4">Tick two or more departures to compare them side by side.</p>
      )}

      <div className="space-y-3 mt-3">
        {experiences.map(e => {
          const full = e.spacesAvailable === 0
          const checked = selected.includes(e.id)
          return (
            <div key={e.id} className={`bg-white border p-5 ${full ? 'border-gray-100 opacity-60' : checked ? 'border-[#2d6a4f]' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="text-center shrink-0 bg-[#F7F5F2] px-3 py-2 min-w-[56px]">
                    <p className="font-sans text-[10px] text-gray-400 uppercase tracking-wide">
                      {new Date(e.departureDate).toLocaleDateString('en-ZA', { month: 'short' })}
                    </p>
                    <p className="font-display italic text-2xl text-[#000000] leading-none">
                      {new Date(e.departureDate).getDate()}
                    </p>
                    <p className="font-sans text-[10px] text-gray-400">
                      {new Date(e.departureDate).toLocaleDateString('en-ZA', { weekday: 'short' })}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 text-[#C9A96E] bg-[#C9A96E]/12">
                        <Sparkles size={10} /> Trekking Experience
                      </span>
                      {e.featured && (
                        <span className="inline-flex items-center gap-1 font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 bg-[#C9A96E] text-white">
                          <Award size={10} /> Featured
                        </span>
                      )}
                      <span className="font-sans text-[10px] px-2 py-0.5" style={{ color: DIFF_COLOR[e.difficulty] || '#2d6a4f', background: (DIFF_COLOR[e.difficulty] || '#2d6a4f') + '22' }}>
                        {e.difficulty}
                      </span>
                    </div>
                    <p className="font-display italic text-lg leading-snug">{e.title}</p>
                    <p className="font-sans text-xs text-black/50 mt-0.5">{e.operator}</p>
                    {e.leadGuide && (
                      <p className="font-sans text-xs text-[#2d6a4f] mt-0.5 flex items-center gap-1">
                        <UserCircle size={11} /> Lead Guide: {e.leadGuide}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 font-sans text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(e.departureDate)} → {formatDate(e.returnDate)}</span>
                      <span className="flex items-center gap-1"><Clock size={11} />{e.durationDays} day{e.durationDays !== 1 ? 's' : ''}</span>
                      {e.meetingPoint && <span className="flex items-center gap-1"><MapPin size={11} />{e.meetingPoint}</span>}
                      {e.region && <span>{e.region}</span>}
                      <StayDistance lat={e.gpsLat} lng={e.gpsLng} />
                    </div>
                    {e.inclusions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {e.inclusions.map(s => (
                          <span key={s} className="inline-flex items-center gap-1 font-sans text-[10px] text-[#2d6a4f] bg-[#2d6a4f]/8 px-2 py-0.5">
                            <CheckCircle size={9} /> {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-right">
                    <p className="font-display italic text-xl text-[#2d6a4f]">
                      {e.packages.length > 1 && <span className="font-sans text-xs text-gray-400 mr-1">from</span>}
                      R {e.pricePerPerson.toLocaleString()}
                    </p>
                    <p className="font-sans text-[10px] text-gray-400">
                      per person{e.packages.length > 1 ? ` · ${e.packages.length} rate options` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 font-sans text-[11px]">
                    {e.rating !== null ? (
                      <span className="flex items-center gap-1 text-[#C9A96E]">
                        <Star size={11} className="fill-[#C9A96E]" /> {e.rating.toFixed(1)}
                        <span className="text-gray-400">({e.reviewCount})</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">New listing</span>
                    )}
                  </div>
                  <span className={`font-sans text-[10px] px-2.5 py-1 ${
                    full ? 'bg-gray-100 text-gray-400'
                      : e.spacesAvailable <= 2 ? 'bg-red-50 text-red-600'
                      : 'bg-[#2d6a4f]/8 text-[#2d6a4f]'
                  }`}>
                    <Users size={10} className="inline mr-1" />
                    {full ? 'Fully booked' : `${e.spacesAvailable} of ${e.spacesTotal} spaces`}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    {experiences.length > 1 && (
                      <label className={`flex items-center gap-1.5 font-sans text-xs cursor-pointer px-3 py-2 border transition-colors ${checked ? 'border-[#2d6a4f] text-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 text-gray-500 hover:border-[#2d6a4f]'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCompare(e.id)}
                          className="accent-[#2d6a4f]"
                        />
                        Compare
                      </label>
                    )}
                    <Link
                      href={`/experiences/${e.id}`}
                      className="font-sans text-sm px-5 py-2.5 bg-[#2d6a4f] text-white hover:bg-[#235a3f] transition-colors"
                    >
                      View Experience →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

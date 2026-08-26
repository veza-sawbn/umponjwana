'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Star, Check, X, GitCompareArrows, Award } from 'lucide-react'
import { getExperiencesByTrail, type TrekkingExperience } from '@/lib/experiences'
import { getTrails, type Trail } from '@/lib/trails'
import { formatMoney } from '@/lib/allocation'

// Side-by-side comparison of departures. Comparison is only available between
// experiences that reference the same Trail ID — the trail comes from the
// query string and every compared column is drawn from that trail's list.

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function CompareContent() {
  const params = useSearchParams()
  const trailId = params.get('trail') ?? ''
  const idsParam = params.get('ids') ?? ''

  const [all, setAll] = useState<TrekkingExperience[]>([])
  const [trail, setTrail] = useState<Trail | null>(null)
  const [selected, setSelected] = useState<string[]>(idsParam ? idsParam.split(',').filter(Boolean) : [])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!trailId) { setLoaded(true); return }
    Promise.all([getExperiencesByTrail(trailId), getTrails()]).then(([exps, trails]) => {
      setAll(exps)
      setTrail(trails.find(t => t.id === trailId) ?? null)
      setSelected(prev => {
        const valid = prev.filter(id => exps.some(e => e.id === id))
        return valid.length >= 2 ? valid : exps.slice(0, Math.min(3, exps.length)).map(e => e.id)
      })
      setLoaded(true)
    })
  }, [trailId])

  const compared = all.filter(e => selected.includes(e.id))

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-4))
  }

  const yesNo = (v: boolean) => v
    ? <span className="inline-flex items-center gap-1 text-[#2d6a4f]"><Check size={13} /> Yes</span>
    : <span className="inline-flex items-center gap-1 text-gray-400"><X size={13} /> No</span>

  const rows: Array<{ label: string; render: (e: TrekkingExperience) => React.ReactNode }> = [
    { label: 'Tour Operator', render: e => e.operator },
    { label: 'Lead Guide', render: e => e.leadGuide || '—' },
    { label: 'Departure', render: e => formatDate(e.departureDate) },
    { label: 'Return', render: e => formatDate(e.returnDate) },
    { label: 'Price (pp)', render: e => <span className="font-display italic text-lg text-[#2d6a4f]">{formatMoney(e.pricePerPerson)}</span> },
    { label: 'Duration', render: e => `${e.durationDays} day${e.durationDays !== 1 ? 's' : ''}` },
    { label: 'Difficulty', render: e => e.difficulty },
    { label: 'Group Size', render: e => `Max ${e.maxGroup}` },
    { label: 'Available Spaces', render: e => e.spacesAvailable === 0 ? 'Fully booked' : `${e.spacesAvailable} of ${e.spacesTotal}` },
    { label: 'Accommodation Style', render: e => e.accommodationStyle || (e.inclusions.includes('Accommodation') ? 'Included' : '—') },
    { label: 'Meals Included', render: e => e.mealsIncluded || (e.inclusions.includes('Meals') ? 'Yes' : '—') },
    { label: 'Transport Included', render: e => yesNo(e.transportIncluded) },
    { label: 'Equipment Included', render: e => yesNo(e.equipmentIncluded) },
    { label: 'Cancellation Policy', render: e => e.cancellation ? `${e.cancellation} notice` : '—' },
    {
      label: 'Operator Rating',
      render: e => e.rating !== null
        ? <span className="inline-flex items-center gap-1"><Star size={12} className="text-[#C9A96E] fill-[#C9A96E]" /> {e.rating.toFixed(1)} <span className="text-gray-400">({e.reviewCount})</span></span>
        : <span className="text-gray-400">New listing</span>,
    },
    { label: 'Guide Experience', render: e => e.guideExperienceYears ? `${e.guideExperienceYears} years` : '—' },
    { label: 'Meeting Point', render: e => e.meetingPoint || '—' },
    { label: 'Included Services', render: e => e.inclusions.length ? e.inclusions.join(', ') : '—' },
  ]

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <section className="bg-[#2d6a4f] text-white py-16 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href={trailId ? `/hikes/${trailId}` : '/hikes'} className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> {trail ? trail.name : 'All Trails'}
          </Link>
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">Compare Experiences</p>
          <h1 className="font-display italic text-4xl lg:text-5xl mb-3">
            {trail ? `Departures on ${trail.name}` : 'Compare Departures'}
          </h1>
          <p className="font-sans text-sm text-white/60 max-w-2xl">
            Compare price, duration, inclusions and operators across departures that run this trail. Only experiences on the same trail can be compared.
          </p>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        {!loaded ? (
          <div className="py-20 text-center font-sans text-sm text-gray-400">Loading experiences…</div>
        ) : !trailId ? (
          <div className="py-20 text-center">
            <GitCompareArrows size={32} className="text-gray-300 mx-auto mb-4" />
            <p className="font-sans text-sm text-gray-500 mb-6">Pick a hiking trail first — comparison works between departures of the same trail.</p>
            <Link href="/hikes" className="border border-[#2d6a4f] text-[#2d6a4f] px-6 py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
              Browse Hiking Trails
            </Link>
          </div>
        ) : all.length === 0 ? (
          <div className="py-20 text-center">
            <GitCompareArrows size={32} className="text-gray-300 mx-auto mb-4" />
            <p className="font-sans text-sm text-gray-500 mb-6">No upcoming experiences on this trail yet.</p>
            <Link href={`/hikes/${trailId}`} className="border border-[#2d6a4f] text-[#2d6a4f] px-6 py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
              Back to the Trail
            </Link>
          </div>
        ) : (
          <>
            {/* Selector chips */}
            <div className="flex flex-wrap gap-2 mb-8">
              {all.map(e => {
                const on = selected.includes(e.id)
                return (
                  <button
                    key={e.id}
                    onClick={() => toggle(e.id)}
                    className={`font-sans text-xs px-4 py-2 border transition-colors ${on ? 'bg-[#2d6a4f] border-[#2d6a4f] text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-[#2d6a4f]'}`}
                  >
                    {e.title} · {formatDate(e.departureDate)}
                  </button>
                )
              })}
            </div>

            {compared.length < 2 ? (
              <p className="font-sans text-sm text-gray-500 py-12 text-center">Select at least two departures above to compare them.</p>
            ) : (
              <div className="overflow-x-auto bg-white border border-gray-200">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 px-5 py-4 w-44">Experience</th>
                      {compared.map(e => (
                        <th key={e.id} className="text-left px-5 py-4 align-top">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-display italic text-lg leading-snug">{e.title}</p>
                            {e.featured && (
                              <span className="inline-flex items-center gap-1 font-sans text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 bg-[#C9A96E] text-white"><Award size={9} /> Featured</span>
                            )}
                          </div>
                          <Link href={`/experiences/${e.id}`} className="font-sans text-xs text-[#2d6a4f] hover:underline">View Experience →</Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(row => (
                      <tr key={row.label}>
                        <td className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 px-5 py-3.5 align-top">{row.label}</td>
                        {compared.map(e => (
                          <td key={e.id} className="font-sans text-sm text-gray-700 px-5 py-3.5 align-top">{row.render(e)}</td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td className="px-5 py-4" />
                      {compared.map(e => (
                        <td key={e.id} className="px-5 py-4">
                          <Link
                            href={`/experiences/${e.id}`}
                            className="inline-block bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors"
                          >
                            Book this Experience →
                          </Link>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F5F2]" />}>
      <CompareContent />
    </Suspense>
  )
}

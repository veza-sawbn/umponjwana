'use client'

import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import { Filter, UserCheck, Building2, MapPin, Star, Users, Award, Globe } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getOperators, getGuidesByOperator, type OperatorProfile, type GuideProfile } from '@/lib/operators'

// Supplier directory organised by tourism businesses:
// Tour Operator → Guide Team → Guide Profile.

export default function GuidesPage() {
  const [operators, setOperators] = useState<OperatorProfile[]>([])
  const [teams, setTeams] = useState<Record<string, GuideProfile[]>>({})
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getOperators().then(async ops => {
      setOperators(ops)
      const entries = await Promise.all(ops.map(async o => [o.id, await getGuidesByOperator(o)] as const))
      setTeams(Object.fromEntries(entries))
      setLoading(false)
    })
  }, [])

  const activityFilters = useMemo(() => {
    const set = new Set<string>()
    operators.forEach(o => o.activities.forEach(a => set.add(a)))
    return ['All', ...Array.from(set).slice(0, 8)]
  }, [operators])

  const visible = operators.filter(o => filter === 'All' || o.activities.includes(filter))

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      <section className="bg-[#2d6a4f] text-white py-20 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-4">Expert Local Knowledge</p>
          <h1 className="font-display italic text-5xl lg:text-6xl mb-4">Guides & Tour Operators</h1>
          <p className="font-sans text-lg text-white/70 max-w-2xl">
            Verified tourism businesses and their guide teams. Every guide holds a FGASA certificate and a TBCSA registration number, verified by our team before they lead a single experience.
          </p>
        </div>
      </section>

      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-4 flex items-center gap-3 overflow-x-auto">
          <Filter size={14} className="text-gray-400 shrink-0" />
          {activityFilters.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 font-sans text-sm whitespace-nowrap transition-colors ${filter === s ? 'bg-[#2d6a4f] text-white' : 'border border-gray-300 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f]'}`}
            >
              {s}
            </button>
          ))}
          <span className="ml-auto font-sans text-sm text-gray-400 shrink-0">
            {visible.length} operator{visible.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        {loading ? (
          <div className="py-20 text-center font-sans text-sm text-gray-400">Loading the supplier directory…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visible.map(o => {
              const team = teams[o.id] ?? []
              return (
                <div key={o.id} className="bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors flex flex-col">
                  <div className="p-6 flex-1">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-16 h-16 bg-[#2d6a4f]/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {o.logo
                          ? <img src={o.logo} alt={o.companyName} className="w-full h-full object-cover" />
                          : <Building2 size={22} className="text-[#2d6a4f]" />}
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-display italic text-2xl text-[#000000] leading-tight">{o.companyName}</h2>
                        <p className="font-sans text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <MapPin size={11} className="text-[#C9A96E]" /> {o.location || 'Drakensberg'}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 font-sans text-xs text-gray-400 flex-wrap">
                          <span>{o.yearsOperating} year{o.yearsOperating !== 1 ? 's' : ''} operating</span>
                          <span className="flex items-center gap-1"><Users size={11} /> {team.length} guide{team.length !== 1 ? 's' : ''}</span>
                          {o.rating !== null && (
                            <span className="flex items-center gap-1 text-[#C9A96E]">
                              <Star size={11} className="fill-[#C9A96E]" /> {o.rating.toFixed(1)}
                              <span className="text-gray-400">({o.reviewCount})</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {o.certifications.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {o.certifications.map(c => (
                          <span key={c} className="inline-flex items-center gap-1 font-sans text-[10px] text-[#2d6a4f] bg-[#2d6a4f]/8 px-2 py-1">
                            <Award size={9} /> {c}
                          </span>
                        ))}
                      </div>
                    )}
                    {o.languages.length > 0 && (
                      <p className="font-sans text-xs text-gray-500 mb-2 flex items-center gap-1.5">
                        <Globe size={11} className="text-[#C9A96E]" /> {o.languages.join(' · ')}
                      </p>
                    )}
                    {o.activities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {o.activities.map(a => (
                          <span key={a} className="font-sans text-[11px] text-gray-600 bg-[#F7F5F2] border border-gray-200 px-2.5 py-1">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-3">
                    <div className="flex -space-x-2">
                      {team.slice(0, 4).map(g => (
                        <div key={g.id} title={g.name} className="w-8 h-8 bg-[#2d6a4f] text-white flex items-center justify-center font-display italic text-xs border-2 border-white rounded-full">
                          {g.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      ))}
                      {team.length > 4 && (
                        <div className="w-8 h-8 bg-gray-200 text-gray-500 flex items-center justify-center font-sans text-[10px] border-2 border-white rounded-full">
                          +{team.length - 4}
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/guides/operators/${o.id}`}
                      className="font-sans text-sm bg-[#2d6a4f] text-white px-5 py-2.5 hover:bg-[#235a3f] transition-colors"
                    >
                      View Team →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="py-24 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#2d6a4f]/10 flex items-center justify-center mb-6">
              <UserCheck size={28} className="text-[#2d6a4f]" />
            </div>
            <h2 className="font-display italic text-3xl text-[#000000] mb-3">No operators match this filter</h2>
            <p className="font-sans text-base text-gray-500 max-w-md mb-8 leading-relaxed">
              Registered tourism businesses appear here once verified. If you run a guiding business, apply through your supplier dashboard.
            </p>
            <Link
              href="/auth/signup"
              className="inline-block border border-[#2d6a4f] text-[#2d6a4f] px-6 py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
            >
              Register as a Supplier
            </Link>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

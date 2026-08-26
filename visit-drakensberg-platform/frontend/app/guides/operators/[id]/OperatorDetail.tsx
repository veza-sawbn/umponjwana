'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import {
  ArrowLeft, Building2, MapPin, Star, Award, Globe, Shield, Siren,
  Backpack, UserCircle, Calendar, CheckCircle,
} from 'lucide-react'
import { getGuidesByOperator, type OperatorProfile, type GuideProfile } from '@/lib/operators'
import { getUpcomingExperiences, type TrekkingExperience } from '@/lib/experiences'
import { formatMoney } from '@/lib/allocation'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Client island rendered inside the server shell (page.tsx), which already
 * resolved `operator` for generateMetadata/JSON-LD and 404s server-side if
 * the id doesn't exist. The guide roster (needs the operator object as
 * input) and upcoming departures (time-sensitive) are fetched here. See
 * docs/destination-graph/PHASE_B.md.
 */
export default function OperatorDetail({ operator }: { operator: OperatorProfile }) {
  const [guides, setGuides] = useState<GuideProfile[]>([])
  const [departures, setDepartures] = useState<TrekkingExperience[]>([])

  useEffect(() => {
    getGuidesByOperator(operator).then(setGuides)
    getUpcomingExperiences().then(exps =>
      setDepartures(operator.supplierId ? exps.filter(e => e.operatorId === operator.supplierId) : [])
    )
  }, [operator])

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <section className="bg-[#2d6a4f] text-white py-20 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/guides" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={16} /> Guides & Tour Operators
          </Link>
          <div className="flex items-end gap-8 flex-wrap">
            <div className="w-24 h-24 bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
              {operator.logo
                ? <img src={operator.logo} alt={operator.companyName} className="w-full h-full object-cover" />
                : <Building2 size={32} className="text-white/50" />}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="font-display italic text-4xl lg:text-5xl">{operator.companyName}</h1>
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 font-sans text-xs text-white">
                  <CheckCircle size={12} /> Verified Operator
                </span>
              </div>
              <div className="flex items-center gap-4 font-sans text-sm text-white/70 flex-wrap">
                <span className="flex items-center gap-1"><MapPin size={13} /> {operator.location || 'Drakensberg'}</span>
                <span>{operator.yearsOperating} year{operator.yearsOperating !== 1 ? 's' : ''} operating</span>
                {operator.rating !== null && (
                  <span>★ {operator.rating.toFixed(1)} <span className="text-white/40">({operator.reviewCount} reviews)</span></span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            {/* Overview */}
            {operator.overview && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">About the Company</h2>
                <p className="font-sans text-gray-700 leading-relaxed">{operator.overview}</p>
              </div>
            )}

            {/* Guide roster */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">Guide Team</h2>
              {guides.length === 0 ? (
                <p className="font-sans text-sm text-gray-400 bg-white border border-gray-200 p-5">No verified guides listed yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {guides.map(g => (
                    <Link key={g.id} href={`/guides/${g.id}`} className="bg-white border border-gray-200 p-5 hover:border-[#2d6a4f] transition-colors block">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-[#2d6a4f] text-white flex items-center justify-center font-display italic shrink-0 overflow-hidden">
                          {g.portrait
                            ? <img src={g.portrait} alt={g.name} className="w-full h-full object-cover" />
                            : g.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="min-w-0">
                          <p className="font-display italic text-lg leading-tight">{g.name}</p>
                          <p className="font-sans text-xs text-gray-400 mt-0.5">{g.certs}</p>
                          <div className="flex items-center gap-3 mt-1 font-sans text-xs text-gray-500 flex-wrap">
                            {g.yearsExperience ? <span>{g.yearsExperience} yrs experience</span> : null}
                            {g.rating > 0 && (
                              <span className="flex items-center gap-1 text-[#C9A96E]"><Star size={10} className="fill-[#C9A96E]" /> {g.rating}</span>
                            )}
                          </div>
                          <span className="font-sans text-xs text-[#2d6a4f] mt-1.5 inline-block">View Profile →</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming departures */}
            {departures.length > 0 && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Upcoming Departures</h2>
                <div className="space-y-3">
                  {departures.slice(0, 6).map(e => (
                    <Link key={e.id} href={`/experiences/${e.id}`} className="block bg-white border border-gray-200 p-4 hover:border-[#2d6a4f] transition-colors">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="font-display italic text-lg">{e.title}</p>
                          <p className="font-sans text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                            <Calendar size={11} className="text-[#C9A96E]" /> {formatDate(e.departureDate)} · {e.durationDays} day{e.durationDays !== 1 ? 's' : ''}
                            {e.leadGuide && <span className="flex items-center gap-1"><UserCircle size={11} /> {e.leadGuide}</span>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-display italic text-lg text-[#2d6a4f]">{formatMoney(e.pricePerPerson)}</p>
                          <p className="font-sans text-[10px] text-gray-400">{e.spacesAvailable === 0 ? 'Fully booked' : `${e.spacesAvailable} spaces left`}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-6">Customer Reviews</h2>
              <div className="bg-white border border-gray-200 p-8 text-center">
                <p className="font-sans text-sm text-gray-400">No reviews yet — be the first to book and share your experience.</p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 p-5 space-y-4">
              <h3 className="font-display italic text-xl">Company Details</h3>
              {operator.operatingRegions.length > 0 && (
                <Detail icon={MapPin} label="Operating Regions">{operator.operatingRegions.join(', ')}</Detail>
              )}
              {operator.certifications.length > 0 && (
                <Detail icon={Award} label="Certifications">{operator.certifications.join(', ')}</Detail>
              )}
              {operator.languages.length > 0 && (
                <Detail icon={Globe} label="Languages">{operator.languages.join(', ')}</Detail>
              )}
              {operator.licences.length > 0 && (
                <Detail icon={Shield} label="Licences">{operator.licences.join(', ')}</Detail>
              )}
              {operator.insurance && (
                <Detail icon={Shield} label="Insurance">{operator.insurance}</Detail>
              )}
              {operator.emergencyProcedures && (
                <Detail icon={Siren} label="Emergency Procedures">{operator.emergencyProcedures}</Detail>
              )}
              {operator.equipmentOwned.length > 0 && (
                <Detail icon={Backpack} label="Equipment Owned">{operator.equipmentOwned.join(', ')}</Detail>
              )}
              {operator.activities.length > 0 && (
                <Detail icon={CheckCircle} label="Activities Offered">{operator.activities.join(', ')}</Detail>
              )}
            </div>

            <div className="bg-[#2d6a4f] text-white p-6">
              <h3 className="font-display italic text-xl mb-3">Plan a Private Trip</h3>
              <p className="font-sans text-sm text-white/70 mb-5">Can't make a scheduled departure? Request custom dates and this operator can quote for your group.</p>
              <Link href="/experiences/request" className="block text-center bg-[#C9A96E] text-[#2d2d2d] py-3 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors">
                Book on Custom Dates →
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function Detail({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1 flex items-center gap-1.5">
        <Icon size={11} className="text-[#C9A96E]" /> {label}
      </p>
      <p className="font-sans text-sm text-gray-700 leading-relaxed">{children}</p>
    </div>
  )
}

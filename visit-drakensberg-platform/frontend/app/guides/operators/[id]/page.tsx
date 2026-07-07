'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import {
  ArrowLeft, Building2, MapPin, Star, Award, Globe, Shield, Siren,
  Backpack, UserCircle, Calendar, CheckCircle,
} from 'lucide-react'
import {
  getOperatorById, getGuidesByOperator, type OperatorProfile, type GuideProfile,
} from '@/lib/operators'
import { getUpcomingExperiences, type TrekkingExperience } from '@/lib/experiences'

// Supplier profile: company overview, compliance, guide roster and upcoming
// departures. Guides always remain linked to their supplier.

const SHOWCASE_REVIEWS = [
  { name: 'Sarah T.', rating: 5, date: 'June 2026', comment: 'Professionally run from the first email to the summit. The guide read the weather perfectly and kept the whole group comfortable.' },
  { name: 'James F.', rating: 5, date: 'May 2026', comment: 'Outstanding operator — permits, transport and meals all handled. We just had to walk.' },
  { name: 'Priya N.', rating: 4, date: 'April 2026', comment: 'Well organised multi-day traverse. Camp setup and safety briefings were excellent.' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function OperatorProfilePage() {
  const { id } = useParams() as { id: string }
  const [operator, setOperator] = useState<OperatorProfile | null>(null)
  const [guides, setGuides] = useState<GuideProfile[]>([])
  const [departures, setDepartures] = useState<TrekkingExperience[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getOperatorById(id).then(async op => {
      setOperator(op)
      if (op) {
        const [team, exps] = await Promise.all([getGuidesByOperator(op), getUpcomingExperiences()])
        setGuides(team)
        setDepartures(op.supplierId ? exps.filter(e => e.operatorId === op.supplierId) : [])
      }
      setLoaded(true)
    })
  }, [id])

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <div className="flex items-center justify-center h-96 mt-16 font-sans text-sm text-gray-400">Loading operator…</div>
        <Footer />
      </div>
    )
  }

  if (!operator) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <div className="flex flex-col items-center justify-center h-96 mt-16 text-center px-6">
          <Building2 size={32} className="text-gray-300 mb-4" />
          <h1 className="font-display italic text-3xl mb-2">Operator not found</h1>
          <Link href="/guides" className="mt-4 border border-[#2d6a4f] text-[#2d6a4f] px-6 py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
            Back to the Directory
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

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
                          <p className="font-display italic text-lg text-[#2d6a4f]">R {e.pricePerPerson.toLocaleString()}</p>
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
              <div className="space-y-5">
                {SHOWCASE_REVIEWS.map((r, i) => (
                  <div key={i} className="bg-white border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f]">{r.name[0]}</div>
                        <div>
                          <p className="font-sans text-sm font-medium">{r.name}</p>
                          <p className="font-sans text-xs text-gray-400">{r.date}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: r.rating }).map((_, j) => <Star key={j} size={12} className="text-[#C9A96E] fill-[#C9A96E]" />)}
                      </div>
                    </div>
                    <p className="font-sans text-sm text-gray-700 leading-relaxed">{r.comment}</p>
                  </div>
                ))}
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

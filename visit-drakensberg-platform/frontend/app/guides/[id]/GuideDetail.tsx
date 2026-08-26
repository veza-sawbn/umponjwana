'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import {
  CheckCircle, Star, ArrowLeft, Mountain, Award, Globe, Building2,
  CalendarDays, Flag,
} from 'lucide-react'
import { getOperatorForGuide, type GuideProfile, type OperatorProfile } from '@/lib/operators'
import { getUpcomingExperiences, type TrekkingExperience } from '@/lib/experiences'
import { formatMoney } from '@/lib/allocation'

const csv = (s?: string) => (s ?? '').split(',').map(x => x.trim()).filter(Boolean)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Client island rendered inside the server shell (page.tsx), which already
 * resolved `guide` for generateMetadata/JSON-LD and 404s server-side if the
 * id doesn't exist. The associated operator and upcoming departures are
 * fetched here — the operator lookup needs the guide object as input
 * (getOperatorForGuide), and departures are time-sensitive booking data, so
 * both stay client-side. See docs/destination-graph/PHASE_B.md.
 */
export default function GuideDetail({ guide }: { guide: GuideProfile }) {
  const [operator, setOperator] = useState<OperatorProfile | null>(null)
  const [departures, setDepartures] = useState<TrekkingExperience[]>([])

  useEffect(() => {
    getOperatorForGuide(guide).then(setOperator)
    getUpcomingExperiences().then(exps => setDepartures(exps.filter(e => e.leadGuide === guide.name)))
  }, [guide])

  const initials = guide.name.split(' ').map(n => n[0]).join('')
  const languages = csv(guide.languages)
  const specialisations = csv(guide.specialisations || guide.speciality)
  const firstName = guide.name.split(' ')[0]
  const blockedDays = (guide.blocked ?? []).filter(d => d >= new Date().toISOString().slice(0, 10)).sort()

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      <section className="bg-[#2d6a4f] text-white py-20 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href={operator ? `/guides/operators/${operator.id}` : '/guides'} className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={16} /> {operator ? operator.companyName : 'All Guides'}
          </Link>
          <div className="flex items-end gap-8 flex-wrap">
            <div className="w-24 h-24 bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
              {guide.portrait
                ? <img src={guide.portrait} alt={guide.name} className="w-full h-full object-cover" />
                : <span className="font-display italic text-4xl text-white/50">{initials}</span>}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="font-display italic text-4xl lg:text-5xl">{guide.name}</h1>
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 font-sans text-xs text-white">
                  <CheckCircle size={12} /> Verified Guide
                </span>
              </div>
              <div className="flex items-center gap-4 font-sans text-sm text-white/70 flex-wrap">
                {guide.rating > 0 && <span>★ {guide.rating} <span className="text-white/40">({guide.tours} experiences led)</span></span>}
                {guide.yearsExperience ? <span>{guide.yearsExperience} years of experience</span> : null}
                {operator && (
                  <span className="flex items-center gap-1.5"><Building2 size={13} /> {operator.companyName}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            {/* Bio */}
            {guide.bio && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Biography</h2>
                <p className="font-sans text-gray-700 leading-relaxed">{guide.bio}</p>
              </div>
            )}

            {/* Expedition stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Flag, label: 'Highest Summit', value: guide.highestSummit || '—' },
                { icon: Mountain, label: 'Expeditions', value: guide.completedExpeditions ? `${guide.completedExpeditions}+` : `${guide.tours || '—'}` },
                { icon: CalendarDays, label: 'Experience', value: guide.yearsExperience ? `${guide.yearsExperience} years` : '—' },
                { icon: Star, label: 'Rating', value: guide.rating > 0 ? guide.rating.toFixed(1) : 'New' },
              ].map(s => {
                const Icon = s.icon
                return (
                  <div key={s.label} className="bg-white border border-gray-200 p-4 text-center">
                    <Icon size={16} className="text-[#C9A96E] mx-auto mb-2" />
                    <p className="font-display italic text-lg leading-tight">{s.value}</p>
                    <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mt-1">{s.label}</p>
                  </div>
                )
              })}
            </div>

            {/* Languages & Specialisations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-3 flex items-center gap-1.5"><Globe size={11} /> Languages</h3>
                <div className="flex flex-wrap gap-2">
                  {languages.length > 0
                    ? languages.map(l => <span key={l} className="bg-[#F7F5F2] border border-gray-200 px-3 py-1.5 font-sans text-sm">{l}</span>)
                    : <span className="font-sans text-sm text-gray-400">Not listed</span>}
                </div>
              </div>
              <div>
                <h3 className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-3">Specialisations</h3>
                <div className="flex flex-wrap gap-2">
                  {specialisations.length > 0
                    ? specialisations.map(s => <span key={s} className="bg-[#C9A96E]/10 text-[#2d6a4f] px-3 py-1.5 font-sans text-sm">{s}</span>)
                    : <span className="font-sans text-sm text-gray-400">Not listed</span>}
                </div>
              </div>
            </div>

            {/* Qualifications & Certification */}
            <div className="bg-[#2d6a4f]/5 border border-[#2d6a4f]/20 p-6">
              <h3 className="font-display italic text-lg text-[#2d6a4f] mb-4 flex items-center gap-2"><Award size={16} /> Qualifications, Certifications & Registration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {guide.qualifications && (
                  <div>
                    <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">Qualifications</p>
                    <p className="font-sans text-sm font-medium">{guide.qualifications}</p>
                  </div>
                )}
                <div>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">Certification</p>
                  <p className="font-sans text-sm font-medium">{guide.certs || '—'}</p>
                </div>
                <div>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">TBCSA Guide Number</p>
                  <p className="font-sans text-sm font-medium">{guide.guideNo || 'On file'}</p>
                </div>
              </div>
              <p className="font-sans text-xs text-gray-500 mt-3">Certificate details are verified by Visit Drakensberg before a guide is listed publicly.</p>
            </div>

            {/* Upcoming availability: scheduled departures this guide leads */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">Upcoming Availability</h2>
              {departures.length > 0 ? (
                <div className="space-y-3">
                  {departures.slice(0, 5).map(e => (
                    <Link key={e.id} href={`/experiences/${e.id}`} className="block bg-white border border-gray-200 p-4 hover:border-[#2d6a4f] transition-colors">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="font-display italic text-lg">{e.title}</p>
                          <p className="font-sans text-xs text-gray-500">{formatDate(e.departureDate)} · {e.durationDays} day{e.durationDays !== 1 ? 's' : ''} · {e.operator}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-display italic text-lg text-[#2d6a4f]">{formatMoney(e.pricePerPerson)}</p>
                          <p className="font-sans text-[10px] text-gray-400">{e.spacesAvailable === 0 ? 'Fully booked' : `${e.spacesAvailable} spaces left`}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="font-sans text-sm text-gray-500 bg-white border border-gray-200 p-5">
                  No scheduled departures with {firstName} right now — request custom dates below and the operator will check availability.
                </p>
              )}
              {blockedDays.length > 0 && (
                <p className="font-sans text-xs text-gray-400 mt-3">
                  Unavailable: {blockedDays.slice(0, 6).map(formatDate).join(', ')}{blockedDays.length > 6 ? '…' : ''}
                </p>
              )}
            </div>

            {/* Reviews */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display italic text-2xl text-[#000000]">Guest Reviews</h2>
                {guide.rating > 0 && (
                  <div className="flex items-center gap-2">
                    <Star size={18} className="text-[#C9A96E] fill-[#C9A96E]" />
                    <span className="font-display italic text-xl">{guide.rating}</span>
                    <span className="font-sans text-sm text-gray-400">({guide.tours} experiences)</span>
                  </div>
                )}
              </div>
              <div className="bg-white border border-gray-200 p-8 text-center">
                <p className="font-sans text-sm text-gray-400">No reviews yet — be the first to book and share your experience.</p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-[#2d6a4f] text-white p-6">
              <h3 className="font-display italic text-xl mb-4">Book {firstName} for a Private Trip</h3>
              <p className="font-sans text-sm text-white/70 mb-6">
                Request custom dates on any trail — {operator ? operator.companyName : 'the operator'} confirms {firstName}'s availability before you pay.
              </p>
              <Link
                href={`/experiences/request?guide=${encodeURIComponent(guide.id)}`}
                className="block text-center bg-[#C9A96E] text-[#2d2d2d] py-3 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors"
              >
                Book this Guide →
              </Link>
            </div>

            {/* Associated tour operator — guides always stay linked to their supplier */}
            {operator && (
              <div className="bg-white border border-gray-200 p-5">
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-3">Associated Tour Operator</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-[#2d6a4f]/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {operator.logo
                      ? <img src={operator.logo} alt={operator.companyName} className="w-full h-full object-cover" />
                      : <Building2 size={18} className="text-[#2d6a4f]" />}
                  </div>
                  <div>
                    <p className="font-display italic text-lg leading-tight">{operator.companyName}</p>
                    <p className="font-sans text-xs text-gray-400">{operator.location}</p>
                  </div>
                </div>
                <Link href={`/guides/operators/${operator.id}`} className="font-sans text-sm text-[#2d6a4f] hover:underline">
                  View Company Profile →
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

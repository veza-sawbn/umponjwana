'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Footer from '@/components/layout/Footer'
import {
  ArrowLeft, Building2, MapPin, Award, Globe, Shield, Siren,
  Backpack, CheckCircle,
} from 'lucide-react'
import { getGuidesByOperator, type OperatorProfile, type GuideProfile } from '@/lib/operators'
import GuideTeamCarousel from '@/components/guides/GuideTeamCarousel'
import HikeCalendar from '@/components/guides/HikeCalendar'
import { getUpcomingExperiences, type TrekkingExperience } from '@/lib/experiences'
import { publicSupabase } from '@/lib/supabase-public'
import { formatMoney } from '@/lib/allocation'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

/**
 * Client island rendered inside the server shell (page.tsx), which already
 * resolved `operator` for generateMetadata/JSON-LD and 404s server-side if
 * the id doesn't exist. The guide roster (needs the operator object as
 * input) and upcoming departures (time-sensitive) are fetched here. See
 * docs/destination-graph/PHASE_B.md.
 *
 * The page leads with the operator's hike calendar (components/guides/
 * HikeCalendar.tsx) — the place visitors view, save and book departures —
 * with the company profile below it.
 */
export default function OperatorDetail({ operator }: { operator: OperatorProfile }) {
  const [guides, setGuides] = useState<GuideProfile[]>([])
  const [departures, setDepartures] = useState<TrekkingExperience[]>([])
  const [departuresLoaded, setDeparturesLoaded] = useState(false)

  useEffect(() => {
    // publicSupabase (session-less) — matches the server shell's own read, so
    // a signed-in admin or ops session sees the same page a visitor does
    // rather than one including suspended suppliers. See lib/supabase-public.ts.
    getGuidesByOperator(operator, publicSupabase).then(setGuides)
    getUpcomingExperiences(publicSupabase)
      .then(exps => setDepartures(operator.supplierId ? exps.filter(e => e.operatorId === operator.supplierId) : []))
      .finally(() => setDeparturesLoaded(true))
  }, [operator])

  const trailCount = new Set(departures.map(d => d.trailId).filter(Boolean)).size
  const fromPrice = departures.length > 0 ? Math.min(...departures.map(d => d.pricePerPerson)) : null

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <section className="bg-[#2d6a4f] text-white py-20 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/guides" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={16} /> Guides & Tour Operators
          </Link>
          <div className="flex items-end gap-8 flex-wrap">
            <div className="relative w-24 h-24 bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
              {operator.logo
                ? <Image src={operator.logo} alt={operator.companyName} fill sizes="96px" className="object-cover" />
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

          <div className="mt-12 pt-8 border-t border-white/15 flex items-end justify-between gap-8 flex-wrap">
            <dl className="flex gap-10 flex-wrap">
              <HeroStat label="Upcoming departures" value={departuresLoaded ? String(departures.length) : '–'} />
              <HeroStat label="Trails" value={departuresLoaded ? String(trailCount) : '–'} />
              {fromPrice !== null && <HeroStat label="From" value={formatMoney(fromPrice)} />}
            </dl>
            <a href="#calendar" className="bg-[#C9A96E] text-[#2d2d2d] px-6 py-3 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors">
              View hike calendar ↓
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 pt-16">
        {departuresLoaded ? (
          <HikeCalendar operatorName={operator.companyName} experiences={departures} siteUrl={SITE_URL} />
        ) : (
          <div className="space-y-4" aria-busy="true" aria-label="Loading hike calendar">
            <div className="h-12 w-72 bg-gray-200 animate-pulse" />
            <div className="h-40 bg-gray-200 animate-pulse" />
            <div className="h-20 bg-gray-200 animate-pulse" />
          </div>
        )}
      </div>

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
                <GuideTeamCarousel guides={guides} />
              )}
            </div>

            {/* Reviews */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-6">Customer Reviews</h2>
              <div className="bg-white border border-gray-200 p-8 text-center">
                <p className="font-sans text-sm text-gray-400">No reviews yet. Be the first to book and share your experience.</p>
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

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-sans text-[10px] tracking-[0.15em] uppercase text-white/50 mb-1">{label}</dt>
      <dd className="font-display italic text-3xl">{value}</dd>
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

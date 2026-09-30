'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Footer from '@/components/layout/Footer'
import { CheckCircle, Star, ArrowLeft, Building2 } from 'lucide-react'
import { getOperatorForGuide, GUIDE_TYPE_LABEL, guideTypeOf, type GuideProfile, type OperatorProfile } from '@/lib/operators'
import { getUpcomingExperiences, type TrekkingExperience } from '@/lib/experiences'
import { cleanBioSections, splitGuideName, toParagraphs } from '@/lib/guide-profile'
import { publicSupabase } from '@/lib/supabase-public'
import { formatMoney } from '@/lib/allocation'

const csv = (s?: string) => (s ?? '').split(',').map(x => x.trim()).filter(Boolean)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Tab = 'profile' | 'availability' | 'reviews'
const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'availability', label: 'Availability' },
  { id: 'reviews', label: 'Reviews' },
]

/**
 * Client island rendered inside the server shell (page.tsx), which already
 * resolved `guide` for generateMetadata/JSON-LD and 404s server-side if the
 * id doesn't exist. The associated operator and upcoming departures are
 * fetched here — the operator lookup needs the guide object as input
 * (getOperatorForGuide), and departures are time-sensitive booking data, so
 * both stay client-side. See docs/destination-graph/PHASE_B.md.
 *
 * Layout follows a motorsport driver page: stacked name over the portrait,
 * a stat strip, then tabs over a biography broken into short headed
 * sections, with a details sheet and the booking box alongside. Every story
 * field beyond `bio` is optional, so older profiles render without gaps.
 */
export default function GuideDetail({ guide }: { guide: GuideProfile }) {
  const [operator, setOperator] = useState<OperatorProfile | null>(null)
  const [departures, setDepartures] = useState<TrekkingExperience[]>([])
  const [tab, setTab] = useState<Tab>('profile')

  useEffect(() => {
    // publicSupabase (session-less) — matches the server shell's own read, so
    // a signed-in admin or ops session sees the same page a visitor does
    // rather than one including suspended suppliers. See lib/supabase-public.ts.
    getOperatorForGuide(guide, publicSupabase).then(setOperator)
    getUpcomingExperiences(publicSupabase).then(exps => setDepartures(exps.filter(e => e.leadGuide === guide.name)))
  }, [guide])

  // A #availability or #reviews link opens that tab.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1)
    if (TABS.some(t => t.id === fromHash)) setTab(fromHash as Tab)
  }, [])

  function selectTab(t: Tab) {
    setTab(t)
    history.replaceState(null, '', t === 'profile' ? window.location.pathname : `#${t}`)
  }

  const guideType = guideTypeOf(guide)
  const hasPortrait = Boolean(guide.portrait)
  const { first, last, knownAs } = splitGuideName(guide.name, guide.knownAs)
  const callName = knownAs || first || last
  const languages = csv(guide.languages)
  const specialisations = csv(guide.specialisations || guide.speciality)
  const intro = toParagraphs(guide.bio)
  const sections = cleanBioSections(guide.bioSections)
  const highlight = guide.bioHighlight?.trim()
  const headline = guide.bioHeadline?.trim()
  const expeditions = guide.completedExpeditions || guide.tours || 0
  const blockedDays = (guide.blocked ?? []).filter(d => d >= new Date().toISOString().slice(0, 10)).sort()

  const stats = [
    { label: 'Expeditions', value: expeditions ? `${expeditions}${guide.completedExpeditions ? '+' : ''}` : '—' },
    { label: 'Experience', value: guide.yearsExperience ? `${guide.yearsExperience} yrs` : '—' },
    { label: 'Highest Summit', value: guide.highestSummit || '—' },
    { label: 'Guest Rating', value: guide.rating > 0 ? guide.rating.toFixed(1) : 'New' },
  ]

  const details: { label: string; value: string }[] = [
    ...(operator ? [{ label: 'Operator', value: operator.companyName }] : []),
    ...(operator?.location ? [{ label: 'Base', value: operator.location }] : []),
    { label: 'Guide type', value: GUIDE_TYPE_LABEL[guideType] },
    { label: 'SA Tourism guide no.', value: guide.guideNo || (guideType === 'trainee' ? 'In training' : 'On file') },
    ...(languages.length ? [{ label: 'Languages', value: languages.join(', ') }] : []),
    ...(guide.qualifications ? [{ label: 'Qualifications', value: guide.qualifications }] : []),
    ...(guide.highestSummit ? [{ label: 'Highest summit', value: guide.highestSummit }] : []),
    ...(expeditions ? [{ label: 'Expeditions', value: stats[0].value }] : []),
    ...(guide.yearsExperience ? [{ label: 'Experience', value: `${guide.yearsExperience} years` }] : []),
  ]

  // The highlight sits after the first headed section when there is one, so
  // it breaks up the text; otherwise it follows the introduction.
  const highlightBlock = highlight ? (
    <blockquote className="my-10 border-l-[3px] border-[#C9A96E] pl-6 font-display italic text-2xl lg:text-3xl leading-snug text-black text-balance">
      {highlight}
    </blockquote>
  ) : null

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      {/* Hero: name stacked on the left, portrait filling the right half. The
          expedition count sits behind the text as an outlined figure, the way
          a driver's race number does. */}
      <section className="relative mt-16 overflow-hidden bg-[#1b3f2e] text-white">
        {expeditions > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-6 right-0 lg:right-[42%] font-sans font-extrabold leading-none tracking-tighter text-transparent text-[160px] lg:text-[280px] [-webkit-text-stroke:1.5px_rgba(201,169,110,0.3)]"
          >
            {expeditions}
          </span>
        )}
        <div className="relative max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="px-6 lg:px-12 pt-10 pb-10 lg:pt-14 lg:pb-14">
            <Link href={operator ? `/guides/operators/${operator.id}` : '/guides'} className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors">
              <ArrowLeft size={16} /> {operator ? operator.companyName : 'All Guides'}
            </Link>
            <h1 className="mt-8">
              {first && <span className="block font-sans text-2xl lg:text-3xl leading-tight">{first}</span>}
              <span className="block font-sans font-extrabold uppercase tracking-tight leading-[0.92] text-5xl sm:text-6xl lg:text-8xl break-words">{last}</span>
            </h1>
            {knownAs && <p className="mt-3 font-display italic text-2xl text-[#C9A96E]">“{knownAs}”</p>}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2.5 font-sans text-sm text-white/75">
              <span className="inline-flex items-center gap-1.5 border border-[#C9A96E] px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-[#C9A96E]">
                <CheckCircle size={12} /> Verified
              </span>
              <span className="border border-white/30 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em]">
                {GUIDE_TYPE_LABEL[guideType]} guide
              </span>
              {operator && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={13} /> <span className="text-white">{operator.companyName}</span>
                  {operator.location && <span className="text-white/60">· {operator.location}</span>}
                </span>
              )}
            </div>
          </div>
          {hasPortrait ? (
            <div className="relative min-h-[320px] lg:min-h-[440px]">
              <img
                src={guide.portrait}
                alt={guide.name}
                className="absolute inset-0 w-full h-full object-cover object-[50%_25%]"
              />
              {/* Blends the photo's left edge into the band on wide screens. */}
              <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-[#1b3f2e] via-transparent to-transparent" />
            </div>
          ) : (
            <div className="hidden lg:flex items-center justify-center bg-[#2d6a4f]">
              <span className="font-display italic text-8xl text-white/25">{(first[0] ?? '') + (last[0] ?? '')}</span>
            </div>
          )}
        </div>
      </section>

      {/* Stat strip */}
      <section className="bg-[#2d6a4f] text-white">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`py-5 pr-4 ${i % 2 ? 'pl-4 border-l border-white/15' : ''} ${i > 0 ? 'md:pl-6 md:border-l md:border-white/15' : ''}`}>
              <p className="font-sans font-extrabold text-2xl lg:text-3xl leading-none tabular-nums break-words">{s.value}</p>
              <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-white/70 mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tabs — sticky under the fixed site header */}
      <div className="sticky top-16 z-20 bg-white border-b border-gray-200">
        <div role="tablist" aria-label={`${guide.name} profile`} className="max-w-[1440px] mx-auto px-6 lg:px-12 flex gap-8 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => selectTab(t.id)}
              className={`font-sans text-[13px] font-bold uppercase tracking-[0.1em] whitespace-nowrap pt-4 pb-3 border-b-[3px] transition-colors ${
                tab === t.id ? 'text-black border-[#C9A96E]' : 'text-gray-500 border-transparent hover:text-black'
              }`}
            >
              {t.label}
              {t.id === 'availability' && departures.length > 0 && <span className="ml-1.5 text-[#2d6a4f]">{departures.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-12 lg:gap-20">
          <div className="min-w-0">
            {tab === 'profile' && (
              <article id="panel-profile" role="tabpanel" aria-labelledby="tab-profile" className="max-w-[68ch]">
                {headline && <p className="font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-[#2d6a4f]">Biography</p>}
                <h2 className="font-display italic text-3xl lg:text-4xl text-black mt-2 mb-7 text-balance">{headline || 'Biography'}</h2>

                {intro.length > 0 ? intro.map((p, i) => (
                  <p
                    key={i}
                    className={i === 0
                      ? 'font-sans text-lg lg:text-xl font-medium leading-relaxed text-black mb-5 first-letter:float-left first-letter:font-display first-letter:text-6xl first-letter:leading-[0.8] first-letter:mr-2.5 first-letter:mt-1.5 first-letter:text-[#2d6a4f]'
                      : 'font-sans text-gray-700 leading-relaxed mb-5'}
                  >
                    {p}
                  </p>
                )) : sections.length === 0 && (
                  <p className="font-sans text-gray-500">{callName} hasn&apos;t added a biography yet.</p>
                )}

                {sections.length === 0 && highlightBlock}

                {sections.map((s, i) => (
                  <section key={i}>
                    {s.heading && (
                      <h3 className="mt-10 mb-3 flex items-center gap-3 font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-black after:h-px after:flex-1 after:bg-gray-200">
                        {s.heading}
                      </h3>
                    )}
                    {toParagraphs(s.body).map((p, j) => (
                      <p key={j} className={`font-sans text-gray-700 leading-relaxed mb-5 ${!s.heading && j === 0 ? 'mt-8' : ''}`}>{p}</p>
                    ))}
                    {i === 0 && highlightBlock}
                  </section>
                ))}

                {specialisations.length > 0 && (
                  <>
                    <h3 className="mt-10 mb-3 flex items-center gap-3 font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-black after:h-px after:flex-1 after:bg-gray-200">
                      Specialisations
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {specialisations.map(s => <span key={s} className="bg-[#C9A96E]/15 text-black px-3 py-1.5 font-sans text-sm">{s}</span>)}
                    </div>
                  </>
                )}
              </article>
            )}

            {tab === 'availability' && (
              <div id="panel-availability" role="tabpanel" aria-labelledby="tab-availability">
                <h2 className="font-display italic text-3xl text-black mb-6">Upcoming Availability</h2>
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
                    No scheduled departures with {callName} right now. Request custom dates and the operator will check availability.
                  </p>
                )}
                {blockedDays.length > 0 && (
                  <p className="font-sans text-xs text-gray-400 mt-3">
                    Unavailable: {blockedDays.slice(0, 6).map(formatDate).join(', ')}{blockedDays.length > 6 ? '…' : ''}
                  </p>
                )}
              </div>
            )}

            {tab === 'reviews' && (
              <div id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews">
                <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                  <h2 className="font-display italic text-3xl text-black">Guest Reviews</h2>
                  {guide.rating > 0 && (
                    <div className="flex items-center gap-2">
                      <Star size={18} className="text-[#C9A96E] fill-[#C9A96E]" />
                      <span className="font-display italic text-xl">{guide.rating}</span>
                      <span className="font-sans text-sm text-gray-400">({guide.tours} experiences)</span>
                    </div>
                  )}
                </div>
                <div className="bg-white border border-gray-200 p-8 text-center">
                  <p className="font-sans text-sm text-gray-400">No reviews yet. Be the first to book and share your experience.</p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: details sheet, booking, operator */}
          <aside className="space-y-6 min-w-0">
            <div className="bg-white border border-gray-200">
              <h3 className="px-5 py-3.5 font-sans text-xs font-bold uppercase tracking-[0.14em] border-b-[3px] border-[#2d6a4f]">Guide Details</h3>
              <dl>
                {details.map(d => (
                  <div key={d.label} className="grid grid-cols-[1fr_1.2fr] gap-3 px-5 py-3 border-b border-gray-100 last:border-b-0 font-sans text-sm">
                    <dt className="text-gray-500">{d.label}</dt>
                    <dd className="font-medium text-right break-words">{d.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="px-5 pb-4 pt-1 font-sans text-xs text-gray-500">
                {guideType === 'trainee'
                  ? 'Trainees lead under the supervision of a registered guide. Their operator confirms their training before they are listed publicly.'
                  : 'Registration details are verified by Visit Drakensberg before a guide is listed publicly.'}
              </p>
            </div>

            <div className="bg-[#2d6a4f] text-white p-6">
              <h3 className="font-display italic text-2xl mb-3">Book {callName} for a Private Trip</h3>
              <p className="font-sans text-sm text-white/75 mb-5">
                Request custom dates on any trail. {operator ? operator.companyName : 'The operator'} confirms {callName}&apos;s availability before you pay.
              </p>
              {/* The operator rides along with the guide: /experiences/request
                  can only offer a guide once their operator is selected, so
                  handing it both means the visitor arrives with the pair
                  already chosen instead of having to find them again. */}
              <Link
                href={`/experiences/request?guide=${encodeURIComponent(guide.id)}${operator ? `&operator=${encodeURIComponent(operator.id)}` : ''}`}
                className="block text-center bg-[#C9A96E] text-[#2d2d2d] py-3 font-sans text-sm font-bold hover:bg-[#b8935e] transition-colors"
              >
                Book {callName} →
              </Link>
              <p className="font-sans text-xs text-white/50 mt-3 text-center">
                {callName} stays selected through every step of the request.
              </p>
            </div>

            {/* Associated tour operator — guides always stay linked to their supplier */}
            {operator && (
              <div className="bg-white border border-gray-200 p-5">
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-3">Associated Tour Operator</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative w-12 h-12 bg-[#2d6a4f]/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {operator.logo
                      ? <Image src={operator.logo} alt={operator.companyName} fill loading="lazy" sizes="48px" className="object-cover" />
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
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}

'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import {
  ArrowLeft, CalendarPlus, Users, UserCircle, CheckCircle, Building2,
  Star, ChevronRight, Info,
} from 'lucide-react'
import { supabase } from '@/lib/auth'
import { getTrails, type Trail } from '@/lib/trails'
import { getTours } from '@/lib/tours'
import {
  getOperators, getGuidesByOperator, type OperatorProfile, type GuideProfile,
} from '@/lib/operators'
import { createTripRequest, TRIP_STATUS_LABELS } from '@/lib/custom-trips'

// "Book on Custom Dates" journey: instead of joining a scheduled departure the
// visitor requests a private trip. The platform matches available guides and
// tour operators on trail, dates, certifications, region and availability;
// the request then flows through guide approval → operator approval → quote →
// payment. Never an instant booking.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white'
const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

type OperatorMatch = {
  operator: OperatorProfile
  guides: GuideProfile[]
  runsTrail: boolean
  inRegion: boolean
}

function guideFreeOnDates(g: GuideProfile, start: string, end: string): boolean {
  if (!start || !end) return true
  return !(g.blocked ?? []).some(day => day >= start && day <= end)
}

function RequestContent() {
  const params = useSearchParams()
  const router = useRouter()
  const trailParam = params.get('trail') ?? ''
  const guideParam = params.get('guide') ?? ''

  const [trails, setTrails] = useState<Trail[]>([])
  const [matches, setMatches] = useState<OperatorMatch[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ reference: string } | null>(null)

  const [form, setForm] = useState({
    trailId: trailParam,
    startDate: '',
    endDate: '',
    groupSize: 2,
    operatorId: '',      // selected operator profile id
    guideId: guideParam,
    specialRequests: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getTrails().then(all => setTrails(all.filter(t => t.status === 'published')))
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      const meta = user?.user_metadata ?? {}
      setForm(f => ({
        ...f,
        customerName: f.customerName || meta.full_name || '',
        customerEmail: f.customerEmail || user?.email || '',
      }))
    })
  }, [])

  const trail = trails.find(t => t.id === form.trailId) ?? null

  // Platform search: operators that run tours on this trail, or operate in
  // the trail's region, with each operator's verified guide roster attached.
  useEffect(() => {
    if (!trail) { setMatches([]); return }
    let cancelled = false
    async function match(selected: Trail) {
      const [operators, tours] = await Promise.all([getOperators(), getTours()])
      const operatorIdsOnTrail = new Set(
        tours.filter(t => t.trailId === selected.id && t.status === 'active').map(t => t.supplierId),
      )
      const results: OperatorMatch[] = []
      for (const op of operators) {
        const runsTrail = op.supplierId !== '' && operatorIdsOnTrail.has(op.supplierId)
        const inRegion = op.operatingRegions.includes(selected.region)
        if (!runsTrail && !inRegion && !op.showcase) continue
        const guides = await getGuidesByOperator(op)
        results.push({ operator: op, guides, runsTrail, inRegion })
      }
      results.sort((a, b) => Number(b.runsTrail) - Number(a.runsTrail) || Number(b.inRegion) - Number(a.inRegion))
      if (!cancelled) setMatches(results)
    }
    match(trail)
    return () => { cancelled = true }
  }, [trail])

  const selectedMatch = matches.find(m => m.operator.id === form.operatorId) ?? null
  const selectedGuide = useMemo(() => {
    for (const m of matches) {
      const g = m.guides.find(x => x.id === form.guideId)
      if (g) return g
    }
    return null
  }, [matches, form.guideId])

  function next() {
    setError('')
    if (step === 1) {
      if (!form.trailId) { setError('Choose a hiking trail.'); return }
      if (!form.startDate || !form.endDate) { setError('Choose your preferred start and end dates.'); return }
      if (form.endDate < form.startDate) { setError('The end date must be after the start date.'); return }
      if (form.groupSize < 1) { setError('Group size must be at least 1.'); return }
      setStep(2)
    } else if (step === 2) {
      if (!form.operatorId) { setError('Select a tour operator for your private trip.'); return }
      setStep(3)
    }
  }

  async function submit() {
    setError('')
    if (!form.customerName.trim() || !form.customerEmail.trim()) {
      setError('Your name and email are required.')
      return
    }
    if (!userId) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/experiences/request?trail=${form.trailId}`)}`)
      return
    }
    if (!trail || !selectedMatch) return
    setSubmitting(true)
    try {
      const op = selectedMatch.operator
      const request = await createTripRequest({
        userId,
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim(),
        trailId: trail.id,
        trailName: trail.name,
        region: trail.region,
        startDate: form.startDate,
        endDate: form.endDate,
        groupSize: form.groupSize,
        preferredGuideId: selectedGuide?.id ?? '',
        preferredGuideName: selectedGuide?.name ?? '',
        specialRequests: form.specialRequests.trim(),
        operatorId: UUID_RE.test(op.supplierId) ? op.supplierId : null,
        operatorName: op.companyName,
      })
      setDone({ reference: request.reference })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <main className="max-w-2xl mx-auto px-6 pt-40 pb-24 text-center">
          <div className="w-16 h-16 bg-[#2d6a4f]/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={28} className="text-[#2d6a4f]" />
          </div>
          <h1 className="font-display italic text-4xl text-[#000000] mb-3">Request submitted</h1>
          <p className="font-sans text-sm text-gray-500 mb-2">Reference <span className="text-[#2d6a4f] font-medium">{done.reference}</span></p>
          <p className="font-sans text-sm text-gray-500 max-w-md mx-auto mb-8 leading-relaxed">
            Your request is now <span className="text-[#2d6a4f]">{TRIP_STATUS_LABELS.pending_guide}</span>. The guide confirms availability first,
            then the tour operator reviews the operation and sends you a quote. You'll be notified at every step — this is never an instant booking.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/account/requests" className="bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">
              Track my Requests →
            </Link>
            <Link href={`/hikes/${form.trailId}`} className="border border-[#2d6a4f] text-[#2d6a4f] px-6 py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
              Back to the Trail
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <section className="bg-[#2d6a4f] text-white py-16 px-6 lg:px-12 mt-16">
        <div className="max-w-[900px] mx-auto">
          <Link href={form.trailId ? `/hikes/${form.trailId}` : '/hikes'} className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> {trail ? trail.name : 'All Trails'}
          </Link>
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">Book on Custom Dates</p>
          <h1 className="font-display italic text-4xl lg:text-5xl mb-3">Request a Private Trip</h1>
          <p className="font-sans text-sm text-white/60 max-w-2xl">
            Tell us when you want to hike and we'll match you with available guides and tour operators.
            The guide and the operator both approve your request before a quote is issued.
          </p>
        </div>
      </section>

      {/* Step indicator */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[900px] mx-auto px-6 lg:px-12 py-4 flex items-center gap-2 font-sans text-xs overflow-x-auto">
          {[
            { n: 1, label: 'Trip Details' },
            { n: 2, label: 'Guides & Operators' },
            { n: 3, label: 'Review & Submit' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 shrink-0">
              {i > 0 && <ChevronRight size={13} className="text-gray-300" />}
              <span className={`flex items-center gap-2 px-3 py-1.5 ${step === s.n ? 'bg-[#2d6a4f] text-white' : step > s.n ? 'text-[#2d6a4f]' : 'text-gray-400'}`}>
                <span className={`w-5 h-5 flex items-center justify-center text-[10px] border ${step === s.n ? 'border-white/50' : step > s.n ? 'border-[#2d6a4f] bg-[#2d6a4f]/10' : 'border-gray-300'}`}>
                  {step > s.n ? '✓' : s.n}
                </span>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-[900px] mx-auto px-6 lg:px-12 py-12">
        {step === 1 && (
          <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
            <div>
              <label className={labelCls}>Hiking Trail</label>
              <select value={form.trailId} onChange={e => set('trailId', e.target.value)} className={inputCls}>
                <option value="">Select a trail…</option>
                {trails.map(t => (
                  <option key={t.id} value={t.id}>{t.name} — {t.region} ({t.difficulty})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Preferred Start Date</label>
                <input type="date" value={form.startDate} min={new Date().toISOString().slice(0, 10)} onChange={e => set('startDate', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Preferred End Date</label>
                <input type="date" value={form.endDate} min={form.startDate || new Date().toISOString().slice(0, 10)} onChange={e => set('endDate', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Group Size</label>
              <input type="number" min={1} max={30} value={form.groupSize} onChange={e => set('groupSize', Math.max(1, +e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Special Requests (optional)</label>
              <textarea rows={3} value={form.specialRequests} onChange={e => set('specialRequests', e.target.value)}
                placeholder="Dietary requirements, photography stops, fitness considerations…" className={`${inputCls} resize-none`} />
            </div>
            {error && <p className="font-sans text-sm text-red-500">{error}</p>}
            <button onClick={next} className="bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">
              Find Available Guides & Operators →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 bg-[#2d6a4f]/5 border border-[#2d6a4f]/20 px-4 py-3">
              <Info size={14} className="text-[#2d6a4f] mt-0.5 shrink-0" />
              <p className="font-sans text-xs text-gray-600 leading-relaxed">
                Matched on trail, region, certifications and availability for {form.startDate} → {form.endDate}.
                Select a tour operator and, optionally, a preferred guide. Guides shown as unavailable have blocked these dates.
              </p>
            </div>

            {matches.length === 0 && (
              <div className="bg-white border border-gray-200 py-16 text-center">
                <Building2 size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="font-sans text-sm text-gray-500">No operators currently service this trail. Try different dates or another trail.</p>
              </div>
            )}

            {matches.map(m => {
              const opSelected = form.operatorId === m.operator.id
              return (
                <div key={m.operator.id} className={`bg-white border p-5 ${opSelected ? 'border-[#2d6a4f]' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-[#2d6a4f]/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {m.operator.logo
                          ? <img src={m.operator.logo} alt="" className="w-full h-full object-cover" />
                          : <Building2 size={18} className="text-[#2d6a4f]" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-display italic text-lg">{m.operator.companyName}</p>
                          {m.runsTrail && <span className="font-sans text-[10px] tracking-[0.08em] uppercase px-2 py-0.5 bg-[#2d6a4f]/10 text-[#2d6a4f]">Runs this trail</span>}
                        </div>
                        <p className="font-sans text-xs text-gray-500 mt-0.5">{m.operator.location} · {m.operator.yearsOperating} years operating</p>
                        <div className="flex items-center gap-3 mt-1 font-sans text-xs text-gray-400 flex-wrap">
                          {m.operator.certifications.slice(0, 3).map(c => <span key={c}>{c}</span>)}
                          {m.operator.rating !== null && (
                            <span className="flex items-center gap-1 text-[#C9A96E]">
                              <Star size={11} className="fill-[#C9A96E]" /> {m.operator.rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setForm(f => ({ ...f, operatorId: m.operator.id, guideId: '' }))}
                      className={`font-sans text-sm px-5 py-2.5 transition-colors shrink-0 ${opSelected ? 'bg-[#2d6a4f] text-white' : 'border border-[#2d6a4f] text-[#2d6a4f] hover:bg-[#2d6a4f] hover:text-white'}`}
                    >
                      {opSelected ? '✓ Selected' : 'Select Operator'}
                    </button>
                  </div>

                  {opSelected && m.guides.length > 0 && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <p className={labelCls}>Preferred Guide (optional)</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {m.guides.map(g => {
                          const free = guideFreeOnDates(g, form.startDate, form.endDate)
                          const gSelected = form.guideId === g.id
                          return (
                            <button
                              key={g.id}
                              disabled={!free}
                              onClick={() => set('guideId', gSelected ? '' : g.id)}
                              className={`text-left p-3 border transition-colors ${!free ? 'border-gray-100 opacity-50 cursor-not-allowed' : gSelected ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 hover:border-[#2d6a4f]'}`}
                            >
                              <p className="font-sans text-sm font-medium flex items-center gap-1.5">
                                <UserCircle size={13} className="text-[#2d6a4f]" /> {g.name}
                                {gSelected && <CheckCircle size={12} className="text-[#2d6a4f]" />}
                              </p>
                              <p className="font-sans text-xs text-gray-400 mt-0.5">{g.certs}{g.speciality ? ` · ${g.speciality}` : ''}</p>
                              {!free && <p className="font-sans text-[10px] text-red-400 mt-1">Unavailable on these dates</p>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {error && <p className="font-sans text-sm text-red-500">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="border border-gray-300 text-gray-600 px-6 py-3 font-sans text-sm hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">← Back</button>
              <button onClick={next} className="bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">Review Request →</button>
            </div>
          </div>
        )}

        {step === 3 && trail && selectedMatch && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
              <h2 className="font-display italic text-2xl">Your details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input value={form.customerName} onChange={e => set('customerName', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.customerEmail} onChange={e => set('customerEmail', e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Phone (optional)</label>
                <input value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)} className={inputCls} />
              </div>

              {!userId && (
                <div className="flex items-start gap-2.5 bg-[#C9A96E]/10 border border-[#C9A96E]/30 px-4 py-3">
                  <Info size={14} className="text-[#8B6914] mt-0.5 shrink-0" />
                  <p className="font-sans text-xs text-gray-600">You'll be asked to sign in before the request is submitted, so you can track approvals and receive your quote.</p>
                </div>
              )}

              {error && <p className="font-sans text-sm text-red-500">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="border border-gray-300 text-gray-600 px-6 py-3 font-sans text-sm hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">← Back</button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex-1 bg-[#C9A96E] text-[#2d2d2d] px-6 py-3 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit Request →'}
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 p-5 h-fit">
              <h3 className="font-display italic text-xl mb-4 flex items-center gap-2"><CalendarPlus size={16} className="text-[#C9A96E]" /> Request Summary</h3>
              <div className="space-y-3 font-sans text-sm">
                <div className="flex justify-between gap-4"><span className="text-gray-400">Trail</span><span className="text-right">{trail.name}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-400">Region</span><span className="text-right">{trail.region}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-400">Dates</span><span className="text-right">{form.startDate} → {form.endDate}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-400"><Users size={12} className="inline mr-1 -mt-0.5" />Group</span><span>{form.groupSize}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gray-400">Operator</span><span className="text-right">{selectedMatch.operator.companyName}</span></div>
                {selectedGuide && <div className="flex justify-between gap-4"><span className="text-gray-400">Preferred Guide</span><span className="text-right">{selectedGuide.name}</span></div>}
                {form.specialRequests && <div><span className="text-gray-400 block mb-1">Special Requests</span><span className="text-xs text-gray-600">{form.specialRequests}</span></div>}
              </div>
              <div className="border-t border-gray-100 mt-4 pt-4">
                <p className="font-sans text-[11px] text-gray-400 leading-relaxed">
                  Next: guide approval → operator approval → quote → payment. You only pay once you accept the quote.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default function CustomDateRequestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F5F2]" />}>
      <RequestContent />
    </Suspense>
  )
}

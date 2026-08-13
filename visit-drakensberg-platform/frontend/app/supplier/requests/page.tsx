'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  CalendarPlus, Users, UserCircle, CheckCircle, XCircle, FileText, Clock,
  AlertTriangle,
} from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { getSupplierEntities } from '@/lib/supplier-entities'
import type { GuideProfile } from '@/lib/operators'
import {
  getTripRequests, approveGuideAvailability, issueQuote, rejectTripRequest,
  isGuideAvailable, TRIP_STATUS_LABELS, type TripRequest, type TripRequestStatus,
} from '@/lib/custom-trips'

// Tour operator side of the custom-date booking workflow:
//   1. Guide approval — validated against the guide's blocked dates and other
//      active requests before it can be granted.
//   2. Operational approval — issues the quote; the operator may propose
//      alternative dates, guide, pricing or itinerary instead of a plain yes.

const STATUS_STYLE: Record<TripRequestStatus, string> = {
  draft: 'bg-gray-100 text-gray-500',
  pending_guide: 'bg-amber-100 text-amber-700',
  pending_operator: 'bg-amber-100 text-amber-700',
  quote_ready: 'bg-[#C9A96E]/15 text-[#8B6914]',
  awaiting_payment: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-100 text-red-600',
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

type QuoteForm = {
  pricePerPerson: string
  notes: string
  validDays: number
  alternativeStartDate: string
  alternativeEndDate: string
  alternativeGuide: string
  alternativeItinerary: string
}

const EMPTY_QUOTE: QuoteForm = {
  pricePerPerson: '', notes: '', validDays: 7,
  alternativeStartDate: '', alternativeEndDate: '', alternativeGuide: '', alternativeItinerary: '',
}

export default function SupplierRequestsPage() {
  const [requests, setRequests] = useState<TripRequest[]>([])
  const [guides, setGuides] = useState<GuideProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [quotingId, setQuotingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [quote, setQuote] = useState<QuoteForm>(EMPTY_QUOTE)
  const [rejectReason, setRejectReason] = useState('')
  const [approveGuideName, setApproveGuideName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const [reqs, myGuides] = await Promise.all([
        getTripRequests(),
        getSupplierEntities<GuideProfile>('guides', effectiveSupplierId(user.id)),
      ])
      setRequests(reqs.filter(r => r.operatorId === user.id))
      setGuides(myGuides)
      setLoading(false)
    })
  }, [])

  function replace(updated: TripRequest) {
    setRequests(rs => rs.map(r => (r.id === updated.id ? updated : r)))
  }

  function guideStatusFor(r: TripRequest, name: string): { ok: boolean; reason?: string } {
    const guide = guides.find(g => g.name === name)
    if (!guide) return { ok: true } // external / unlisted guide: operator's call
    if (guide.status !== 'verified') return { ok: false, reason: 'Guide is not verified yet' }
    if (!isGuideAvailable({ name: guide.name, blocked: guide.blocked }, r.startDate, r.endDate, requests)) {
      return { ok: false, reason: 'Guide is blocked or already committed on these dates' }
    }
    return { ok: true }
  }

  async function handleApproveGuide(r: TripRequest) {
    const name = approveGuideName || r.preferredGuideName
    if (!name.trim()) { toast.error('Assign a guide before approving.'); return }
    const check = guideStatusFor(r, name)
    if (!check.ok) { toast.error(check.reason || 'Guide unavailable.'); return }
    setBusy(r.id)
    try {
      replace(await approveGuideAvailability(r, name))
      setApprovingId(null)
      setApproveGuideName('')
      toast.success('Guide availability confirmed.')
    } catch { toast.error('Could not update the request.') }
    finally { setBusy(null) }
  }

  async function handleQuote(r: TripRequest) {
    const pp = Number(quote.pricePerPerson)
    if (!pp || pp <= 0) { toast.error('Enter a price per person.'); return }
    setBusy(r.id)
    try {
      const validUntil = new Date()
      validUntil.setDate(validUntil.getDate() + (quote.validDays || 7))
      replace(await issueQuote(r, {
        pricePerPerson: pp,
        total: pp * r.groupSize,
        notes: quote.notes.trim(),
        validUntil: validUntil.toISOString().slice(0, 10),
        alternativeStartDate: quote.alternativeStartDate || undefined,
        alternativeEndDate: quote.alternativeEndDate || undefined,
        alternativeGuide: quote.alternativeGuide || undefined,
        alternativeItinerary: quote.alternativeItinerary || undefined,
      }))
      setQuotingId(null)
      setQuote(EMPTY_QUOTE)
      toast.success('Quote sent to the customer.')
    } catch { toast.error('Could not send the quote.') }
    finally { setBusy(null) }
  }

  async function handleReject(r: TripRequest) {
    setBusy(r.id)
    try {
      replace(await rejectTripRequest(r, rejectReason.trim()))
      setRejectingId(null)
      setRejectReason('')
      toast.success('Request declined.')
    } catch { toast.error('Could not update the request.') }
    finally { setBusy(null) }
  }

  const open = requests.filter(r => ['pending_guide', 'pending_operator', 'quote_ready', 'awaiting_payment'].includes(r.status))
  const closed = requests.filter(r => !open.includes(r))

  function card(r: TripRequest) {
    const preferredCheck = r.preferredGuideName ? guideStatusFor(r, r.preferredGuideName) : { ok: true }
    return (
      <div key={r.id} className="bg-white rounded-xl border border-black/8 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-sans font-semibold text-black/90">{r.trailName}</p>
              <span className={`font-sans text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>{TRIP_STATUS_LABELS[r.status]}</span>
            </div>
            <p className="font-sans text-xs text-black/40">
              {r.reference} · {r.startDate} → {r.endDate} · <Users size={11} className="inline -mt-0.5" /> {r.groupSize} guest{r.groupSize !== 1 ? 's' : ''}
            </p>
            <p className="font-sans text-xs text-black/40 mt-1">
              {r.customerName} · {r.customerEmail}{r.customerPhone ? ` · ${r.customerPhone}` : ''}
            </p>
            {r.preferredGuideName && (
              <p className="font-sans text-xs text-black/50 mt-1 flex items-center gap-1">
                <UserCircle size={11} className="text-[#C9A96E]" /> Preferred guide: {r.preferredGuideName}
                {!preferredCheck.ok && (
                  <span className="text-red-500 flex items-center gap-1 ml-1"><AlertTriangle size={10} /> {preferredCheck.reason}</span>
                )}
              </p>
            )}
            {r.specialRequests && <p className="font-sans text-xs text-black/40 mt-1 italic">"{r.specialRequests}"</p>}
          </div>
          {r.quote && (
            <div className="text-right shrink-0">
              <p className="font-sans font-semibold text-[#C9A96E]">R {r.quote.total.toLocaleString()}</p>
              <p className="font-sans text-[10px] text-black/30">quoted · valid until {r.quote.validUntil}</p>
            </div>
          )}
        </div>

        {/* Step 1: guide availability approval */}
        {r.status === 'pending_guide' && (
          <div className="mt-4 border-t border-black/5 pt-4">
            {approvingId === r.id ? (
              <div className="space-y-3">
                <div>
                  <label className="font-sans text-xs font-medium text-black/60 block mb-1.5">Assign guide (availability is validated)</label>
                  <select
                    value={approveGuideName || r.preferredGuideName}
                    onChange={e => setApproveGuideName(e.target.value)}
                    className={inp}
                  >
                    <option value="">Select a guide…</option>
                    {guides.map(g => {
                      const check = guideStatusFor(r, g.name)
                      return <option key={g.id} value={g.name} disabled={!check.ok}>{g.name}{!check.ok ? ` — ${check.reason}` : ''}</option>
                    })}
                    {r.preferredGuideName && !guides.some(g => g.name === r.preferredGuideName) && (
                      <option value={r.preferredGuideName}>{r.preferredGuideName} (requested)</option>
                    )}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApproveGuide(r)} disabled={busy === r.id}
                    className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] disabled:opacity-50">
                    <CheckCircle size={13} className="inline mr-1 -mt-0.5" />Confirm Guide Availability
                  </button>
                  <button onClick={() => setApprovingId(null)} className="font-sans text-sm px-4 py-2 border border-black/10 rounded-lg text-black/50">Back</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => { setApprovingId(r.id); setApproveGuideName(r.preferredGuideName) }}
                  className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d]">
                  Approve Guide Availability
                </button>
                <button onClick={() => setRejectingId(r.id)} className="font-sans text-sm px-4 py-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">Decline</button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: operational approval + quote (with alternatives) */}
        {r.status === 'pending_operator' && (
          <div className="mt-4 border-t border-black/5 pt-4">
            {quotingId === r.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-sans text-xs font-medium text-black/60 block mb-1.5">Price per person (R)</label>
                    <input type="number" value={quote.pricePerPerson} onChange={e => setQuote(q => ({ ...q, pricePerPerson: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="font-sans text-xs font-medium text-black/60 block mb-1.5">Quote valid for (days)</label>
                    <input type="number" min={1} value={quote.validDays} onChange={e => setQuote(q => ({ ...q, validDays: +e.target.value }))} className={inp} />
                  </div>
                </div>
                <div>
                  <label className="font-sans text-xs font-medium text-black/60 block mb-1.5">Notes to customer</label>
                  <textarea rows={2} value={quote.notes} onChange={e => setQuote(q => ({ ...q, notes: e.target.value }))} className={`${inp} resize-none`} placeholder="What the price includes, meeting logistics…" />
                </div>
                <details>
                  <summary className="font-sans text-xs text-black/40 cursor-pointer hover:text-black/70">Propose alternatives (dates / guide / itinerary)</summary>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="font-sans text-xs font-medium text-black/60 block mb-1.5">Alternative start</label>
                      <input type="date" value={quote.alternativeStartDate} onChange={e => setQuote(q => ({ ...q, alternativeStartDate: e.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className="font-sans text-xs font-medium text-black/60 block mb-1.5">Alternative end</label>
                      <input type="date" value={quote.alternativeEndDate} onChange={e => setQuote(q => ({ ...q, alternativeEndDate: e.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className="font-sans text-xs font-medium text-black/60 block mb-1.5">Alternative guide</label>
                      <input value={quote.alternativeGuide} onChange={e => setQuote(q => ({ ...q, alternativeGuide: e.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className="font-sans text-xs font-medium text-black/60 block mb-1.5">Itinerary change</label>
                      <input value={quote.alternativeItinerary} onChange={e => setQuote(q => ({ ...q, alternativeItinerary: e.target.value }))} className={inp} placeholder="e.g. reverse route, add rest day" />
                    </div>
                  </div>
                </details>
                {Number(quote.pricePerPerson) > 0 && (
                  <p className="font-sans text-xs text-black/50">Total for {r.groupSize} guest{r.groupSize !== 1 ? 's' : ''}: <span className="font-semibold text-[#C9A96E]">R {(Number(quote.pricePerPerson) * r.groupSize).toLocaleString()}</span></p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => handleQuote(r)} disabled={busy === r.id}
                    className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] disabled:opacity-50">
                    <FileText size={13} className="inline mr-1 -mt-0.5" />Approve & Send Quote
                  </button>
                  <button onClick={() => setQuotingId(null)} className="font-sans text-sm px-4 py-2 border border-black/10 rounded-lg text-black/50">Back</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => { setQuotingId(r.id); setQuote(EMPTY_QUOTE) }}
                  className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d]">
                  Operational Approval + Quote
                </button>
                <button onClick={() => setRejectingId(r.id)} className="font-sans text-sm px-4 py-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">Decline</button>
              </div>
            )}
          </div>
        )}

        {/* Reject flow */}
        {rejectingId === r.id && (
          <div className="mt-4 border-t border-black/5 pt-4 space-y-3">
            <textarea rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              className={`${inp} resize-none`} placeholder="Reason shared with the customer (optional)…" />
            <div className="flex gap-2">
              <button onClick={() => handleReject(r)} disabled={busy === r.id}
                className="bg-red-500 text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50">
                <XCircle size={13} className="inline mr-1 -mt-0.5" />Decline Request
              </button>
              <button onClick={() => { setRejectingId(null); setRejectReason('') }} className="font-sans text-sm px-4 py-2 border border-black/10 rounded-lg text-black/50">Back</button>
            </div>
          </div>
        )}

        {r.status === 'awaiting_payment' && (
          <p className="mt-3 font-sans text-xs text-blue-600 flex items-center gap-1.5"><Clock size={12} /> Customer accepted the quote — awaiting payment.</p>
        )}
        {r.status === 'confirmed' && (
          <p className="mt-3 font-sans text-xs text-emerald-600 flex items-center gap-1.5"><CheckCircle size={12} /> Paid and confirmed. Contact the customer to finalise logistics.</p>
        )}
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <CalendarPlus size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Custom Trip Requests</h1>
      </div>
      <p className="font-sans text-sm text-black/40 -mt-3">
        Private-date requests from visitors. Confirm your guide's availability first, then give operational approval with a quote — or propose alternative dates, guide, pricing or itinerary.
      </p>

      {loading ? (
        <p className="font-sans text-sm text-black/30 py-8 text-center">Loading requests…</p>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-black/8 py-16 text-center">
          <CalendarPlus size={32} className="text-black/15 mx-auto mb-3" />
          <p className="font-sans text-sm text-black/30">No custom trip requests yet</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3">{open.map(card)}</div>
          {closed.length > 0 && (
            <>
              <p className="font-sans text-xs tracking-[0.12em] uppercase text-black/30 pt-4">Closed</p>
              <div className="grid gap-3 opacity-70">{closed.map(card)}</div>
            </>
          )}
        </>
      )}
    </div>
  )
}

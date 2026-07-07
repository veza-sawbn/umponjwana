'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Footer from '@/components/layout/Footer'
import toast from 'react-hot-toast'
import {
  ArrowLeft, CalendarPlus, Users, Clock, CheckCircle, XCircle, CreditCard,
  FileText, UserCircle, Building2,
} from 'lucide-react'
import { supabase } from '@/lib/auth'
import {
  getTripRequests, acceptQuote, confirmTripPayment, cancelTripRequest,
  TRIP_STATUS_LABELS, type TripRequest, type TripRequestStatus,
} from '@/lib/custom-trips'

const STATUS_STYLE: Record<TripRequestStatus, string> = {
  draft: 'bg-gray-100 text-gray-500',
  pending_guide: 'bg-amber-50 text-amber-700',
  pending_operator: 'bg-amber-50 text-amber-700',
  quote_ready: 'bg-[#C9A96E]/15 text-[#8B6914]',
  awaiting_payment: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-50 text-red-600',
}

const FLOW: TripRequestStatus[] = ['pending_guide', 'pending_operator', 'quote_ready', 'awaiting_payment', 'confirmed']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MyRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<TripRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login?redirect=/account/requests'); return }
      setRequests((await getTripRequests()).filter(r => r.userId === user.id))
      setLoading(false)
    })
  }, [router])

  function replace(updated: TripRequest) {
    setRequests(rs => rs.map(r => (r.id === updated.id ? updated : r)))
  }

  async function handleAccept(r: TripRequest) {
    setBusy(r.id)
    try {
      replace(await acceptQuote(r))
      toast.success('Quote accepted — please complete payment.')
    } catch { toast.error('Could not accept the quote. Please try again.') }
    finally { setBusy(null) }
  }

  async function handlePay(r: TripRequest) {
    setBusy(r.id)
    try {
      // Payment integration is deliberately deferred platform-wide (see
      // checkout) — this mirrors the same simulated payment step.
      await new Promise(res => setTimeout(res, 900))
      replace(await confirmTripPayment(r))
      setPayingId(null)
      toast.success('Payment received — your private trip is confirmed!')
    } catch { toast.error('Payment could not be processed. Please try again.') }
    finally { setBusy(null) }
  }

  async function handleCancel(r: TripRequest) {
    setBusy(r.id)
    try {
      replace(await cancelTripRequest(r))
      toast.success('Request cancelled.')
    } catch { toast.error('Could not cancel the request.') }
    finally { setBusy(null) }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <section className="bg-[#2d6a4f] text-white py-16 px-6 lg:px-12 mt-16">
        <div className="max-w-[1000px] mx-auto">
          <Link href="/account" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> My Account
          </Link>
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">Custom Date Bookings</p>
          <h1 className="font-display italic text-4xl lg:text-5xl">My Trip Requests</h1>
        </div>
      </section>

      <main className="max-w-[1000px] mx-auto px-6 lg:px-12 py-12 space-y-4">
        {loading ? (
          <div className="py-20 text-center font-sans text-sm text-gray-400">Loading requests…</div>
        ) : requests.length === 0 ? (
          <div className="bg-white border border-gray-200 py-20 text-center">
            <CalendarPlus size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="font-sans text-sm text-gray-500 mb-6">No private trip requests yet.</p>
            <Link href="/hikes" className="border border-[#2d6a4f] text-[#2d6a4f] px-6 py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
              Browse Hiking Trails
            </Link>
          </div>
        ) : requests.map(r => {
          const activeIdx = FLOW.indexOf(r.status)
          const dead = r.status === 'cancelled' || r.status === 'rejected'
          return (
            <div key={r.id} className="bg-white border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="font-display italic text-xl">{r.trailName}</h2>
                    <span className={`font-sans text-[10px] tracking-[0.08em] uppercase px-2.5 py-1 ${STATUS_STYLE[r.status]}`}>
                      {TRIP_STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  <p className="font-sans text-xs text-gray-400">
                    {r.reference} · {formatDate(r.startDate)} → {formatDate(r.endDate)} ·{' '}
                    <Users size={11} className="inline -mt-0.5" /> {r.groupSize} guest{r.groupSize !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-4 mt-1.5 font-sans text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><Building2 size={11} className="text-[#2d6a4f]" /> {r.operatorName || 'Operator being assigned'}</span>
                    {r.preferredGuideName && <span className="flex items-center gap-1"><UserCircle size={11} className="text-[#2d6a4f]" /> {r.preferredGuideName}</span>}
                  </div>
                </div>
                {r.quote && !dead && (
                  <div className="text-right shrink-0">
                    <p className="font-display italic text-2xl text-[#2d6a4f]">R {r.quote.total.toLocaleString()}</p>
                    <p className="font-sans text-[10px] text-gray-400">R {r.quote.pricePerPerson.toLocaleString()} pp · quote valid until {formatDate(r.quote.validUntil)}</p>
                  </div>
                )}
              </div>

              {/* Progress */}
              {!dead && (
                <div className="flex items-center gap-1 mb-4 overflow-x-auto">
                  {FLOW.map((s, i) => (
                    <div key={s} className="flex items-center gap-1 shrink-0">
                      {i > 0 && <div className={`w-6 h-px ${i <= activeIdx ? 'bg-[#2d6a4f]' : 'bg-gray-200'}`} />}
                      <span className={`font-sans text-[10px] px-2 py-1 whitespace-nowrap ${i < activeIdx ? 'text-[#2d6a4f]' : i === activeIdx ? 'bg-[#2d6a4f] text-white' : 'text-gray-300'}`}>
                        {i < activeIdx ? '✓ ' : ''}{TRIP_STATUS_LABELS[s]}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Quote details incl. operator alternatives */}
              {r.quote && (r.status === 'quote_ready' || r.status === 'awaiting_payment') && (
                <div className="bg-[#F7F5F2] border border-gray-200 p-4 mb-4">
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2 flex items-center gap-1.5"><FileText size={11} /> Quote from {r.operatorName}</p>
                  {r.quote.notes && <p className="font-sans text-sm text-gray-700 leading-relaxed mb-2">{r.quote.notes}</p>}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 font-sans text-xs text-gray-500">
                    {(r.quote.alternativeStartDate || r.quote.alternativeEndDate) && (
                      <span>Alternative dates proposed: {r.quote.alternativeStartDate || r.startDate} → {r.quote.alternativeEndDate || r.endDate}</span>
                    )}
                    {r.quote.alternativeGuide && <span>Alternative guide: {r.quote.alternativeGuide}</span>}
                    {r.quote.alternativeItinerary && <span>Itinerary change: {r.quote.alternativeItinerary}</span>}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <details className="mb-4">
                <summary className="font-sans text-xs text-gray-400 cursor-pointer hover:text-[#2d6a4f]">History ({(r.timeline ?? []).length})</summary>
                <div className="mt-2 space-y-1.5 pl-1">
                  {(r.timeline ?? []).map((t, i) => (
                    <p key={i} className="font-sans text-xs text-gray-500 flex items-center gap-2">
                      <Clock size={10} className="text-gray-300" />
                      {new Date(t.at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      — {TRIP_STATUS_LABELS[t.status]}{t.note ? ` · ${t.note}` : ''}
                    </p>
                  ))}
                </div>
              </details>

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                {r.status === 'quote_ready' && (
                  <button
                    onClick={() => handleAccept(r)}
                    disabled={busy === r.id}
                    className="bg-[#C9A96E] text-[#2d2d2d] px-5 py-2.5 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors disabled:opacity-50"
                  >
                    <CheckCircle size={13} className="inline mr-1.5 -mt-0.5" />Accept Quote
                  </button>
                )}
                {r.status === 'awaiting_payment' && payingId !== r.id && (
                  <button
                    onClick={() => setPayingId(r.id)}
                    className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors"
                  >
                    <CreditCard size={13} className="inline mr-1.5 -mt-0.5" />Pay R {r.quote?.total.toLocaleString() ?? ''}
                  </button>
                )}
                {payingId === r.id && r.status === 'awaiting_payment' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans text-xs text-gray-500">Confirm payment of R {r.quote?.total.toLocaleString()}?</span>
                    <button
                      onClick={() => handlePay(r)}
                      disabled={busy === r.id}
                      className="bg-[#2d6a4f] text-white px-4 py-2 font-sans text-xs hover:bg-[#235a3f] transition-colors disabled:opacity-50"
                    >
                      {busy === r.id ? 'Processing…' : 'Confirm & Pay'}
                    </button>
                    <button onClick={() => setPayingId(null)} className="font-sans text-xs text-gray-400 hover:text-gray-600">Back</button>
                  </div>
                )}
                {['pending_guide', 'pending_operator', 'quote_ready', 'awaiting_payment'].includes(r.status) && (
                  <button
                    onClick={() => handleCancel(r)}
                    disabled={busy === r.id}
                    className="font-sans text-sm text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    <XCircle size={13} className="inline mr-1 -mt-0.5" />Cancel Request
                  </button>
                )}
                {r.status === 'confirmed' && (
                  <p className="font-sans text-sm text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle size={14} /> Your private trip is confirmed. The operator will contact you with final logistics.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </main>

      <Footer />
    </div>
  )
}

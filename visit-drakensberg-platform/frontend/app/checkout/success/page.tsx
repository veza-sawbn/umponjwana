'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Footer from '@/components/layout/Footer'
import { CheckCircle, Download, Calendar, MapPin, Users, ArrowRight, Mail, Mountain, Bus, Printer, CreditCard, Loader2 } from 'lucide-react'
import { getBookingById, type SavedBooking } from '@/lib/bookings'
import { formatMoney } from '@/lib/allocation'

function fmt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtLong(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function SuccessInner() {
  const params = useSearchParams()
  const id = params.get('id')
  const paymentResult = params.get('payment') // success|failed|cancelled
  const [booking, setBooking] = useState<SavedBooking | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

  const load = useCallback((bookingId: string) => {
    return getBookingById(bookingId).then(b => { setBooking(b); return b })
  }, [])

  useEffect(() => {
    if (!id) { setLoading(false); return }
    load(id).finally(() => setLoading(false))
  }, [id, load])

  // A successful gateway redirect can arrive slightly before the webhook has
  // reconciled the payment — poll briefly so this updates without a manual
  // refresh, instead of just trusting the redirect itself.
  useEffect(() => {
    if (paymentResult !== 'success' || !id) return
    let attempts = 0
    const interval = setInterval(async () => {
      attempts += 1
      const b = await load(id)
      if ((b && b.status === 'confirmed') || attempts >= 6) clearInterval(interval)
    }, 2500)
    return () => clearInterval(interval)
  }, [paymentResult, id, load])

  async function payNow() {
    if (!id) return
    setPaying(true)
    try {
      const res = await fetch('/api/payments/ikhokha/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: id }),
      })
      const json = await res.json()
      if (!res.ok || !json.paylinkUrl) throw new Error(json.error || 'Could not start payment')
      window.location.href = json.paylinkUrl
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start payment')
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center">
        <div className="text-center">
          <p className="font-sans text-sm text-black/40 mb-4">Booking not found.</p>
          <Link href="/account" className="font-sans text-sm text-[#2d6a4f] hover:underline">Go to My Bookings</Link>
        </div>
      </div>
    )
  }

  if (booking.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="font-sans text-sm text-gray-600 mb-4">
            Booking {booking.reference} was cancelled and is no longer awaiting payment.
          </p>
          <Link href="/account" className="font-sans text-sm text-[#2d6a4f] hover:underline">Go to My Bookings</Link>
        </div>
      </div>
    )
  }

  if (booking.status !== 'confirmed') {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white border border-gray-200 p-8 text-center">
          <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-gray-400 block mb-2">Booking {booking.reference}</span>
          {paymentResult === 'success' ? (
            <>
              <Loader2 size={28} className="animate-spin text-[#2d6a4f] mx-auto mb-4" />
              <h1 className="font-display italic text-2xl text-[#000000] mb-2">Confirming your payment…</h1>
              <p className="font-sans text-sm text-gray-500 leading-relaxed">
                Payment received — confirming with the bank. This page will update automatically.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display italic text-2xl text-[#000000] mb-2">
                {paymentResult === 'failed' ? "Payment didn't go through" : paymentResult === 'cancelled' ? 'Payment cancelled' : 'Complete your payment'}
              </h1>
              <p className="font-sans text-sm text-gray-500 leading-relaxed mb-6">
                Your booking is on hold — the room/seats are reserved, but it won&apos;t be confirmed until payment succeeds.
              </p>
              <button
                onClick={payNow}
                disabled={paying}
                className="inline-flex items-center gap-2 bg-[#C9A96E] text-[#1a1a1a] px-6 py-3 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors disabled:opacity-60"
              >
                <CreditCard size={14} /> {paying ? 'Redirecting…' : `Pay ${formatMoney(booking.total)}`}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <div className="print:hidden">
      </div>

      <section className="bg-[#2d6a4f] text-white pt-32 pb-16 px-6 lg:px-12 print:pt-8 print:pb-8">
        <div className="max-w-[1440px] mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 mb-6 print:hidden">
            <CheckCircle size={32} className="text-[#C9A96E]" />
          </div>
          <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-white/60 block mb-3">Booking Confirmed</span>
          <h1 className="font-display italic text-5xl lg:text-6xl mb-4">You&apos;re all booked!</h1>
          <p className="font-sans text-lg text-white/60 max-w-lg mx-auto print:hidden">
            A confirmation has been saved to your account. Bring your booking reference to check-in.
          </p>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: booking details */}
          <div className="lg:col-span-2 space-y-6">

            {/* Reference + PDF */}
            <div className="bg-white border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-gray-400 block mb-2">Booking Reference</span>
                  <p className="font-display italic text-4xl text-[#2d6a4f] tracking-widest">{booking.reference}</p>
                  <p className="font-sans text-xs text-gray-400 mt-2">
                    Booked {fmt(booking.createdAt)} · {booking.customerName}
                  </p>
                </div>
                <button
                  onClick={() => window.open(`/itinerary/${booking.id}/print`, '_blank')}
                  className="print:hidden shrink-0 flex items-center gap-2 border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
                >
                  <Printer size={13} />
                  Print Itinerary / PDF
                </button>
              </div>
            </div>

            {/* Hike departures */}
            {booking.addons.length > 0 && (
              <div className="bg-white border border-gray-200 p-6">
                <h2 className="font-display italic text-2xl text-[#000000] mb-5">Your Experience{booking.addons.length > 1 ? 's' : ''}</h2>
                <div className="space-y-4">
                  {booking.addons.map(a => (
                    <div key={a.id} className="flex items-start gap-4 border border-gray-100 p-4">
                      <div className="w-10 h-10 bg-[#2d6a4f]/10 flex items-center justify-center shrink-0">
                        <Mountain size={16} className="text-[#2d6a4f]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display italic text-lg">{a.title}</p>
                        <div className="flex flex-wrap gap-4 font-sans text-xs text-gray-500 mt-1">
                          {a.date && <span className="flex items-center gap-1"><Calendar size={10} />{fmt(a.date)}</span>}
                          <span className="flex items-center gap-1"><Users size={10} />{a.guests} {a.guests === 1 ? 'person' : 'people'}</span>
                        </div>
                      </div>
                      <p className="font-display italic text-lg text-[#2d6a4f] shrink-0">{formatMoney(a.price_per_person * a.guests)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accommodation */}
            {booking.stay && (
              <div className="bg-white border border-gray-200 p-6">
                <h2 className="font-display italic text-2xl text-[#000000] mb-5">Accommodation</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <MapPin size={14} className="text-[#C9A96E] mt-0.5 shrink-0" />
                      <div>
                        <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-0.5">Property</p>
                        <p className="font-display italic text-lg">{booking.stay.title}</p>
                        <p className="font-sans text-xs text-gray-500">{booking.stay.region}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar size={14} className="text-[#C9A96E] mt-0.5 shrink-0" />
                      <div>
                        <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-0.5">Dates</p>
                        <p className="font-sans text-sm">{fmt(booking.checkIn)} — {fmt(booking.checkOut)}</p>
                        <p className="font-sans text-xs text-gray-500">{booking.nights} night{booking.nights !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Users size={14} className="text-[#C9A96E] mt-0.5 shrink-0" />
                      <div>
                        <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-0.5">Guests</p>
                        <p className="font-sans text-sm">{booking.guests} guest{booking.guests !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#F7F5F2] p-4">
                    <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-3">Contact the property</p>
                    <p className="font-display italic text-lg mb-0.5">{booking.stay.title}</p>
                    <p className="font-sans text-xs text-gray-400 mt-3 leading-relaxed">
                      Contact the property directly with special requests or questions about your stay.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Shuttles */}
            {booking.shuttles.map(shuttle => (
              <div key={shuttle.id} className="bg-white border border-gray-200 p-6 flex items-start gap-4">
                <Bus size={18} className="text-[#C9A96E] shrink-0 mt-0.5" />
                <div>
                  <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-1">Shuttle</p>
                  <p className="font-display italic text-lg">{shuttle.label}</p>
                  <p className="font-sans text-xs text-gray-500 mt-0.5">{shuttle.description}</p>
                </div>
                <p className="font-display italic text-lg text-[#2d6a4f] ml-auto shrink-0">{formatMoney(shuttle.price)}</p>
              </div>
            ))}

            {/* What happens next */}
            <div className="bg-white border border-gray-200 p-6 print:hidden">
              <h2 className="font-display italic text-xl text-[#000000] mb-5">What Happens Next</h2>
              <div className="space-y-4">
                {[
                  { step: '01', title: 'Booking saved to your account', desc: 'Find your full booking details and itinerary under My Bookings.' },
                  { step: '02', title: 'Supplier notified', desc: 'The operator has been notified and will confirm your reservation within 2 hours.' },
                  { step: '03', title: 'Download your itinerary', desc: 'Use the Download PDF button above to save or print your booking confirmation.' },
                  { step: '04', title: 'Before you go', desc: 'Check your itinerary for meeting point, what to bring, and guide contact details.' },
                ].map(s => (
                  <div key={s.step} className="flex gap-4">
                    <span className="font-display italic text-2xl text-[#C9A96E] shrink-0 w-8">{s.step}</span>
                    <div>
                      <p className="font-sans text-sm font-medium text-gray-800">{s.title}</p>
                      <p className="font-sans text-xs text-gray-500 leading-relaxed mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 print:hidden">
            <div className="bg-[#000000] text-white p-6">
              <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] block mb-3">Payment</span>
              <p className="font-display italic text-4xl text-white mb-1">{formatMoney(booking.total)}</p>
              <p className="font-sans text-xs text-white/40 mb-5">Total · incl. service fee &amp; VAT</p>
              <div className="space-y-1.5 font-sans text-xs text-white/40 mb-5">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(booking.subtotal)}</span></div>
                <div className="flex justify-between"><span>Service fee (12%)</span><span>{formatMoney(booking.serviceFee)}</span></div>
                <div className="flex justify-between"><span>VAT (15%)</span><span>{formatMoney(booking.vat)}</span></div>
              </div>
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <Mail size={12} />
                <span className="font-sans">Saved to {booking.customerEmail}</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 p-5">
              <p className="font-display italic text-lg text-[#000000] mb-4">Your Account</p>
              <div className="space-y-2">
                <Link href="/account" className="flex items-center justify-between py-2.5 border-b border-gray-100 group">
                  <span className="font-sans text-sm text-gray-700">View My Bookings</span>
                  <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
                </Link>
                <Link href={`/account/itinerary?id=${booking.id}`} className="flex items-center justify-between py-2.5 border-b border-gray-100 group">
                  <span className="font-sans text-sm text-gray-700">View Full Itinerary</span>
                  <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
                </Link>
                <Link href="/stays" className="flex items-center justify-between py-2.5 group">
                  <span className="font-sans text-sm text-gray-700">Continue Planning</span>
                  <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
                </Link>
              </div>
            </div>

            <div className="bg-[#2d6a4f]/10 border border-[#2d6a4f]/20 p-5">
              <p className="font-sans text-xs text-[#2d6a4f] font-medium mb-1">Loyalty Points Earned</p>
              <p className="font-display italic text-3xl text-[#2d6a4f]">+{Math.round(booking.total / 100)} pts</p>
              <p className="font-sans text-xs text-gray-500 mt-1">Added to your Berg Loyalty balance</p>
            </div>
          </div>
        </div>
      </main>

      {/* Print-only footer */}
      <div className="hidden print:block px-12 py-8 border-t border-gray-200 mt-8">
        <p className="font-sans text-xs text-gray-400">visitdrakensberg.com · Ref: {booking.reference} · Printed {new Date().toLocaleDateString('en-ZA')}</p>
      </div>

      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessInner />
    </Suspense>
  )
}

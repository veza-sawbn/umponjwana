'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, ShieldCheck, Lock, Calendar, Users, MapPin, Bus } from 'lucide-react'
import { useBooking, describeAddonParty } from '@/lib/booking-context'
import { addBooking } from '@/lib/bookings'
import { getDepartures, bookDepartureSeats, releaseDepartureSeats } from '@/lib/departures'
import { bookActivityTimeslot, releaseActivityTimeslot } from '@/lib/activities'
import { getSupplierEntities } from '@/lib/supplier-entities'
import { supabase } from '@/lib/auth'
import { trackEvent, AnalyticsEvent, getAnalyticsIds } from '@/lib/analytics'
import { formatMoney, formatRate } from '@/lib/allocation'
import { getFinanceSettings } from '@/lib/invoices'

function formatDate(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CheckoutPage() {
  const router = useRouter()
  const booking = useBooking()
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  // Service fee / VAT rates come from the admin-editable website settings
  // module (vd_finance_settings) — never hardcoded here, so a rate change
  // there is reflected at checkout without a code change. The defaults
  // below only cover the brief window before the real settings load.
  const [serviceFeeRate, setServiceFeeRate] = useState(0.12)
  const [vatRate, setVatRate] = useState(0.15)
  // Submission is blocked until the real rates are in: vd_create_order
  // independently recalculates the invoice from the database settings, so
  // submitting on the (possibly wrong) 12%/15% defaults could charge a
  // total that doesn't match what this page just showed the guest.
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  useEffect(() => {
    getFinanceSettings().then(s => {
      setServiceFeeRate(s.serviceFeeRate)
      setVatRate(s.vatRate)
    }).finally(() => setSettingsLoaded(true))
  }, [])

  const isEmpty = !booking.stay && booking.addons.length === 0 && booking.shuttles.length === 0

  // True once payment succeeded: clearing the cart empties the state, and the
  // empty-cart guard below must NOT hijack the redirect to the success page.
  const completedRef = useRef(false)

  // Nothing to pay for — send the visitor back to trip planning instead of
  // letting them submit an empty R0 booking. Only after the cart has hydrated
  // from localStorage (it is always "empty" on the very first render) and
  // never after a successful payment.
  useEffect(() => {
    if (booking.hydrated && isEmpty && !completedRef.current) router.replace('/trip')
  }, [booking.hydrated, isEmpty, router])

  // Booking funnel start (§3/§5): the visitor has a real cart and reached
  // checkout. Fires once per mount, only once the cart has hydrated so it
  // never fires on the transient "empty" first render.
  const startedRef = useRef(false)
  useEffect(() => {
    if (!booking.hydrated || isEmpty || startedRef.current) return
    startedRef.current = true
    trackEvent(AnalyticsEvent.BOOKING_STARTED, {
      region: booking.region, guests: booking.guests, total,
      has_stay: !!booking.stay, addon_count: booking.addons.length, shuttle_count: booking.shuttles.length,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.hydrated, isEmpty])

  const nights = booking.nights
  const stayTotal = booking.stay ? booking.stay.price_per_night * nights : 0
  const addonTotal = booking.addons.reduce((s, a) => s + a.price_per_person * a.guests, 0)
  const shuttleTotal = booking.shuttles.reduce((sum, s) => sum + s.price, 0)
  const subtotal = stayTotal + addonTotal + shuttleTotal
  const serviceFee = Math.round(subtotal * serviceFeeRate)
  const tax = Math.round((subtotal + serviceFee) * vatRate)
  const total = subtotal + serviceFee + tax

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed || isEmpty || !settingsLoaded) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Snapshot booking state before clearing
      const snap = {
        region: booking.region,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights,
        guests: booking.guests,
        stay: booking.stay,
        addons: [...booking.addons],
        shuttles: [...booking.shuttles],
      }

      if (!user) {
        toast.error('Your session has expired. Please sign in again to complete the booking.')
        router.push('/auth/login?redirect=/checkout')
        return
      }

      // Respect supplier-blocked dates on the stay.
      if (snap.stay?.id?.startsWith('prop-') && snap.checkIn && snap.checkOut) {
        try {
          const blocks = await getSupplierEntities<any>('availability_blocks')
          const clash = blocks.find(b =>
            b.listingId === snap.stay!.id && b.from < snap.checkOut && b.to >= snap.checkIn
          )
          if (clash) {
            toast.error(`${snap.stay.title} is unavailable ${clash.from} → ${clash.to}. Please choose different dates.`)
            setLoading(false)
            return
          }
        } catch {}
      }

      // Reserve departure seats and activity timeslots FIRST — both atomic
      // and capacity-checked server-side, so a full departure/timeslot
      // aborts the booking cleanly before anything is persisted.
      const allDeps = await getDepartures()
      const departureAddons = snap.addons.filter(a => allDeps.some(d => d.id === a.id))
      const slotAddons = snap.addons.filter(a => a.activityId && a.timeslotId && a.date)
      const reserved: { id: string; seats: number }[] = []
      const reservedSlots: { activityId: string; date: string; timeslotId: string; seats: number }[] = []
      try {
        for (const addon of departureAddons) {
          await bookDepartureSeats(addon.id, addon.guests)
          reserved.push({ id: addon.id, seats: addon.guests })
        }
        for (const addon of slotAddons) {
          await bookActivityTimeslot(addon.activityId!, addon.date!, addon.timeslotId!, addon.guests)
          reservedSlots.push({ activityId: addon.activityId!, date: addon.date!, timeslotId: addon.timeslotId!, seats: addon.guests })
        }
      } catch (seatErr) {
        // Roll back anything we already took, then surface the problem.
        await Promise.all([
          ...reserved.map(r => releaseDepartureSeats(r.id, r.seats).catch(() => {})),
          ...reservedSlots.map(r => releaseActivityTimeslot(r.activityId, r.date, r.timeslotId, r.seats).catch(() => {})),
        ])
        const msg = seatErr instanceof Error && (seatErr.message.includes('seats') || seatErr.message.includes('timeslot'))
          ? seatErr.message.includes('timeslot')
            ? 'One of your activity timeslots no longer has enough seats. Please adjust your trip.'
            : 'One of your tour departures no longer has enough seats. Please adjust your trip.'
          : 'We could not reserve your booking. Please try again.'
        toast.error(msg)
        setLoading(false)
        return
      }

      // Carried through to payment confirmation (§21) so the iKhokha webhook
      // — a server route with no browser session — can still attribute the
      // eventual booking_completed event to the session that created this
      // booking, once payment actually clears.
      const { anonId: analyticsAnonId, sessionId: analyticsSessionId } = await getAnalyticsIds()

      // Persist booking as 'pending' — holds the room/seats, but isn't
      // confirmed until iKhokha verifies a real payment (see the webhook).
      const { booking: saved, invoiceId } = await addBooking({
        userId: user.id,
        customerName: `${firstName} ${lastName}`.trim(),
        customerEmail: email,
        customerPhone: phone,
        specialRequests,
        ...snap,
        subtotal,
        serviceFee,
        vat: tax,
        serviceFeeRate,
        vatRate,
        total,
        status: 'pending',
        analyticsAnonId,
        analyticsSessionId,
      })

      completedRef.current = true
      booking.clearBooking()

      if (!invoiceId) {
        // Booking + inventory hold succeeded but the order/invoice failed —
        // there's nothing to pay against. Send them to the booking's status
        // page rather than a broken payment redirect.
        toast.error('Your booking was saved but payment setup failed — please contact us to complete it.')
        router.push(`/checkout/success?id=${saved.id}`)
        return
      }

      // The booking + invoice now exist — a failure from here on is a
      // payment-start problem, not a booking problem, so send them to the
      // booking's own page to retry rather than showing "not charged".
      try {
        const res = await fetch('/api/payments/ikhokha/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: saved.id }),
        })
        const json = await res.json()
        if (!res.ok || !json.paylinkUrl) throw new Error(json.error || 'Could not start payment')
        window.location.href = json.paylinkUrl
      } catch (payErr) {
        toast.error(payErr instanceof Error ? payErr.message : 'Could not start payment — you can retry from your booking.')
        router.push(`/checkout/success?id=${saved.id}`)
      }
    } catch (err) {
      console.error('Booking save failed:', err)
      const msg = err instanceof Error ? err.message : ''
      if (/sold out/i.test(msg)) {
        toast.error('That room has just sold out for your dates. Please pick another room or change your dates.')
      } else if (/unavailable/i.test(msg)) {
        toast.error('The property is unavailable for these dates. Please choose different dates.')
      } else {
        toast.error('We could not complete your booking. You have not been charged — please try again.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      <section className="bg-[#000000] text-white pt-32 pb-10 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 font-sans text-xs text-white/40 hover:text-white transition-colors mb-6">
            <ArrowLeft size={12} /> Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] block mb-2">Secure Checkout</span>
              <h1 className="font-display italic text-4xl lg:text-5xl">Complete Your Booking</h1>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-white/40">
              <Lock size={14} />
              <span className="font-sans text-xs">256-bit SSL encryption</span>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            <div className="lg:col-span-2 space-y-6">
              {/* Guest details */}
              <div className="bg-white border border-gray-200 p-6">
                <h2 className="font-display italic text-2xl text-[#000000] mb-6">Guest Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">First Name</label>
                    <input required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
                  </div>
                  <div>
                    <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Last Name</label>
                    <input required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
                  </div>
                  <div>
                    <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Email Address</label>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
                  </div>
                  <div>
                    <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Phone Number</label>
                    <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 82 000 0000" className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Special Requests (optional)</label>
                    <textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} rows={3} placeholder="Dietary requirements, accessibility needs, late arrival..." className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none bg-[#F7F5F2]" />
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className="bg-white border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display italic text-2xl text-[#000000]">Payment</h2>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Lock size={14} />
                    <span className="font-sans text-xs">Secured by iKhokha</span>
                  </div>
                </div>
                <p className="font-sans text-sm text-gray-600 leading-relaxed">
                  Your card details are never entered on this site. After you submit, you&apos;ll be redirected to iKhokha&apos;s secure payment page to complete the transaction — your booking is only confirmed once that payment succeeds.
                </p>
              </div>

              {/* Cancellation policy */}
              <div className="bg-white border border-gray-200 p-6">
                <h2 className="font-display italic text-xl text-[#000000] mb-3">Cancellation Policy</h2>
                <p className="font-sans text-sm text-gray-600 leading-relaxed">
                  Free cancellation until 48 hours before check-in. After that, the first night is non-refundable. Cancellations within 24 hours forfeit the full booking amount.
                </p>
              </div>

              {/* T&Cs */}
              <div className="flex items-start gap-3 bg-white border border-gray-200 p-5">
                <button type="button" onClick={() => setAgreed(!agreed)} className={`mt-0.5 w-5 h-5 shrink-0 border-2 flex items-center justify-center transition-colors ${agreed ? 'bg-[#2d6a4f] border-[#2d6a4f]' : 'border-gray-300'}`}>
                  {agreed && <span className="text-white text-xs font-bold">✓</span>}
                </button>
                <p className="font-sans text-sm text-gray-600">
                  I agree to the <Link href="/terms" className="text-[#2d6a4f] hover:underline">Terms & Conditions</Link> and <Link href="/privacy" className="text-[#2d6a4f] hover:underline">Privacy Policy</Link>. I confirm the guest details above are correct.
                </p>
              </div>
            </div>

            {/* Summary sidebar */}
            <div className="space-y-4">
              <div className="bg-[#000000] text-white p-6 sticky top-24">
                <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] block mb-4">Booking Summary</span>

                {booking.stay ? (
                  <>
                    <h3 className="font-display italic text-2xl mb-1">{booking.stay.title}</h3>
                    {booking.stay.roomName && (
                      <p className="font-sans text-xs text-[#C9A96E] mb-1">{booking.stay.roomName}</p>
                    )}
                    <p className="font-sans text-xs text-white/40 mb-1 flex items-center gap-1">
                      <MapPin size={10} />{booking.stay.region}
                    </p>
                    <div className="flex items-center gap-2 text-white/50 mb-5">
                      <Calendar size={11} />
                      <span className="font-sans text-xs">{formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}</span>
                    </div>
                    <div className="space-y-2 mb-4 pb-4 border-b border-white/10">
                      <div className="flex justify-between font-sans text-sm text-white/60">
                        <span>{formatMoney(booking.stay.price_per_night)} × {nights} night{nights !== 1 ? 's' : ''}</span>
                        <span>{formatMoney(stayTotal)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="font-sans text-sm text-white/40 mb-4">No accommodation selected</p>
                )}

                {booking.addons.length > 0 && (
                  <div className="mb-4 pb-4 border-b border-white/10">
                    <p className="font-sans text-[10px] uppercase text-white/30 mb-2">Add-ons</p>
                    {booking.addons.map(a => (
                      <div key={a.id} className="flex justify-between font-sans text-xs text-white/60 mb-1.5">
                        <span className="truncate mr-2">
                          {a.title}
                          {a.adults !== undefined && <span className="block text-white/35 text-[11px]">{describeAddonParty(a)}{a.timeslotTime && ` · ${a.timeslotTime}`}</span>}
                        </span>
                        <span className="shrink-0">{formatMoney(a.price_per_person * a.guests)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {booking.shuttles.length > 0 && (
                  <div className="mb-4 pb-4 border-b border-white/10">
                    <p className="font-sans text-[10px] uppercase text-white/30 mb-2">
                      Shuttle{booking.shuttles.length > 1 ? 's' : ''}
                    </p>
                    {booking.shuttles.map(shuttle => (
                      <div key={shuttle.id} className="flex justify-between font-sans text-xs text-white/60 mb-1.5">
                        <span className="flex items-center gap-1 truncate mr-2"><Bus size={10} />{shuttle.label}</span>
                        <span className="shrink-0">{formatMoney(shuttle.price)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 mb-5 pb-5 border-b border-white/10">
                  <div className="flex justify-between font-sans text-sm text-white/60">
                    <span>Service fee ({formatRate(serviceFeeRate)})</span>
                    <span>{formatMoney(serviceFee)}</span>
                  </div>
                  <div className="flex justify-between font-sans text-sm text-white/60">
                    <span>VAT ({formatRate(vatRate)})</span>
                    <span>{formatMoney(tax)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline mb-6">
                  <span className="font-sans text-sm text-white">Total</span>
                  <span className="font-display italic text-3xl text-[#C9A96E]">{formatMoney(total)}</span>
                </div>

                <div className="flex items-center gap-2 text-white/40 mb-4">
                  <Users size={11} />
                  <span className="font-sans text-xs">{booking.guests} guest{booking.guests !== 1 ? 's' : ''}{nights > 0 ? ` · ${nights} night${nights !== 1 ? 's' : ''}` : ''}</span>
                </div>

                <button type="submit" disabled={!agreed || loading || !settingsLoaded} className={`w-full py-4 font-sans text-sm font-medium transition-colors ${agreed && !loading && settingsLoaded ? 'bg-[#C9A96E] text-[#000000] hover:bg-[#b8945a]' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}>
                  {loading ? 'Redirecting to payment…' : !settingsLoaded ? 'Loading rates…' : `Continue to Payment — ${formatMoney(total)}`}
                </button>
                <div className="flex items-center justify-center gap-2 mt-4 text-white/30">
                  <ShieldCheck size={12} />
                  <span className="font-sans text-xs">Secure payment · SSL encrypted</span>
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={14} className="text-[#2d6a4f]" />
                  <span className="font-sans text-sm font-medium text-gray-800">Booking Protection</span>
                </div>
                <p className="font-sans text-xs text-gray-500 leading-relaxed">
                  Your booking is protected. If the supplier cancels, you receive a full refund within 5 business days.
                </p>
              </div>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  )
}

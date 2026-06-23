'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, ShieldCheck, Lock, CreditCard, Calendar, Users } from 'lucide-react'

function formatCardNumber(val: string) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(val: string) {
  const d = val.replace(/\D/g, '').slice(0, 4)
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

export default function CheckoutPage() {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')

  const booking = {
    listing: 'Cathedral Peak Mountain Lodge',
    location: 'Cathedral Peak, Northern Berg',
    checkIn: '15 Jul 2026',
    checkOut: '18 Jul 2026',
    nights: 3,
    guests: 2,
    room: 'Luxury Cottage',
    pricePerNight: 1850,
  }

  const subtotal = booking.pricePerNight * booking.nights
  const serviceFee = Math.round(subtotal * 0.12)
  const tax = Math.round((subtotal + serviceFee) * 0.15)
  const total = subtotal + serviceFee + tax

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    router.push('/checkout/success')
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#000000] text-white pt-32 pb-10 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/stays" className="inline-flex items-center gap-2 font-sans text-xs text-white/40 hover:text-white transition-colors mb-6">
            <ArrowLeft size={12} /> Back to listing
          </Link>
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
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display italic text-2xl text-[#000000]">Payment Details</h2>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <CreditCard size={14} />
                    <span className="font-sans text-xs">Visa · Mastercard · Amex</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Cardholder Name</label>
                    <input required value={cardholderName} onChange={e => setCardholderName(e.target.value)} placeholder="As it appears on your card" className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
                  </div>
                  <div>
                    <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Card Number</label>
                    <input required value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" maxLength={19} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2] font-mono tracking-widest" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Expiry</label>
                      <input required value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
                    </div>
                    <div>
                      <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">CVV</label>
                      <input required value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="000" maxLength={4} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
                    </div>
                  </div>
                </div>
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
                <h3 className="font-display italic text-2xl mb-1">{booking.listing}</h3>
                <p className="font-sans text-xs text-white/40 mb-5">{booking.location}</p>
                <div className="space-y-3 mb-5 pb-5 border-b border-white/10">
                  <div className="flex items-center gap-2 text-white/60">
                    <Calendar size={12} />
                    <span className="font-sans text-xs">{booking.checkIn} → {booking.checkOut}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/60">
                    <Users size={12} />
                    <span className="font-sans text-xs">{booking.guests} guests · {booking.nights} nights</span>
                  </div>
                  <div className="font-sans text-xs text-white/60">Room: <span className="text-white">{booking.room}</span></div>
                </div>
                <div className="space-y-2 mb-5 pb-5 border-b border-white/10">
                  <div className="flex justify-between font-sans text-sm text-white/60">
                    <span>R {booking.pricePerNight.toLocaleString()} × {booking.nights} nights</span>
                    <span>R {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-sans text-sm text-white/60">
                    <span>Service fee</span>
                    <span>R {serviceFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-sans text-sm text-white/60">
                    <span>VAT (15%)</span>
                    <span>R {tax.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-between items-baseline mb-6">
                  <span className="font-sans text-sm text-white">Total</span>
                  <span className="font-display italic text-3xl text-[#C9A96E]">R {total.toLocaleString()}</span>
                </div>
                <button type="submit" disabled={!agreed || loading} className={`w-full py-4 font-sans text-sm font-medium transition-colors ${agreed && !loading ? 'bg-[#C9A96E] text-[#000000] hover:bg-[#b8945a]' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}>
                  {loading ? 'Processing…' : `Pay R ${total.toLocaleString()}`}
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

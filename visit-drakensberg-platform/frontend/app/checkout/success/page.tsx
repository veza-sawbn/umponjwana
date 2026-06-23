'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { CheckCircle, Download, Calendar, MapPin, Users, ArrowRight, Mail } from 'lucide-react'

function generateRef(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function BookingSuccessPage() {
  const bookingRef = useMemo(() => generateRef(), [])

  const booking = {
    listing: 'Cathedral Peak Mountain Lodge',
    location: 'Cathedral Peak, Northern Berg',
    checkIn: '15 Jul 2026',
    checkOut: '18 Jul 2026',
    nights: 3,
    guests: 2,
    room: 'Luxury Cottage',
    total: 7363,
    supplier: 'Cathedral Peak Lodge',
    supplierPhone: '+27 36 488 1888',
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#2d6a4f] text-white pt-32 pb-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 mb-6">
            <CheckCircle size={32} className="text-[#C9A96E]" />
          </div>
          <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-white/60 block mb-3">Booking Confirmed</span>
          <h1 className="font-display italic text-5xl lg:text-6xl mb-4">You&apos;re all booked!</h1>
          <p className="font-sans text-lg text-white/60 max-w-lg mx-auto">
            Your Drakensberg adventure is confirmed. A confirmation email has been sent to your inbox.
          </p>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Booking details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Reference */}
            <div className="bg-white border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-gray-400 block mb-2">Booking Reference</span>
                  <p className="font-display italic text-4xl text-[#2d6a4f] tracking-widest">{bookingRef}</p>
                  <p className="font-sans text-xs text-gray-400 mt-2">Keep this reference for your records and at check-in</p>
                </div>
                <button className="shrink-0 flex items-center gap-2 border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
                  <Download size={13} />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Stay summary */}
            <div className="bg-white border border-gray-200 p-6">
              <h2 className="font-display italic text-2xl text-[#000000] mb-5">Your Stay</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin size={14} className="text-[#C9A96E] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-0.5">Property</p>
                      <p className="font-display italic text-lg">{booking.listing}</p>
                      <p className="font-sans text-xs text-gray-500">{booking.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar size={14} className="text-[#C9A96E] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-0.5">Dates</p>
                      <p className="font-sans text-sm">{booking.checkIn} — {booking.checkOut}</p>
                      <p className="font-sans text-xs text-gray-500">{booking.nights} nights</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users size={14} className="text-[#C9A96E] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-0.5">Guests & Room</p>
                      <p className="font-sans text-sm">{booking.guests} guests · {booking.room}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#F7F5F2] p-4">
                  <p className="font-sans text-xs text-gray-400 uppercase tracking-wider mb-3">Supplier Contact</p>
                  <p className="font-display italic text-lg mb-0.5">{booking.supplier}</p>
                  <p className="font-sans text-sm text-[#2d6a4f]">{booking.supplierPhone}</p>
                  <p className="font-sans text-xs text-gray-400 mt-3 leading-relaxed">Contact the property directly for special arrangements or additional information about your stay.</p>
                </div>
              </div>
            </div>

            {/* What happens next */}
            <div className="bg-white border border-gray-200 p-6">
              <h2 className="font-display italic text-xl text-[#000000] mb-5">What Happens Next</h2>
              <div className="space-y-4">
                {[
                  { step: '01', title: 'Confirmation email sent', desc: 'Check your inbox for a full booking confirmation and receipt.' },
                  { step: '02', title: 'Supplier notified', desc: `${booking.supplier} has been notified and will confirm your reservation within 2 hours.` },
                  { step: '03', title: 'Itinerary generated', desc: 'Your trip itinerary is available in your account under My Bookings.' },
                  { step: '04', title: 'Before you go', desc: 'We\'ll send reminders 7 days and 24 hours before your check-in date.' },
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
          <div className="space-y-4">
            <div className="bg-[#000000] text-white p-6">
              <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] block mb-3">Payment</span>
              <p className="font-display italic text-4xl text-white mb-1">R {booking.total.toLocaleString()}</p>
              <p className="font-sans text-xs text-white/40 mb-5">Total paid · including VAT</p>
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <Mail size={12} />
                <span className="font-sans">Receipt sent to your email</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 p-5">
              <p className="font-display italic text-lg text-[#000000] mb-4">Your Account</p>
              <div className="space-y-2">
                <Link href="/account" className="flex items-center justify-between py-2.5 border-b border-gray-100 group">
                  <span className="font-sans text-sm text-gray-700">View My Bookings</span>
                  <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
                </Link>
                <Link href="/account/itinerary" className="flex items-center justify-between py-2.5 border-b border-gray-100 group">
                  <span className="font-sans text-sm text-gray-700">View Itinerary</span>
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

      <Footer />
    </div>
  )
}

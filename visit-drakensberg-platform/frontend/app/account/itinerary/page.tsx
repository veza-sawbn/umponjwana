'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Calendar, Clock, Download, ArrowRight, Mountain, Bus,
  Phone, Mail, Users, CheckCircle, AlertCircle, Share2,
  Navigation, Shield, HeartPulse, CreditCard, Copy, Facebook,
  MessageCircle, Printer, ExternalLink, ChevronDown, ChevronUp,
  Star, Info
} from 'lucide-react'
import { getBookingById, type SavedBooking } from '@/lib/bookings'
import { getTours, type Tour } from '@/lib/tours'

function fmtLong(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function fmt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string
  icon: any
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F7F5F2] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <Icon size={16} className="text-[#C9A96E]" />
          <span className="font-display italic text-lg text-[#000000]">{title}</span>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6 pt-1">{children}</div>}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 font-sans text-xs text-gray-400 hover:text-[#2d6a4f] transition-colors">
      <Copy size={11} />
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function ShareButtons({ booking }: { booking: SavedBooking }) {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const text = `My Drakensberg booking — Ref: ${booking.reference}`

  const channels = [
    {
      label: 'WhatsApp',
      icon: MessageCircle,
      color: 'bg-[#25D366] hover:bg-[#1ebe57]',
      href: `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`,
    },
    {
      label: 'Facebook',
      icon: Facebook,
      color: 'bg-[#1877F2] hover:bg-[#166ddb]',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      label: 'Email',
      icon: Mail,
      color: 'bg-gray-700 hover:bg-gray-800',
      href: `mailto:?subject=${encodeURIComponent('My Drakensberg Itinerary')}&body=${encodeURIComponent(text + '\n' + url)}`,
    },
    {
      label: 'Print',
      icon: Printer,
      color: 'bg-[#2d6a4f] hover:bg-[#235a3f]',
      href: '#',
      onClick: () => window.print(),
    },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {channels.map(c => {
        const Icon = c.icon
        return c.onClick ? (
          <button
            key={c.label}
            onClick={c.onClick}
            className={`inline-flex items-center gap-2 px-3 py-2 font-sans text-xs text-white transition-colors ${c.color}`}
          >
            <Icon size={13} /> {c.label}
          </button>
        ) : (
          <a
            key={c.label}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 px-3 py-2 font-sans text-xs text-white transition-colors ${c.color}`}
          >
            <Icon size={13} /> {c.label}
          </a>
        )
      })}
    </div>
  )
}

const EMERGENCY = [
  { label: 'Police', number: '10111' },
  { label: 'Ambulance / Fire', number: '10177' },
  { label: 'Mountain Rescue (MCSA)', number: '082 911' },
  { label: 'Ezemvelo KZN Wildlife', number: '+27 33 845 1000' },
  { label: 'ER24 Private', number: '084 124' },
  { label: 'Netcare 911', number: '082 911' },
]

function ItineraryInner() {
  const params = useSearchParams()
  const id = params.get('id')
  const [booking, setBooking] = useState<SavedBooking | null>(null)
  const [tours, setTours] = useState<Tour[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    Promise.all([getBookingById(id), getTours()]).then(([b, t]) => {
      setBooking(b)
      setTours(t)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="py-20 text-center">
        <p className="font-sans text-sm text-gray-400 mb-4">Booking not found.</p>
        <Link href="/account" className="font-sans text-sm text-[#2d6a4f] hover:underline">Back to My Bookings</Link>
      </div>
    )
  }

  // Match each addon to its tour record (by departure id = addon.id)
  // Departures link to tours via tourId; but we only have the tour list here.
  // We match by title/operator name as a best-effort.
  function tourForAddon(a: SavedBooking['addons'][0]) {
    return tours.find(t =>
      t.name === a.title ||
      (a.operator && t.supplierName === a.operator)
    ) || null
  }

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display italic text-3xl text-[#000000]">Your Itinerary</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">Ref: <span className="text-[#2d6a4f] font-medium">{booking.reference}</span> · {booking.customerName}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/checkout/success?id=${booking.id}`}
            className="flex items-center gap-2 border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors print:hidden"
          >
            <Download size={13} />
            Download PDF
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-gray-300 text-gray-500 px-4 py-2.5 font-sans text-sm hover:bg-[#F7F5F2] transition-colors print:hidden"
          >
            <Printer size={13} />
            Print
          </button>
        </div>
      </div>

      <div className="space-y-4">

        {/* ── Accommodation ──────────────────────────────────── */}
        {booking.stay && (
          <Section title="Accommodation" icon={MapPin}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Property</p>
                  <p className="font-display italic text-2xl text-[#000000]">{booking.stay.title}</p>
                  <p className="font-sans text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <MapPin size={11} className="text-[#C9A96E]" />{booking.stay.region}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#F7F5F2] p-3">
                    <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Check-in</p>
                    <p className="font-sans text-sm font-medium">{fmtLong(booking.checkIn)}</p>
                    <p className="font-sans text-xs text-gray-400 mt-0.5">From 14:00</p>
                  </div>
                  <div className="bg-[#F7F5F2] p-3">
                    <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Check-out</p>
                    <p className="font-sans text-sm font-medium">{fmtLong(booking.checkOut)}</p>
                    <p className="font-sans text-xs text-gray-400 mt-0.5">By 10:00</p>
                  </div>
                  <div className="bg-[#F7F5F2] p-3">
                    <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Duration</p>
                    <p className="font-sans text-sm font-medium">{booking.nights} night{booking.nights !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="bg-[#F7F5F2] p-3">
                    <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Guests</p>
                    <p className="font-sans text-sm font-medium">{booking.guests} guest{booking.guests !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {booking.specialRequests && (
                  <div className="border-l-2 border-[#C9A96E] pl-3">
                    <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Your Special Request</p>
                    <p className="font-sans text-sm text-gray-600 italic">{booking.specialRequests}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-[#000000] text-white p-5">
                  <p className="font-sans text-[10px] uppercase tracking-wider text-[#C9A96E] mb-3">Property Contact</p>
                  <p className="font-display italic text-xl mb-4">{booking.stay.title}</p>
                  <div className="space-y-2 text-sm text-white/70 font-sans">
                    <p className="flex items-center gap-2"><MapPin size={12} className="text-[#C9A96E] shrink-0" />{booking.stay.region}, KwaZulu-Natal</p>
                    <p className="flex items-center gap-2"><Phone size={12} className="text-[#C9A96E] shrink-0" />Contact via booking confirmation</p>
                    <p className="flex items-center gap-2 text-xs text-white/40 mt-2">
                      <Info size={11} />Reach out directly to the property with any special requests or questions about your stay.
                    </p>
                  </div>
                </div>

                <div className="border border-amber-200 bg-amber-50 p-4">
                  <p className="font-sans text-[10px] uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1">
                    <Shield size={11} />Property Policies
                  </p>
                  <ul className="font-sans text-xs text-amber-800 space-y-1.5">
                    <li>· Check-in from 14:00 · Check-out by 10:00</li>
                    <li>· No smoking inside the property</li>
                    <li>· Pets by prior arrangement only</li>
                    <li>· Cancellation: full refund 7+ days before; 50% within 7 days; non-refundable within 48 hours</li>
                    <li>· Damage deposit may be charged at check-in</li>
                  </ul>
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* ── Experiences / Hike Departures ──────────────────── */}
        {booking.addons.map(a => {
          const tour = tourForAddon(a)
          return (
            <Section key={a.id} title={a.title} icon={Mountain}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#F7F5F2] p-3">
                      <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Date</p>
                      <p className="font-sans text-sm font-medium">{a.date ? fmtLong(a.date) : '—'}</p>
                    </div>
                    <div className="bg-[#F7F5F2] p-3">
                      <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Participants</p>
                      <p className="font-sans text-sm font-medium">{a.guests} {a.guests === 1 ? 'person' : 'people'}</p>
                    </div>
                    {tour?.days && (
                      <div className="bg-[#F7F5F2] p-3">
                        <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Duration</p>
                        <p className="font-sans text-sm font-medium">{tour.days} day{tour.days !== 1 ? 's' : ''}</p>
                      </div>
                    )}
                    {tour?.difficulty && (
                      <div className="bg-[#F7F5F2] p-3">
                        <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Difficulty</p>
                        <p className="font-sans text-sm font-medium">{tour.difficulty}</p>
                      </div>
                    )}
                  </div>

                  {/* Meeting point */}
                  {(tour?.meetingPoint || tour?.gpsLat) && (
                    <div className="border border-[#2d6a4f]/20 bg-[#2d6a4f]/5 p-4">
                      <p className="font-sans text-[10px] uppercase tracking-wider text-[#2d6a4f] mb-2 flex items-center gap-1">
                        <Navigation size={11} />Meeting Point
                      </p>
                      <p className="font-sans text-sm text-gray-800 font-medium">{tour?.meetingPoint || 'Trailhead — details to be confirmed by guide'}</p>
                      {tour?.gpsLat && tour?.gpsLng && (
                        <a
                          href={`https://maps.google.com/?q=${tour.gpsLat},${tour.gpsLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-sans text-xs text-[#2d6a4f] hover:underline mt-2"
                        >
                          <ExternalLink size={10} />Open in Google Maps
                        </a>
                      )}
                    </div>
                  )}

                  {/* What's included */}
                  {tour?.included && tour.included.length > 0 && (
                    <div>
                      <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
                        <CheckCircle size={11} />What&apos;s Included
                      </p>
                      <ul className="space-y-1.5">
                        {tour.included.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 font-sans text-sm text-gray-700">
                            <CheckCircle size={13} className="text-[#2d6a4f] mt-0.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Fitness notes */}
                  {tour?.fitnessNotes && (
                    <div className="border-l-2 border-[#C9A96E] pl-3">
                      <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Fitness &amp; Preparation</p>
                      <p className="font-sans text-sm text-gray-600 italic leading-relaxed">{tour.fitnessNotes}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Supplier / operator */}
                  <div className="bg-[#000000] text-white p-5">
                    <p className="font-sans text-[10px] uppercase tracking-wider text-[#C9A96E] mb-3">Operator Contact</p>
                    <p className="font-display italic text-xl mb-1">{a.operator || tour?.supplierName || 'Supplier'}</p>
                    {tour?.meetingPoint && (
                      <p className="font-sans text-xs text-white/50 flex items-center gap-1 mb-3">
                        <MapPin size={10} />{tour.meetingPoint}
                      </p>
                    )}
                    <p className="font-sans text-xs text-white/40 leading-relaxed">
                      The operator will contact you with a final briefing and meeting confirmation before your departure date.
                    </p>
                  </div>

                  {/* Cancellation policy */}
                  {tour?.cancellation && (
                    <div className="border border-amber-200 bg-amber-50 p-4">
                      <p className="font-sans text-[10px] uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1">
                        <Shield size={11} />Cancellation Policy
                      </p>
                      <p className="font-sans text-xs text-amber-800 leading-relaxed">{tour.cancellation}</p>
                    </div>
                  )}

                  {/* Min age / group */}
                  {tour && (tour.minAge > 0 || tour.maxGroup > 0) && (
                    <div className="flex gap-3">
                      {tour.minAge > 0 && (
                        <div className="bg-[#F7F5F2] p-3 flex-1">
                          <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Min Age</p>
                          <p className="font-sans text-sm font-medium">{tour.minAge}+</p>
                        </div>
                      )}
                      {tour.maxGroup > 0 && (
                        <div className="bg-[#F7F5F2] p-3 flex-1">
                          <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Group Size</p>
                          <p className="font-sans text-sm font-medium">Max {tour.maxGroup}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )
        })}

        {/* ── Shuttle ────────────────────────────────────────── */}
        {booking.shuttle && (
          <Section title="Shuttle Transfer" icon={Bus} defaultOpen={false}>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="font-display italic text-xl mb-1">{booking.shuttle.label}</p>
                <p className="font-sans text-sm text-gray-500 leading-relaxed">{booking.shuttle.description}</p>
                <p className="font-sans text-xs text-gray-400 mt-3">Your shuttle operator will confirm pickup time and exact location 24 hours before departure.</p>
              </div>
              <p className="font-display italic text-2xl text-[#2d6a4f] shrink-0">R {booking.shuttle.price.toLocaleString()}</p>
            </div>
          </Section>
        )}

        {/* ── Payment Summary ────────────────────────────────── */}
        <Section title="Payment Summary" icon={CreditCard} defaultOpen={false}>
          <div className="space-y-3">
            <div className="space-y-2">
              {booking.addons.map(a => (
                <div key={a.id} className="flex justify-between font-sans text-sm text-gray-700">
                  <span>{a.title} × {a.guests}</span>
                  <span>R {(a.price_per_person * a.guests).toLocaleString()}</span>
                </div>
              ))}
              {booking.stay && (
                <div className="flex justify-between font-sans text-sm text-gray-700">
                  <span>{booking.stay.title} ({booking.nights} night{booking.nights !== 1 ? 's' : ''})</span>
                  <span>R {(booking.stay.price_per_night * booking.nights).toLocaleString()}</span>
                </div>
              )}
              {booking.shuttle && (
                <div className="flex justify-between font-sans text-sm text-gray-700">
                  <span>{booking.shuttle.label}</span>
                  <span>R {booking.shuttle.price.toLocaleString()}</span>
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              <div className="flex justify-between font-sans text-sm text-gray-500">
                <span>Subtotal</span><span>R {booking.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-sans text-sm text-gray-500">
                <span>Service fee (12%)</span><span>R {booking.serviceFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-sans text-sm text-gray-500">
                <span>VAT (15%)</span><span>R {booking.vat.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-display italic text-xl text-[#2d6a4f] pt-2 border-t border-gray-100">
                <span>Total paid</span><span>R {booking.total.toLocaleString()}</span>
              </div>
            </div>
            <div className="bg-[#2d6a4f]/5 border border-[#2d6a4f]/15 p-3 flex items-start gap-2 mt-2">
              <CheckCircle size={13} className="text-[#2d6a4f] mt-0.5 shrink-0" />
              <div>
                <p className="font-sans text-xs text-[#2d6a4f] font-medium">Payment confirmed</p>
                <p className="font-sans text-xs text-gray-500 mt-0.5">
                  Ref: {booking.reference} · Saved to {booking.customerEmail}
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Emergency Services ─────────────────────────────── */}
        <Section title="Local Emergency Services" icon={HeartPulse} defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EMERGENCY.map(e => (
              <div key={e.label} className="flex items-center justify-between bg-red-50 border border-red-100 px-4 py-3">
                <span className="font-sans text-sm text-gray-700">{e.label}</span>
                <div className="flex items-center gap-2">
                  <a href={`tel:${e.number}`} className="font-display italic text-lg text-red-600 hover:underline">{e.number}</a>
                  <CopyButton text={e.number} />
                </div>
              </div>
            ))}
          </div>
          <p className="font-sans text-xs text-gray-400 mt-4 leading-relaxed">
            In the event of a mountain emergency, call MCSA and provide your GPS coordinates, number of people, and nature of injury. Share your itinerary with someone at home before departing.
          </p>
        </Section>

        {/* ── Share ──────────────────────────────────────────── */}
        <Section title="Share This Trip" icon={Share2} defaultOpen={false}>
          <p className="font-sans text-sm text-gray-500 mb-4">Share your itinerary or invite someone to join your trip.</p>
          <ShareButtons booking={booking} />
          <div className="mt-4 flex items-center gap-3 bg-[#F7F5F2] px-4 py-3">
            <span className="font-sans text-xs text-gray-400 truncate flex-1">{pageUrl}</span>
            <CopyButton text={pageUrl} />
          </div>
        </Section>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link href="/account" className="group bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors p-4 flex items-center justify-between">
            <span className="font-sans text-sm text-gray-700">All Bookings</span>
            <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
          </Link>
          <Link href="/hikes" className="group bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors p-4 flex items-center justify-between">
            <span className="font-sans text-sm text-gray-700">Explore More Hikes</span>
            <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
          </Link>
          <Link href="/stays" className="group bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors p-4 flex items-center justify-between">
            <span className="font-sans text-sm text-gray-700">Browse Stays</span>
            <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ItineraryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ItineraryInner />
    </Suspense>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft } from 'lucide-react'
import { getBookingById, type SavedBooking } from '@/lib/bookings'
import { getTours, resolveItinerary, type Tour } from '@/lib/tours'
import { getDepartures, type Departure } from '@/lib/departures'
import { getTrails, type Trail } from '@/lib/trails'
import { resolveLivePackages } from '@/components/tours/PackageEditor'
import Logo from '@/components/Logo'
import { formatMoney } from '@/lib/allocation'

// Printable trip itinerary — a proper travel document, not a screen dump:
// trip summary, guest details, accommodation, a chronological day-by-day
// schedule, transfers, payment summary and emergency numbers. Access is
// scoped by RLS on vd_bookings (the traveller and admins).

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmtLong(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtShort(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}
const EMERGENCY = [
  ['Police', '10111'],
  ['Ambulance / Fire', '10177'],
  ['Mountain Rescue (MCSA)', '082 911'],
  ['Ezemvelo KZN Wildlife', '+27 33 845 1000'],
  ['ER24 Private', '084 124'],
]

type DayEvent = { time: string; title: string; detail: string }

function buildSchedule(b: SavedBooking, departures: Departure[], tours: Tour[], trails: Trail[]): Array<{ date: string; label: string; events: DayEvent[] }> {
  const days = new Map<string, DayEvent[]>()
  const push = (date: string | undefined, ev: DayEvent) => {
    const key = date || ''
    days.set(key, [...(days.get(key) ?? []), ev])
  }

  if (b.stay && b.checkIn) {
    push(b.checkIn, {
      time: 'From 14:00',
      title: `Check in — ${b.stay.title}`,
      detail: [b.stay.roomName, b.stay.region, b.stay.address].filter(Boolean).join(' · '),
    })
  }
  for (const shuttle of b.shuttles) {
    push(shuttle.date || b.checkIn, {
      time: 'Transfer',
      title: shuttle.label,
      detail: [
        shuttle.pickup && shuttle.destination ? `${shuttle.pickup} → ${shuttle.destination}` : shuttle.description,
        shuttle.passengers ? `${shuttle.passengers} passenger${shuttle.passengers !== 1 ? 's' : ''}` : '',
        shuttle.durationText,
      ].filter(Boolean).join(' · '),
    })
  }
  for (const a of b.addons) {
    // A multi-day hike gets one schedule entry per day of its trail's
    // default plan (Trail.days, /admin/trails), narrowed/customized/
    // extended by exactly the rate package this guest booked — see
    // resolveItinerary() in lib/tours.ts. Each day lands on its real
    // calendar date, offset from the departure's "hiking date"; a tier
    // that adds a day before it can start the guest's schedule earlier
    // than the hiking date itself. Anything else (or a hike whose trail
    // has no day-by-day plan authored) falls back to the single generic
    // line it always got.
    const dep = departures.find(d => d.id === a.id)
    const tour = dep ? tours.find(t => t.id === dep.tourId) : undefined
    const trail = tour ? trails.find(t => t.id === (dep?.trailId || tour.trailId)) : undefined
    const pkg = dep?.packages ? resolveLivePackages(dep.packages, tour).find(p => p.id === a.packageId) : undefined
    const itineraryDays = resolveItinerary(trail?.days, tour?.pricingTiers, pkg)
    if (itineraryDays.length > 0 && a.date) {
      itineraryDays.forEach((day, i) => {
        push(addDaysIso(a.date!, day.dateOffset), {
          time: day.dateOffset === 0 ? 'Departure' : `Day ${i + 1}`,
          title: day.label || `${a.title} — Day ${i + 1}`,
          detail: [day.description, day.accommodation ? `Overnight: ${day.accommodation}` : '', day.transport || '', day.meals || '']
            .filter(Boolean).join(' · '),
        })
      })
    } else {
      push(a.date, {
        time: a.type === 'event' ? 'Event' : 'Activity',
        title: a.title,
        detail: [
          a.operator ? `with ${a.operator}` : '',
          `${a.guests} guest${a.guests !== 1 ? 's' : ''}`,
          a.location || '',
        ].filter(Boolean).join(' · '),
      })
    }
  }
  if (b.stay && b.checkOut) {
    push(b.checkOut, {
      time: 'By 10:00',
      title: `Check out — ${b.stay.title}`,
      detail: 'Settle any extras directly with the property before departure.',
    })
  }

  const dated = [...days.entries()].filter(([d]) => d)
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([date, events], i) => ({ date, label: `Day ${i + 1} — ${fmtLong(date)}`, events }))
  const undated = days.get('')
  if (undated?.length) dated.push({ date: '', label: 'Anytime during your stay', events: undated })
  return dated
}

export default function PrintableItineraryPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<SavedBooking | null>(null)
  const [departures, setDepartures] = useState<Departure[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params?.id) return
    Promise.all([
      getBookingById(decodeURIComponent(params.id)),
      getDepartures(),
      getTours(),
      getTrails(),
    ]).then(([b, deps, trs, trls]) => {
      setBooking(b)
      setDepartures(deps)
      setTours(trs)
      setTrails(trls)
      setLoading(false)
    })
  }, [params?.id])

  const schedule = useMemo(() => booking ? buildSchedule(booking, departures, tours, trails) : [], [booking, departures, tours, trails])

  if (loading) {
    return <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center pt-24 font-sans text-sm text-gray-400">Preparing your itinerary…</div>
  }
  if (!booking) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex flex-col items-center justify-center pt-24 gap-3">
        <p className="font-sans text-sm text-gray-500">Itinerary not found, or you don't have access to it.</p>
        <button onClick={() => router.back()} className="font-sans text-sm text-[#2d6a4f] hover:underline">Go back</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2] pt-28 pb-16 px-4">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #itinerary-doc, #itinerary-doc * { visibility: visible !important; }
          #itinerary-doc { position: absolute !important; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none !important; border: none !important; }
          @page { margin: 12mm; }
        }
      `}</style>

      <div className="max-w-[840px] mx-auto">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#245741] transition-colors">
            <Printer size={14} /> Print / Save as PDF
          </button>
        </div>

        <div id="itinerary-doc" className="bg-white border border-gray-200">
          {/* Header */}
          <div className="bg-[#000000] text-white px-10 py-8 flex items-start justify-between">
            <div>
              <Logo className="h-5 w-auto text-[#C9A96E]" />
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-white/40 mt-3">Trip Itinerary</p>
              <h1 className="font-display italic text-3xl mt-1">{booking.region || 'Drakensberg'} Adventure</h1>
            </div>
            <div className="text-right">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-white/40">Booking Reference</p>
              <p className="font-display italic text-2xl text-[#C9A96E] tracking-wider">{booking.reference}</p>
              <p className="font-sans text-xs text-white/50 mt-2">{fmtShort(booking.checkIn)}{booking.checkOut && booking.checkOut !== booking.checkIn ? ` — ${fmtShort(booking.checkOut)}` : ''}</p>
            </div>
          </div>

          <div className="px-10 py-8">
            {/* Traveller + trip facts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 border-b border-gray-200">
              {[
                ['Lead Traveller', booking.customerName],
                ['Guests', `${booking.guests} guest${booking.guests !== 1 ? 's' : ''}`],
                ['Nights', booking.nights ? `${booking.nights} night${booking.nights !== 1 ? 's' : ''}` : '—'],
                ['Contact', booking.customerPhone || booking.customerEmail],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">{k}</p>
                  <p className="font-sans text-sm text-gray-800 break-words">{v || '—'}</p>
                </div>
              ))}
            </div>

            {/* Accommodation */}
            {booking.stay && (
              <div className="py-6 border-b border-gray-200">
                <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#C9A96E] mb-2">Accommodation</p>
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="font-display italic text-2xl text-[#000000]">{booking.stay.title}</p>
                    {booking.stay.roomName && <p className="font-sans text-sm text-[#2d6a4f] mt-0.5">{booking.stay.roomName}</p>}
                    <p className="font-sans text-xs text-gray-500 mt-1">{[booking.stay.region, booking.stay.address].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-sans text-xs text-gray-500">Check-in <span className="text-gray-800 font-medium">{fmtShort(booking.checkIn)}</span> from 14:00</p>
                    <p className="font-sans text-xs text-gray-500 mt-1">Check-out <span className="text-gray-800 font-medium">{fmtShort(booking.checkOut)}</span> by 10:00</p>
                  </div>
                </div>
              </div>
            )}

            {/* Day-by-day schedule */}
            <div className="py-6 border-b border-gray-200">
              <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#C9A96E] mb-4">Day-by-Day Schedule</p>
              {schedule.length === 0 && <p className="font-sans text-sm text-gray-400">No scheduled items on this booking.</p>}
              <div className="space-y-5">
                {schedule.map(day => (
                  <div key={day.label}>
                    <p className="font-display italic text-lg text-[#000000] mb-2">{day.label}</p>
                    <div className="space-y-2">
                      {day.events.map((ev, i) => (
                        <div key={i} className="flex gap-4 pl-1">
                          <div className="w-20 shrink-0 pt-0.5">
                            <span className="font-sans text-[10px] tracking-[0.08em] uppercase text-gray-400">{ev.time}</span>
                          </div>
                          <div className="border-l-2 border-[#2d6a4f]/30 pl-4 pb-1">
                            <p className="font-sans text-sm font-medium text-gray-800">{ev.title}</p>
                            {ev.detail && <p className="font-sans text-xs text-gray-500 mt-0.5">{ev.detail}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Special requests */}
            {booking.specialRequests && (
              <div className="py-6 border-b border-gray-200">
                <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#C9A96E] mb-2">Special Requests</p>
                <p className="font-sans text-sm text-gray-700">{booking.specialRequests}</p>
              </div>
            )}

            {/* Payment summary */}
            <div className="py-6 border-b border-gray-200 flex items-start justify-between gap-8">
              <div>
                <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#C9A96E] mb-2">Payment Summary</p>
                <p className="font-sans text-xs text-gray-500 leading-relaxed">
                  Booked {fmtShort(booking.createdAt)} · Status: <span className="capitalize">{booking.status}</span><br />
                  Your full tax invoice is available under Account → Orders &amp; Invoices.
                </p>
              </div>
              <table className="shrink-0 font-sans text-sm">
                <tbody>
                  <tr><td className="pr-8 py-0.5 text-gray-500">Subtotal</td><td className="text-right">{formatMoney(booking.subtotal)}</td></tr>
                  <tr><td className="pr-8 py-0.5 text-gray-500">Service fee</td><td className="text-right">{formatMoney(booking.serviceFee)}</td></tr>
                  <tr><td className="pr-8 py-0.5 text-gray-500">VAT</td><td className="text-right">{formatMoney(booking.vat)}</td></tr>
                  <tr className="border-t border-gray-300"><td className="pr-8 pt-1 font-medium text-[#000000]">Total</td><td className="text-right pt-1 font-display italic text-xl text-[#2d6a4f]">{formatMoney(booking.total)}</td></tr>
                </tbody>
              </table>
            </div>

            {/* Emergency contacts */}
            <div className="py-6">
              <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#C9A96E] mb-3">Emergency Contacts</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
                {EMERGENCY.map(([label, number]) => (
                  <div key={label} className="flex justify-between gap-3 font-sans text-xs">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-800 font-medium whitespace-nowrap">{number}</span>
                  </div>
                ))}
              </div>
              <p className="font-sans text-[10px] text-gray-400 mt-5 leading-relaxed">
                Carry this itinerary and photo ID at check-in. Weather in the Drakensberg changes quickly —
                confirm trail conditions with your guide or Ezemvelo before setting out.
                Visit Drakensberg · KwaZulu-Natal, South Africa · bookings@visitdrakensberg.co.za
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

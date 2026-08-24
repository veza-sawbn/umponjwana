'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin, Calendar, Download, ArrowRight, Mountain, Bus,
  Phone, Mail, Users, CheckCircle, XCircle, AlertCircle, Share2,
  Navigation, Shield, HeartPulse, CreditCard, Copy, Facebook,
  MessageCircle, Printer, ExternalLink, ChevronDown, ChevronUp,
  Info, Backpack, Clock, UserCircle, Send, Star,
} from 'lucide-react'
import { getBookingById, type SavedBooking } from '@/lib/bookings'
import { getTours, resolveItinerary, type Tour } from '@/lib/tours'
import { getDepartures, type Departure } from '@/lib/departures'
import { getTrails, type Trail } from '@/lib/trails'
import { getPropertyById } from '@/lib/properties'
import { supabase } from '@/lib/auth'
import {
  getOrCreateThread, sendMessage, getThreadsByBooking,
  type MessageThread,
} from '@/lib/messages'
import SupplierMessageBlock from '@/components/messaging/SupplierMessageBlock'
import { resolveLivePackages } from '@/components/tours/PackageEditor'

/* ── helpers ────────────────────────────────────────────── */
function fmtLong(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function fmt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/* ── collapsible section ────────────────────────────────── */
function Section({
  title, icon: Icon, children, defaultOpen = true, accent = false,
}: {
  title: string; icon: any; children: React.ReactNode
  defaultOpen?: boolean; accent?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`border overflow-hidden ${accent ? 'border-[#2d6a4f]/30' : 'border-gray-200'} bg-white`}>
      <button
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F7F5F2] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <Icon size={16} className={accent ? 'text-[#2d6a4f]' : 'text-[#C9A96E]'} />
          <span className="font-display italic text-lg text-[#000000]">{title}</span>
        </div>
        {open
          ? <ChevronUp size={15} className="text-gray-400" />
          : <ChevronDown size={15} className="text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6 pt-1">{children}</div>}
    </div>
  )
}

/* ── copy button ────────────────────────────────────────── */
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="inline-flex items-center gap-1 font-sans text-xs text-gray-400 hover:text-[#2d6a4f] transition-colors"
    >
      <Copy size={11} />{copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

/* ── share buttons ──────────────────────────────────────── */
function ShareButtons({ booking }: { booking: SavedBooking }) {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const text = `My Drakensberg booking — Ref: ${booking.reference}`
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { label: 'WhatsApp', icon: MessageCircle, cls: 'bg-[#25D366] hover:bg-[#1ebe57]', href: `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}` },
        { label: 'Facebook', icon: Facebook, cls: 'bg-[#1877F2] hover:bg-[#166ddb]', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
        { label: 'Email', icon: Mail, cls: 'bg-gray-700 hover:bg-gray-800', href: `mailto:?subject=${encodeURIComponent('My Drakensberg Itinerary')}&body=${encodeURIComponent(text + '\n' + url)}` },
        { label: 'Print', icon: Printer, cls: 'bg-[#2d6a4f] hover:bg-[#235a3f]', onClick: () => window.open(`/itinerary/${booking.id}/print`, '_blank') },
      ].map(c => {
        const Icon = c.icon
        return 'onClick' in c ? (
          <button key={c.label} onClick={c.onClick}
            className={`inline-flex items-center gap-2 px-3 py-2 font-sans text-xs text-white transition-colors ${c.cls}`}>
            <Icon size={13} />{c.label}
          </button>
        ) : (
          <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 px-3 py-2 font-sans text-xs text-white transition-colors ${c.cls}`}>
            <Icon size={13} />{c.label}
          </a>
        )
      })}
    </div>
  )
}

/* ── emergency numbers ──────────────────────────────────── */
const EMERGENCY = [
  { label: 'Police', number: '10111' },
  { label: 'Ambulance / Fire', number: '10177' },
  { label: 'Mountain Rescue (MCSA)', number: '082 911' },
  { label: 'Ezemvelo KZN Wildlife', number: '+27 33 845 1000' },
  { label: 'ER24 Private', number: '084 124' },
  { label: 'Netcare 911', number: '082 911' },
]

/* ── inline message panel ───────────────────────────────── */
function MessagePanel({
  thread, currentUserName, onSend,
}: {
  thread: MessageThread | null
  currentUserName: string
  onSend: (body: string) => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread?.messages.length])

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSending(true)
    await onSend(trimmed)
    setBody('')
    setSending(false)
  }

  return (
    <div className="flex flex-col h-80">
      {/* messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-[#F7F5F2]">
        {(!thread || thread.messages.length === 0) && (
          <p className="font-sans text-xs text-gray-400 text-center pt-6">
            No messages yet. Send the first message to the operator.
          </p>
        )}
        {thread?.messages.map(m => (
          <div key={m.id} className={`flex ${m.from === 'visitor' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2.5 ${m.from === 'visitor' ? 'bg-[#2d6a4f] text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
              <p className={`font-sans text-[10px] mb-1 ${m.from === 'visitor' ? 'text-white/60' : 'text-gray-400'}`}>{m.senderName}</p>
              <p className="font-sans text-sm leading-relaxed">{m.body}</p>
              <p className={`font-sans text-[10px] mt-1 ${m.from === 'visitor' ? 'text-white/40' : 'text-gray-300'}`}>
                {new Date(m.createdAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {/* composer */}
      <div className="flex gap-2 p-3 border-t border-gray-200 bg-white">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Type your message… (Enter to send)"
          rows={2}
          className="flex-1 font-sans text-sm border border-gray-200 px-3 py-2 outline-none focus:border-[#2d6a4f] resize-none"
        />
        <button
          onClick={handleSend}
          disabled={sending || !body.trim()}
          className="shrink-0 flex items-center gap-1.5 bg-[#2d6a4f] text-white px-4 font-sans text-sm hover:bg-[#235a3f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={14} />{sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

/* ── experience section ─────────────────────────────────── */
function ExperienceSection({
  addon, departure, tour, trail, booking, currentUser,
}: {
  addon: SavedBooking['addons'][0]
  departure: Departure | null
  tour: Tour | null
  trail: Trail | null
  booking: SavedBooking
  currentUser: { id: string; name: string; email: string } | null
}) {
  const [showMsg, setShowMsg] = useState(false)
  const [thread, setThread] = useState<MessageThread | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)

  // Resolve supplier identity: the addon carries the supplier it was booked
  // with; departure/tour are fallbacks for legacy bookings. Empty string =
  // platform-arranged (thread lands in the Visit Drakensberg admin inbox).
  const resolvedSupplierId = addon.supplierId || departure?.supplierId || tour?.supplierId || ''
  const resolvedSupplierName = addon.operator || tour?.supplierName || departure?.supplierName || 'Visit Drakensberg'

  // Which rate package this guest actually booked (if any), so the
  // day-by-day itinerary below — and the duration/date facts — show exactly
  // what they paid for: the trail's default plan (edited at /admin/trails),
  // narrowed/customized/extended by that package's pricing tier.
  const livePackages = departure?.packages ? resolveLivePackages(departure.packages, tour ?? undefined) : []
  const bookedPackage = livePackages.find(p => p.id === addon.packageId)
  const itineraryDays = resolveItinerary(trail?.days, tour?.pricingTiers, bookedPackage)
  const displayDays = itineraryDays.length || tour?.days || departure?.tourDays
  // addon.date is the departure's "hiking date" (the anchor every day's
  // dateOffset is measured from) — a tier's extra day before it can push
  // the guest's actual trip start earlier than that.
  function dateForOffset(offset: number): string {
    if (!addon.date) return ''
    const d = new Date(addon.date)
    d.setDate(d.getDate() + offset)
    return d.toISOString().slice(0, 10)
  }
  const tripStartDate = itineraryDays.length > 0 ? dateForOffset(itineraryDays[0].dateOffset) : addon.date

  async function openMessages() {
    if (!currentUser) return
    setShowMsg(true)
    if (thread) return
    setThreadLoading(true)
    const t = await getOrCreateThread(
      booking.id,
      booking.reference,
      currentUser.id,
      currentUser.name,
      currentUser.email,
      resolvedSupplierId,
      resolvedSupplierName,
      addon.title,
    )
    setThread(t)
    setThreadLoading(false)
  }

  async function handleSend(body: string) {
    if (!thread || !currentUser) return
    const updated = await sendMessage(thread.id, 'visitor', currentUser.name, body)
    if (updated) setThread(updated)
  }

  const gpsUrl = tour?.gpsLat && tour?.gpsLng
    ? `https://maps.google.com/?q=${tour.gpsLat},${tour.gpsLng}`
    : tour?.meetingPoint
      ? `https://maps.google.com/?q=${encodeURIComponent(tour.meetingPoint)}`
      : null

  return (
    <Section title={addon.title} icon={Mountain} accent>
      <div className="space-y-6">

        {/* ── Top grid: key facts ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#F7F5F2] p-3">
            <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Date</p>
            <p className="font-sans text-sm font-medium">{tripStartDate ? fmtLong(tripStartDate) : '—'}</p>
          </div>
          <div className="bg-[#F7F5F2] p-3">
            <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Participants</p>
            <p className="font-sans text-sm font-medium">{addon.guests} {addon.guests === 1 ? 'person' : 'people'}</p>
          </div>
          {displayDays && (
            <div className="bg-[#F7F5F2] p-3">
              <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Duration</p>
              <p className="font-sans text-sm font-medium">{displayDays} day{displayDays !== 1 ? 's' : ''}</p>
            </div>
          )}
          {tour?.difficulty && (
            <div className="bg-[#F7F5F2] p-3">
              <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Difficulty</p>
              <p className="font-sans text-sm font-medium">{tour.difficulty}</p>
            </div>
          )}
        </div>

        {/* ── Meeting point + GPS ── */}
        {(tour?.meetingPoint || gpsUrl) && (
          <div className="border border-[#2d6a4f]/20 bg-[#2d6a4f]/5 p-4">
            <p className="font-sans text-[10px] uppercase tracking-wider text-[#2d6a4f] mb-2 flex items-center gap-1.5">
              <Navigation size={11} />Meeting Point
            </p>
            <p className="font-sans text-sm text-gray-800 font-medium leading-relaxed">
              {tour?.meetingPoint || 'Trailhead — confirmed by operator before departure'}
            </p>
            {/* Meeting time placeholder — operators should confirm */}
            <div className="flex items-center gap-2 mt-2">
              <Clock size={12} className="text-[#2d6a4f]" />
              <p className="font-sans text-xs text-[#2d6a4f]">
                Meeting time will be confirmed by the operator 24 hrs before your departure.
              </p>
            </div>
            {gpsUrl && (
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[#2d6a4f]/15">
                <a
                  href={gpsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-4 py-2 font-sans text-xs hover:bg-[#235a3f] transition-colors"
                >
                  <Navigation size={13} />Navigate with Google Maps
                </a>
                {tour?.gpsLat && tour?.gpsLng && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-gray-500 bg-white border border-gray-200 px-3 py-2">
                    {tour.gpsLat}, {tour.gpsLng}
                    <CopyBtn text={`${tour.gpsLat}, ${tour.gpsLng}`} />
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Guide info ── */}
        {departure?.guide && (
          <div className="flex items-center gap-3 border border-gray-200 px-4 py-3">
            <UserCircle size={20} className="text-[#2d6a4f] shrink-0" />
            <div>
              <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Your Guide</p>
              <p className="font-sans text-sm font-medium text-gray-800">{departure.guide}</p>
            </div>
            <Star size={14} className="text-[#C9A96E] ml-auto shrink-0" />
          </div>
        )}

        {/* ── Description ── */}
        {tour?.description && (
          <div>
            <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-2">About this Experience</p>
            <p className="font-sans text-sm text-gray-700 leading-relaxed">{tour.description}</p>
          </div>
        )}

        {/* ── Day-by-day itinerary — scoped to the package this guest booked ── */}
        {itineraryDays.length > 0 && (
          <div>
            <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
              <Clock size={11} />Day-by-Day Itinerary{bookedPackage ? ` — ${bookedPackage.name}` : ''}
            </p>
            <div className="space-y-3">
              {itineraryDays.map((day, i) => (
                <div key={i} className="border border-gray-200 p-4">
                  <div className="flex items-baseline gap-3 mb-1 flex-wrap">
                    <span className="font-display italic text-base text-[#2d6a4f] shrink-0">Day {i + 1}</span>
                    <span className="font-sans text-xs text-gray-400">{fmtLong(dateForOffset(day.dateOffset))}</span>
                    {day.label && <span className="font-sans text-sm font-medium text-gray-800">{day.label}</span>}
                  </div>
                  {day.description && <p className="font-sans text-sm text-gray-600 leading-relaxed">{day.description}</p>}
                  {(day.accommodation || day.transport || day.meals) && (
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5 pt-2.5 border-t border-gray-100">
                      {day.accommodation && (
                        <span className="font-sans text-xs text-gray-500"><span className="text-gray-400">Overnight:</span> {day.accommodation}</span>
                      )}
                      {day.transport && (
                        <span className="font-sans text-xs text-gray-500"><span className="text-gray-400">Transport:</span> {day.transport}</span>
                      )}
                      {day.meals && (
                        <span className="font-sans text-xs text-gray-500"><span className="text-gray-400">Meals:</span> {day.meals}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Included / Not included ── */}
        {tour?.included && tour.included.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                <CheckCircle size={11} className="text-[#2d6a4f]" />What&apos;s Included
              </p>
              <ul className="space-y-2">
                {tour.included.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 font-sans text-sm text-gray-700">
                    <CheckCircle size={13} className="text-[#2d6a4f] mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Not included — inferred or from tour data */}
            <div>
              <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                <XCircle size={11} className="text-red-400" />Not Included
              </p>
              <ul className="space-y-2">
                {[
                  'Personal travel insurance',
                  'Meals unless stated above',
                  'Park entry / conservation fees',
                  'Gratuities for guide',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 font-sans text-sm text-gray-500">
                    <XCircle size={13} className="text-red-300 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── What to bring (from trail) ── */}
        {trail?.what_to_bring && trail.what_to_bring.length > 0 && (
          <div>
            <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
              <Backpack size={11} />What to Bring
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {trail.what_to_bring.map((item: string) => (
                <div key={item} className="flex items-start gap-2.5 bg-[#F7F5F2] border border-gray-100 px-3 py-2.5">
                  <CheckCircle size={12} className="text-[#C9A96E] mt-0.5 shrink-0" />
                  <span className="font-sans text-sm text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Fitness notes ── */}
        {tour?.fitnessNotes && (
          <div className="border-l-2 border-[#C9A96E] pl-4">
            <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Fitness &amp; Preparation</p>
            <p className="font-sans text-sm text-gray-600 italic leading-relaxed">{tour.fitnessNotes}</p>
          </div>
        )}

        {/* ── Min age / group size ── */}
        {tour && (tour.minAge > 0 || tour.maxGroup > 0) && (
          <div className="flex flex-wrap gap-3">
            {tour.minAge > 0 && (
              <div className="bg-[#F7F5F2] px-4 py-3">
                <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Minimum Age</p>
                <p className="font-sans text-sm font-medium">{tour.minAge}+</p>
              </div>
            )}
            {tour.maxGroup > 0 && (
              <div className="bg-[#F7F5F2] px-4 py-3">
                <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Max Group</p>
                <p className="font-sans text-sm font-medium">{tour.maxGroup} people</p>
              </div>
            )}
          </div>
        )}

        {/* ── Permit info (from trail) ── */}
        {trail?.permit_required && (
          <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-sans text-sm font-medium text-amber-800">Permit required</p>
              <p className="font-sans text-xs text-amber-700 mt-0.5">
                R{trail.permit_cost} per person. Your guide will arrange the permit. Bring proof of identity.
              </p>
            </div>
          </div>
        )}

        {/* ── Cancellation policy ── */}
        {tour?.cancellation && (
          <div className="border border-amber-200 bg-amber-50 p-4">
            <p className="font-sans text-[10px] uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1.5">
              <Shield size={11} />Cancellation Policy
            </p>
            <p className="font-sans text-xs text-amber-800 leading-relaxed">{tour.cancellation}</p>
          </div>
        )}

        {/* ── Operator contact + message ── */}
        <div className="border border-gray-200">
          <div className="bg-[#000000] text-white p-5">
            <p className="font-sans text-[10px] uppercase tracking-wider text-[#C9A96E] mb-3">Operator / Supplier</p>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-display italic text-xl mb-1">{addon.operator || tour?.supplierName || departure?.supplierName || 'Operator'}</p>
                {tour?.meetingPoint && (
                  <p className="font-sans text-xs text-white/50 flex items-center gap-1">
                    <MapPin size={10} />{tour.meetingPoint}
                  </p>
                )}
              </div>
              {currentUser && (
                <button
                  onClick={openMessages}
                  className="shrink-0 inline-flex items-center gap-2 bg-[#C9A96E] text-[#1a1a1a] px-4 py-2 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors"
                >
                  <MessageCircle size={14} />Message Operator
                </button>
              )}
            </div>
            <p className="font-sans text-xs text-white/40 leading-relaxed mt-3">
              The operator will contact you with final briefing and confirmation before your departure date. You can also message them directly below.
            </p>
          </div>

          {/* inline message thread */}
          {showMsg && (
            <div>
              <div className="px-5 py-3 border-b border-gray-200 bg-[#F7F5F2] flex items-center justify-between">
                <p className="font-sans text-xs font-medium text-gray-700">
                  Message thread with {addon.operator || tour?.supplierName}
                </p>
                <button onClick={() => setShowMsg(false)} className="font-sans text-xs text-gray-400 hover:text-gray-600">Close</button>
              </div>
              {threadLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-5 h-5 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <MessagePanel thread={thread} currentUserName={currentUser?.name ?? ''} onSend={handleSend} />
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}

/* ── main page ──────────────────────────────────────────── */
function ItineraryInner() {
  const params = useSearchParams()
  const id = params.get('id')
  const [booking, setBooking] = useState<SavedBooking | null>(null)
  const [tours, setTours] = useState<Tour[]>([])
  const [departures, setDepartures] = useState<Departure[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string } | null>(null)
  const [staySupplierId, setStaySupplierId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    Promise.all([
      getBookingById(id),
      getTours(),
      getDepartures(),
      getTrails(),
      supabase.auth.getUser(),
    ]).then(async ([b, t, d, tr, { data: { user } }]) => {
      setBooking(b)
      setTours(t)
      setDepartures(d)
      setTrails(tr)
      if (user) {
        setCurrentUser({
          id: user.id,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Visitor',
          email: user.email || '',
        })
      }
      // The stay's supplier account, so "Message Property" reaches the real
      // property owner. Showcase stays have none — those threads go to the
      // Visit Drakensberg team instead.
      if (b?.stay?.id?.startsWith('prop-')) {
        try {
          const prop = await getPropertyById(b.stay.id)
          if (prop?.supplierId) setStaySupplierId(prop.supplierId)
        } catch {}
      }
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

  // Match each addon to its departure (addon.id === departure.id)
  function depForAddon(a: SavedBooking['addons'][0]) {
    return departures.find(d => d.id === a.id) ?? null
  }
  // Match departure → tour → trail
  function tourForDep(dep: Departure | null) {
    if (!dep) return null
    return tours.find(t => t.id === dep.tourId) ?? null
  }
  function trailForTour(t: Tour | null) {
    if (!t) return null
    return trails.find(tr => tr.id === t.trailId) ?? null
  }
  // Fallback: match tour by name/operator if no departure
  function tourFallback(a: SavedBooking['addons'][0]) {
    return tours.find(t => t.name === a.title || (a.operator && t.supplierName === a.operator)) ?? null
  }

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display italic text-3xl text-[#000000]">Your Itinerary</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">
            Ref: <span className="text-[#2d6a4f] font-medium">{booking.reference}</span> · {booking.customerName}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap print:hidden">
          <Link
            href={`/checkout/success?id=${booking.id}`}
            className="flex items-center gap-2 border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
          >
            <Download size={13} />Download PDF
          </Link>
          <Link
            href={`/itinerary/${booking.id}/print`}
            className="flex items-center gap-2 border border-gray-300 text-gray-500 px-4 py-2.5 font-sans text-sm hover:bg-[#F7F5F2] transition-colors"
          >
            <Printer size={13} />Print Itinerary
          </Link>
        </div>
      </div>

      <div className="space-y-4">

        {/* ── Accommodation ── */}
        {booking.stay && (
          <Section title="Accommodation" icon={MapPin}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="font-sans text-[10px] uppercase tracking-wider text-gray-400 mb-1">Property</p>
                  <p className="font-display italic text-2xl">{booking.stay.title}</p>
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
                  <p className="font-display italic text-xl mb-3">{booking.stay.title}</p>
                  <p className="font-sans text-xs text-white/40 leading-relaxed mb-4">Contact the property directly with any special requests or questions about your stay.</p>
                  <SupplierMessageBlock
                    booking={booking}
                    currentUser={currentUser}
                    supplierId={staySupplierId}
                    supplierName={booking.stay.title}
                    serviceTitle={`Stay — ${booking.stay.title}`}
                    buttonLabel="Message Property"
                  />
                </div>
                <div className="border border-amber-200 bg-amber-50 p-4">
                  <p className="font-sans text-[10px] uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1.5">
                    <Shield size={11} />Property Policies
                  </p>
                  <ul className="font-sans text-xs text-amber-800 space-y-1.5">
                    <li>· Check-in from 14:00 · Check-out by 10:00</li>
                    <li>· No smoking inside the property</li>
                    <li>· Pets by prior arrangement only</li>
                    <li>· Cancellation: full refund 7+ days before; 50% within 7 days; non-refundable within 48 hrs</li>
                    <li>· Damage deposit may be charged at check-in</li>
                  </ul>
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* ── Each experience with full tour/trail/departure data ── */}
        {booking.addons.map(a => {
          const dep = depForAddon(a)
          const tour = dep ? tourForDep(dep) : tourFallback(a)
          const trail = trailForTour(tour)
          return (
            <ExperienceSection
              key={a.id}
              addon={a}
              departure={dep}
              tour={tour}
              trail={trail}
              booking={booking}
              currentUser={currentUser}
            />
          )
        })}

        {/* ── Shuttles ── */}
        {booking.shuttles.length > 0 && (
          <Section title={`Shuttle Transfer${booking.shuttles.length > 1 ? 's' : ''}`} icon={Bus} defaultOpen={false}>
            <div className="space-y-6">
              {booking.shuttles.map((shuttle, i) => (
                <div key={shuttle.id} className={i > 0 ? 'pt-6 border-t border-gray-100' : ''}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="font-display italic text-xl mb-1">{shuttle.label}</p>
                      <p className="font-sans text-sm text-gray-500 leading-relaxed">{shuttle.description}</p>
                      <p className="font-sans text-xs text-gray-400 mt-3">Your shuttle operator will confirm pickup time and exact location 24 hours before departure.</p>
                    </div>
                    <p className="font-display italic text-2xl text-[#2d6a4f] shrink-0">R {shuttle.price.toLocaleString()}</p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <SupplierMessageBlock
                      booking={booking}
                      currentUser={currentUser}
                      supplierId=""
                      supplierName="Visit Drakensberg Shuttle Desk"
                      serviceTitle={`Shuttle — ${shuttle.label}`}
                      buttonLabel="Message Shuttle Desk"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Payment summary ── */}
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
                  <span>{booking.stay.title} ({booking.nights}n)</span>
                  <span>R {(booking.stay.price_per_night * booking.nights).toLocaleString()}</span>
                </div>
              )}
              {booking.shuttles.map(shuttle => (
                <div key={shuttle.id} className="flex justify-between font-sans text-sm text-gray-700">
                  <span>{shuttle.label}</span>
                  <span>R {shuttle.price.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              <div className="flex justify-between font-sans text-sm text-gray-500"><span>Subtotal</span><span>R {booking.subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between font-sans text-sm text-gray-500"><span>Service fee (12%)</span><span>R {booking.serviceFee.toLocaleString()}</span></div>
              <div className="flex justify-between font-sans text-sm text-gray-500"><span>VAT (15%)</span><span>R {booking.vat.toLocaleString()}</span></div>
              <div className="flex justify-between font-display italic text-xl text-[#2d6a4f] pt-2 border-t border-gray-100">
                <span>Total paid</span><span>R {booking.total.toLocaleString()}</span>
              </div>
            </div>
            <div className="bg-[#2d6a4f]/5 border border-[#2d6a4f]/15 p-3 flex items-start gap-2">
              <CheckCircle size={13} className="text-[#2d6a4f] mt-0.5 shrink-0" />
              <div>
                <p className="font-sans text-xs text-[#2d6a4f] font-medium">Payment confirmed</p>
                <p className="font-sans text-xs text-gray-500 mt-0.5">Ref: {booking.reference} · {booking.customerEmail}</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Emergency services ── */}
        <Section title="Local Emergency Services" icon={HeartPulse} defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EMERGENCY.map(e => (
              <div key={e.label} className="flex items-center justify-between bg-red-50 border border-red-100 px-4 py-3">
                <span className="font-sans text-sm text-gray-700">{e.label}</span>
                <div className="flex items-center gap-2">
                  <a href={`tel:${e.number}`} className="font-display italic text-lg text-red-600 hover:underline">{e.number}</a>
                  <CopyBtn text={e.number} />
                </div>
              </div>
            ))}
          </div>
          <p className="font-sans text-xs text-gray-400 mt-4 leading-relaxed">
            In a mountain emergency call MCSA with your GPS coordinates, number of people, and nature of injury. Share your itinerary with someone at home before departing.
          </p>
        </Section>

        {/* ── Share ── */}
        <Section title="Share This Trip" icon={Share2} defaultOpen={false}>
          <p className="font-sans text-sm text-gray-500 mb-4">Share your itinerary or invite someone to join your trip.</p>
          <ShareButtons booking={booking} />
          <div className="mt-4 flex items-center gap-3 bg-[#F7F5F2] px-4 py-3">
            <span className="font-sans text-xs text-gray-400 truncate flex-1">{pageUrl}</span>
            <CopyBtn text={pageUrl} />
          </div>
        </Section>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/account', label: 'All Bookings' },
            { href: '/hikes', label: 'Explore More Hikes' },
            { href: '/stays', label: 'Browse Stays' },
          ].map(l => (
            <Link key={l.href} href={l.href}
              className="group bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors p-4 flex items-center justify-between">
              <span className="font-sans text-sm text-gray-700">{l.label}</span>
              <ArrowRight size={13} className="text-gray-400 group-hover:text-[#2d6a4f] transition-colors" />
            </Link>
          ))}
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

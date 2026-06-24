'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, Copy, Send, CheckCircle } from 'lucide-react'

function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-sm font-medium text-black/70">
        {label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

const ROUTES = [
  { label: 'King Shaka Airport → Central Berg', baseFare: 950 },
  { label: 'Durban CBD → Drakensberg Sun', baseFare: 850 },
  { label: 'Central Berg → Monk\'s Cowl Trailhead', baseFare: 350 },
  { label: 'Himeville → Sani Pass (Top)', baseFare: 600 },
  { label: 'Custom route', baseFare: 500 },
]

const VEHICLE_MULTIPLIER: Record<string, number> = {
  '4×4': 1.0,
  'Minibus': 1.4,
  'Sedan': 0.9,
}

function generateRef() {
  return 'VD-' + String(Math.floor(1000 + Math.random() * 9000))
}

function fmt(n: number) {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`
}

export default function EstimatorPage() {
  const router = useRouter()
  const [quoteRef] = useState(generateRef)

  // Form state
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [routeIndex, setRouteIndex] = useState(0)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [passengers, setPassengers] = useState(1)
  const [vehicleType, setVehicleType] = useState('4×4')
  const [luggage, setLuggage] = useState('Standard')
  const [extraStops, setExtraStops] = useState(0)
  const [returnTrip, setReturnTrip] = useState(false)
  const [notes, setNotes] = useState('')

  // Quote action state
  const [copyMsg, setCopyMsg] = useState('')
  const [sendMsg, setSendMsg] = useState('')
  const [paid, setPaid] = useState(false)

  const selectedRoute = ROUTES[routeIndex]
  const isCustom = selectedRoute.label === 'Custom route'

  const routeLabel = isCustom
    ? (customFrom && customTo ? `${customFrom} → ${customTo}` : 'Custom route')
    : selectedRoute.label

  // Pricing computation
  const { baseFare, luggageSurcharge, extraStopsTotal, subtotal, total, lineItems } = useMemo(() => {
    const base = selectedRoute.baseFare
    const multiplier = VEHICLE_MULTIPLIER[vehicleType] ?? 1.0
    const baseFare = Math.round(base * multiplier)
    const luggageSurcharge = luggage === 'Heavy' ? 200 : 0
    const extraStopsTotal = extraStops * 150

    let subtotal = baseFare
    if (returnTrip) subtotal = subtotal * 2
    const total = subtotal + luggageSurcharge + extraStopsTotal

    const lineItems = [
      { label: 'Base fare', sublabel: `${selectedRoute.label} · ${vehicleType}${returnTrip ? ' · Return' : ''}`, amount: subtotal },
      ...(luggageSurcharge > 0 ? [{ label: 'Heavy luggage surcharge', sublabel: '', amount: luggageSurcharge }] : []),
      ...(extraStopsTotal > 0 ? [{ label: `Extra stops (×${extraStops})`, sublabel: 'R150 per stop', amount: extraStopsTotal }] : []),
    ]

    return { baseFare, luggageSurcharge, extraStopsTotal, subtotal, total, lineItems }
  }, [routeIndex, vehicleType, luggage, extraStops, returnTrip, selectedRoute])

  function handleCopyLink() {
    setCopyMsg('Link copied!')
    setTimeout(() => setCopyMsg(''), 2500)
  }

  function handleSend() {
    setSendMsg(`Quote sent to ${guestEmail || 'guest'}!`)
    setTimeout(() => setSendMsg(''), 3000)
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-9 h-9 rounded-full border border-black/8 bg-white hover:bg-black/5 transition-colors"
          >
            <ChevronLeft size={18} className="text-black/60" />
          </button>
          <div>
            <h1 className="font-display italic text-2xl font-semibold text-black">Route Estimator</h1>
            <p className="font-sans text-sm text-black/50 mt-0.5">Build and send instant quotations to guests</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
          {/* LEFT: Estimator Form */}
          <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
            <h2 className="font-display italic text-base font-medium text-black">Trip Details</h2>

            {/* Guest */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <F label="Guest Name">
                <input className={INPUT} value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Jane Smith" />
              </F>
              <F label="Guest Email">
                <input className={INPUT} type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="jane@example.com" />
              </F>
            </div>

            {/* Route */}
            <F label="Route" required>
              <select className={INPUT} value={routeIndex} onChange={e => setRouteIndex(Number(e.target.value))}>
                {ROUTES.map((r, i) => (
                  <option key={i} value={i}>{r.label}</option>
                ))}
              </select>
            </F>

            {isCustom && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pl-3 border-l-2 border-[#C9A96E]/40">
                <F label="From" required>
                  <input className={INPUT} value={customFrom} onChange={e => setCustomFrom(e.target.value)} placeholder="Pickup location" />
                </F>
                <F label="To" required>
                  <input className={INPUT} value={customTo} onChange={e => setCustomTo(e.target.value)} placeholder="Drop-off location" />
                </F>
              </div>
            )}

            {/* Date & Time */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <F label="Pickup Date" required>
                <input className={INPUT} type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
              </F>
              <F label="Pickup Time" required>
                <input className={INPUT} type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} />
              </F>
            </div>

            {/* Passengers & Vehicle */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <F label="Passengers" required>
                <input className={INPUT} type="number" min={1} max={50} value={passengers} onChange={e => setPassengers(Number(e.target.value))} />
              </F>
              <F label="Vehicle Type" required>
                <select className={INPUT} value={vehicleType} onChange={e => setVehicleType(e.target.value)}>
                  <option>4×4</option>
                  <option>Minibus</option>
                  <option>Sedan</option>
                </select>
              </F>
              <F label="Luggage">
                <select className={INPUT} value={luggage} onChange={e => setLuggage(e.target.value)}>
                  <option>Light</option>
                  <option>Standard</option>
                  <option>Heavy</option>
                </select>
              </F>
            </div>

            {/* Extra Stops */}
            <F label="Extra Stops">
              <div className="flex items-center gap-3">
                <input
                  className={`${INPUT} max-w-[120px]`}
                  type="number"
                  min={0}
                  max={10}
                  value={extraStops}
                  onChange={e => setExtraStops(Number(e.target.value))}
                />
                <span className="font-sans text-xs text-black/40">R150 per additional stop</span>
              </div>
            </F>

            {/* Return Trip Toggle */}
            <div className="flex items-center gap-3 py-1">
              <button
                type="button"
                onClick={() => setReturnTrip(v => !v)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${returnTrip ? 'bg-[#C9A96E]' : 'bg-black/20'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${returnTrip ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <span className="font-sans text-sm font-medium text-black/70">Return trip <span className="text-black/40 font-normal">(doubles base fare)</span></span>
            </div>

            {/* Notes */}
            <F label="Notes">
              <textarea
                className={`${INPUT} resize-none`}
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Special requests, accessibility needs, pickup instructions..."
              />
            </F>
          </div>

          {/* RIGHT: Quote Preview */}
          <div className="bg-white rounded-xl border border-black/8 overflow-hidden sticky top-6">
            {/* Quote header */}
            <div className="bg-black px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display italic text-white/50 text-xs mb-0.5">Quotation</p>
                  <p className="font-display italic text-white text-lg font-semibold">{quoteRef}</p>
                </div>
                <div className="text-right">
                  <p className="font-sans text-white/40 text-xs">Visit Drakensberg</p>
                  <p className="font-sans text-white/60 text-xs mt-0.5">Shuttle Supplier Portal</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Trip summary */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="font-sans text-xs text-black/40 w-20 flex-shrink-0 pt-0.5">Route</span>
                  <span className="font-sans text-sm text-black font-medium leading-snug">{routeLabel}</span>
                </div>
                {(pickupDate || pickupTime) && (
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-xs text-black/40 w-20 flex-shrink-0">Date / Time</span>
                    <span className="font-sans text-sm text-black">
                      {pickupDate ? new Date(pickupDate + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      {pickupTime ? ` at ${pickupTime}` : ''}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-sans text-xs text-black/40 w-20 flex-shrink-0">Passengers</span>
                  <span className="font-sans text-sm text-black">{passengers}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-sans text-xs text-black/40 w-20 flex-shrink-0">Vehicle</span>
                  <span className="font-sans text-sm text-black">{vehicleType}</span>
                </div>
                {guestName && (
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-xs text-black/40 w-20 flex-shrink-0">Guest</span>
                    <span className="font-sans text-sm text-black">{guestName}</span>
                  </div>
                )}
              </div>

              {/* Line items */}
              <div className="border-t border-black/5 pt-4 space-y-2">
                {lineItems.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-sans text-sm text-black/80">{item.label}</p>
                      {item.sublabel && <p className="font-sans text-xs text-black/40 mt-0.5">{item.sublabel}</p>}
                    </div>
                    <span className="font-sans text-sm text-black font-medium flex-shrink-0">{fmt(item.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="border-t border-black/8 pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-sm font-medium text-black/60">Total</span>
                  <span className="font-display italic text-2xl font-bold text-[#C9A96E]">{fmt(total)}</span>
                </div>
                <p className="font-sans text-xs text-black/30 mt-1">Includes all fees · ZAR</p>
              </div>

              {/* Toast messages */}
              {copyMsg && (
                <div className="bg-black/5 rounded-lg px-3 py-2 font-sans text-xs text-black/60 text-center">
                  {copyMsg}
                </div>
              )}
              {sendMsg && (
                <div className="bg-emerald-50 rounded-lg px-3 py-2 font-sans text-xs text-emerald-700 text-center">
                  {sendMsg}
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center justify-center gap-1.5 font-sans text-sm px-3 py-2 rounded-lg border border-black/10 text-black/60 hover:bg-black/5 transition-colors"
                  >
                    <Copy size={14} />
                    Copy Link
                  </button>
                  <button
                    onClick={handleSend}
                    className="flex items-center justify-center gap-1.5 font-sans text-sm px-3 py-2 rounded-lg bg-[#C9A96E] text-white hover:bg-[#b8935a] transition-colors"
                  >
                    <Send size={14} />
                    Send to Guest
                  </button>
                </div>

                {/* Mark as Paid */}
                <button
                  onClick={() => setPaid(true)}
                  disabled={paid}
                  className={`w-full flex items-center justify-center gap-2 font-sans text-sm px-3 py-2.5 rounded-lg transition-colors ${
                    paid
                      ? 'bg-emerald-500 text-white cursor-default'
                      : 'border border-black/10 text-black/60 hover:bg-black/5'
                  }`}
                >
                  {paid ? (
                    <>
                      <CheckCircle size={15} />
                      Paid ✓
                    </>
                  ) : (
                    'Mark as Paid'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

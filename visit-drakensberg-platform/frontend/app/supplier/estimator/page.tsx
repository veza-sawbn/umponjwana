'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { ChevronLeft, Copy, Send, CheckCircle, MapPin, Plus, Trash2, Calculator } from 'lucide-react'

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

type GeoPoint = {
  lat: number
  lng: number
}

type EstimatorCustomFee = {
  id: number
  label: string
  amount: number
}

type VehicleRateKey = '4×4' | 'Minibus' | 'Sedan'

const VEHICLE_TYPES: VehicleRateKey[] = ['4×4', 'Minibus', 'Sedan']

const DEFAULT_VEHICLE_RATES: Record<VehicleRateKey, number> = {
  '4×4': 14,
  Minibus: 18,
  Sedan: 11,
}


function generateRef() {
  return 'VD-' + String(Math.floor(1000 + Math.random() * 9000))
}

function fmt(n: number) {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`
}

function toRad(value: number) {
  return (value * Math.PI) / 180
}

function calculateDistanceKm(from: GeoPoint, to: GeoPoint) {
  const earthRadiusKm = 6371
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  // Road transfers are usually longer than straight-line distances; this keeps the estimator practical without a maps API key.
  return Math.round(earthRadiusKm * c * 1.25)
}

function isVehicleRateKey(value: string): value is VehicleRateKey {
  return VEHICLE_TYPES.includes(value as VehicleRateKey)
}

export default function EstimatorPage() {
  const router = useRouter()
  const [quoteRef] = useState(generateRef)

  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [pickupAddress, setPickupAddress] = useState('King Shaka International Airport, Durban')
  const [dropoffAddress, setDropoffAddress] = useState('Champagne Valley, Central Drakensberg')
  const [distanceKm, setDistanceKm] = useState(0)
  const [distanceStatus, setDistanceStatus] = useState('Enter pickup and drop-off addresses, then calculate distance.')
  const [calculatingDistance, setCalculatingDistance] = useState(false)
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [passengers, setPassengers] = useState(1)
  const [vehicleType, setVehicleType] = useState<VehicleRateKey>('4×4')
  const [luggage, setLuggage] = useState('Standard')
  const [vehicleRates, setVehicleRates] = useState<Record<VehicleRateKey, number>>(DEFAULT_VEHICLE_RATES)
  const [minimumFare, setMinimumFare] = useState(350)
  const [fees, setFees] = useState<EstimatorCustomFee[]>([{ id: 1, label: 'Booking/admin fee', amount: 150 }])
  const [returnTrip, setReturnTrip] = useState(false)
  const [notes, setNotes] = useState('')

  const [copyMsg, setCopyMsg] = useState('')
  const [sendMsg, setSendMsg] = useState('')
  const [paid, setPaid] = useState(false)

  const routeLabel = `${pickupAddress || 'Pickup address'} → ${dropoffAddress || 'Drop-off address'}`
  const selectedRatePerKm = vehicleRates[vehicleType] ?? 0

  const { total, lineItems } = useMemo(() => {
    const oneWayDistanceFare = Math.round(distanceKm * Math.max(selectedRatePerKm, 0))
    const minimumAdjustedFare = Math.max(oneWayDistanceFare, Math.max(minimumFare, 0))
    const minimumAdjustment = minimumAdjustedFare - oneWayDistanceFare
    const rawTripFare = returnTrip ? oneWayDistanceFare * 2 : oneWayDistanceFare
    const tripFare = returnTrip ? minimumAdjustedFare * 2 : minimumAdjustedFare
    const luggageSurcharge = luggage === 'Heavy' ? 200 : 0
    const customFeesTotal = fees.reduce((sum, fee) => sum + (Number.isFinite(fee.amount) ? fee.amount : 0), 0)
    const total = tripFare + luggageSurcharge + customFeesTotal

    const lineItems = [
      { label: 'Distance fare', sublabel: `${distanceKm} km × ${fmt(selectedRatePerKm)} / km · ${vehicleType}${returnTrip ? ' · Return' : ''}`, amount: rawTripFare },
      ...(minimumAdjustment > 0 ? [{ label: 'Minimum fare adjustment', sublabel: `Minimum one-way fare ${fmt(minimumFare)}`, amount: returnTrip ? minimumAdjustment * 2 : minimumAdjustment }] : []),
      ...(luggageSurcharge > 0 ? [{ label: 'Heavy luggage surcharge', sublabel: '', amount: luggageSurcharge }] : []),
      ...fees.filter(fee => fee.label || fee.amount).map(fee => ({ label: fee.label || 'Custom fee', sublabel: 'Supplier-added fee', amount: fee.amount || 0 })),
    ]

    return { total, lineItems }
  }, [distanceKm, selectedRatePerKm, vehicleType, returnTrip, luggage, fees, minimumFare])


  function handleVehicleTypeChange(value: string) {
    if (isVehicleRateKey(value)) setVehicleType(value)
  }

  function updateVehicleRate(type: VehicleRateKey, value: string) {
    setVehicleRates(current => ({ ...current, [type]: Number(value) }))
  }

  async function geocodeAddress(address: string): Promise<GeoPoint | null> {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`)
    const results = await response.json()
    if (!Array.isArray(results) || !results[0]) return null
    return { lat: Number(results[0].lat), lng: Number(results[0].lon) }
  }

  async function calculateAddressDistance() {
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      setDistanceStatus('Add both a pickup and drop-off address before calculating distance.')
      return
    }

    setCalculatingDistance(true)
    setDistanceStatus('Finding addresses and calculating route distance…')
    try {
      const [from, to] = await Promise.all([geocodeAddress(pickupAddress), geocodeAddress(dropoffAddress)])
      if (!from || !to) {
        setDistanceStatus('Could not find one of those addresses. Add more detail and try again.')
        return
      }

      const routeResponse = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`)
      const routeData = await routeResponse.json()
      const routeDistance = routeData?.routes?.[0]?.distance
      const nextDistanceKm = routeDistance ? Math.round(routeDistance / 1000) : calculateDistanceKm(from, to)
      setDistanceKm(nextDistanceKm)
      setDistanceStatus(routeDistance ? 'Distance calculated from the entered addresses.' : 'Road route unavailable; using an adjusted straight-line estimate.')
    } catch (error) {
      console.error('[estimator] distance calculation failed:', error)
      setDistanceStatus('Distance service is unavailable right now. Please try again or enter a manual estimate later.')
    } finally {
      setCalculatingDistance(false)
    }
  }

  function updateFee(id: number, field: keyof Omit<EstimatorCustomFee, 'id'>, value: string) {
    setFees(current => current.map(fee => fee.id === id ? { ...fee, [field]: field === 'amount' ? Number(value) : value } : fee))
  }

  function addFee() {
    setFees(current => [...current, { id: Date.now(), label: '', amount: 0 }])
  }

  function removeFee(id: number) {
    setFees(current => current.filter(fee => fee.id !== id))
  }

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
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="flex items-center justify-center w-9 h-9 rounded-full border border-black/8 bg-white hover:bg-black/5 transition-colors">
            <ChevronLeft size={18} className="text-black/60" />
          </button>
          <div>
            <h1 className="font-display italic text-2xl font-semibold text-black">Route Estimator</h1>
            <p className="font-sans text-sm text-black/50 mt-0.5">Build distance-based shuttle quotations with your own rates and fees</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
          <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
            <h2 className="font-display italic text-base font-medium text-black">Trip Details</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <F label="Guest Name"><input className={INPUT} value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Jane Smith" /></F>
              <F label="Guest Email"><input className={INPUT} type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="jane@example.com" /></F>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <F label="Pickup Address" required><input className={INPUT} value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="Full pickup address" /></F>
              <F label="Drop-off Address" required><input className={INPUT} value={dropoffAddress} onChange={e => setDropoffAddress(e.target.value)} placeholder="Full drop-off address" /></F>
            </div>

            <div className="rounded-xl border border-[#C9A96E]/20 bg-[#C9A96E]/5 p-4 flex items-start gap-3">
              <MapPin size={18} className="text-[#C9A96E] mt-0.5" />
              <div className="flex-1">
                <p className="font-sans text-sm font-semibold text-black">Estimated route distance: {distanceKm > 0 ? `${distanceKm} km` : 'Not calculated yet'}</p>
                <p className="font-sans text-xs text-black/50 mt-1">{distanceStatus}</p>
              </div>
              <button type="button" onClick={calculateAddressDistance} disabled={calculatingDistance} className="flex items-center gap-1.5 rounded-lg bg-[#C9A96E] px-3 py-2 font-sans text-xs text-white hover:bg-[#b8935a] disabled:opacity-60"><Calculator size={13} /> {calculatingDistance ? 'Calculating…' : 'Calculate'}</button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <F label="Pickup Date" required><input className={INPUT} type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} /></F>
              <F label="Pickup Time" required><input className={INPUT} type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} /></F>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <F label="Passengers" required><input className={INPUT} type="number" min={1} max={50} value={passengers} onChange={e => setPassengers(Number(e.target.value))} /></F>
              <F label="Vehicle Type" required>
                <select className={INPUT} value={vehicleType} onChange={e => handleVehicleTypeChange(e.target.value)}>{VEHICLE_TYPES.map(type => <option key={type}>{type}</option>)}</select>
              </F>
              <F label="Luggage"><select className={INPUT} value={luggage} onChange={e => setLuggage(e.target.value)}><option>Light</option><option>Standard</option><option>Heavy</option></select></F>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {VEHICLE_TYPES.map(type => <F key={type} label={`${type} rate per km`} required><input className={INPUT} type="number" min={0} step="0.5" value={vehicleRates[type]} onChange={e => updateVehicleRate(type, e.target.value)} /></F>)}
              <F label="Minimum One-way Fare"><input className={INPUT} type="number" min={0} step="50" value={minimumFare} onChange={e => setMinimumFare(Number(e.target.value))} /></F>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-sm font-medium text-black/70">Custom Fees</h3>
                <button type="button" onClick={addFee} className="flex items-center gap-1 font-sans text-xs text-[#C9A96E] hover:text-[#b8935a]"><Plus size={13} /> Add fee</button>
              </div>
              {fees.map(fee => (
                <div key={fee.id} className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <input className={INPUT} value={fee.label} onChange={e => updateFee(fee.id, 'label', e.target.value)} placeholder="Fee name e.g. tolls, trailer, child seat" />
                  <input className={INPUT} type="number" min={0} value={fee.amount} onChange={e => updateFee(fee.id, 'amount', e.target.value)} placeholder="Amount" />
                  <button type="button" onClick={() => removeFee(fee.id)} className="w-10 rounded-lg border border-black/10 text-black/40 hover:text-red-500 hover:border-red-200 flex items-center justify-center"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 py-1">
              <button type="button" onClick={() => setReturnTrip(v => !v)} className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${returnTrip ? 'bg-[#C9A96E]' : 'bg-black/20'}`}><span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${returnTrip ? 'translate-x-4' : 'translate-x-0'}`} /></button>
              <span className="font-sans text-sm font-medium text-black/70">Return trip <span className="text-black/40 font-normal">(doubles distance fare)</span></span>
            </div>

            <F label="Notes"><textarea className={`${INPUT} resize-none`} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special requests, accessibility needs, pickup instructions..." /></F>
          </div>

          <div className="bg-white rounded-xl border border-black/8 overflow-hidden sticky top-6">
            <div className="bg-black px-5 py-4">
              <div className="flex items-start justify-between"><div><p className="font-display italic text-white/50 text-xs mb-0.5">Quotation</p><p className="font-display italic text-white text-lg font-semibold">{quoteRef}</p></div><div className="text-right"><p className="font-sans text-white/40 text-xs">Visit Drakensberg</p><p className="font-sans text-white/60 text-xs mt-0.5">Shuttle Supplier Portal</p></div></div>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-start gap-2"><span className="font-sans text-xs text-black/40 w-20 flex-shrink-0 pt-0.5">Route</span><span className="font-sans text-sm text-black font-medium leading-snug">{routeLabel}</span></div>
                <div className="flex items-center gap-2"><span className="font-sans text-xs text-black/40 w-20 flex-shrink-0">Distance</span><span className="font-sans text-sm text-black">{distanceKm} km</span></div>
                {(pickupDate || pickupTime) && <div className="flex items-center gap-2"><span className="font-sans text-xs text-black/40 w-20 flex-shrink-0">Date / Time</span><span className="font-sans text-sm text-black">{pickupDate ? new Date(pickupDate + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}{pickupTime ? ` at ${pickupTime}` : ''}</span></div>}
                <div className="flex items-center gap-2"><span className="font-sans text-xs text-black/40 w-20 flex-shrink-0">Passengers</span><span className="font-sans text-sm text-black">{passengers}</span></div>
                <div className="flex items-center gap-2"><span className="font-sans text-xs text-black/40 w-20 flex-shrink-0">Vehicle</span><span className="font-sans text-sm text-black">{vehicleType}</span></div>
                {guestName && <div className="flex items-center gap-2"><span className="font-sans text-xs text-black/40 w-20 flex-shrink-0">Guest</span><span className="font-sans text-sm text-black">{guestName}</span></div>}
              </div>

              <div className="border-t border-black/5 pt-4 space-y-2">
                {lineItems.map((item, i) => <div key={i} className="flex items-start justify-between gap-3"><div><p className="font-sans text-sm text-black/80">{item.label}</p>{item.sublabel && <p className="font-sans text-xs text-black/40 mt-0.5">{item.sublabel}</p>}</div><span className="font-sans text-sm text-black font-medium flex-shrink-0">{fmt(item.amount)}</span></div>)}
              </div>

              <div className="border-t border-black/8 pt-4">
                <div className="flex items-center justify-between"><span className="font-sans text-sm font-medium text-black/60">Total</span><span className="font-display italic text-2xl font-bold text-[#C9A96E]">{fmt(total)}</span></div>
                <p className="font-sans text-xs text-black/30 mt-1">Includes all fees · ZAR</p>
              </div>

              {copyMsg && <div className="bg-black/5 rounded-lg px-3 py-2 font-sans text-xs text-black/60 text-center">{copyMsg}</div>}
              {sendMsg && <div className="bg-emerald-50 rounded-lg px-3 py-2 font-sans text-xs text-emerald-700 text-center">{sendMsg}</div>}

              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2"><button onClick={handleCopyLink} className="flex items-center justify-center gap-1.5 font-sans text-sm px-3 py-2 rounded-lg border border-black/10 text-black/60 hover:bg-black/5 transition-colors"><Copy size={14} />Copy Link</button><button onClick={handleSend} className="flex items-center justify-center gap-1.5 font-sans text-sm px-3 py-2 rounded-lg bg-[#C9A96E] text-white hover:bg-[#b8935a] transition-colors"><Send size={14} />Send to Guest</button></div>
                <button onClick={() => setPaid(true)} disabled={paid} className={`w-full flex items-center justify-center gap-2 font-sans text-sm px-3 py-2.5 rounded-lg transition-colors ${paid ? 'bg-emerald-500 text-white cursor-default' : 'border border-black/10 text-black/60 hover:bg-black/5'}`}>{paid ? <><CheckCircle size={15} />Paid ✓</> : 'Mark as Paid'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

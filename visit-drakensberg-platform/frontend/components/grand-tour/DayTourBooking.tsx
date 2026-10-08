'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bus, CalendarDays, Check, Minus, Plus, Ticket, ShoppingBag } from 'lucide-react'
import { useBooking, type BookingAddon } from '@/lib/booking-context'
import { timeslotsForDate, slotRemaining, type Activity } from '@/lib/activities'
import { pickupTime, upcomingDepartures } from '@/lib/grand-tour'
import { formatMoney } from '@/lib/allocation'
import { todayISO } from '@/lib/upcoming'

// The booking panel on a Grand Tour day tour page. It builds exactly the cart
// line the activity page does (lib/booking-context.tsx BookingAddon), so
// checkout holds the seats on that departure and the payment webhook mints
// one boarding ticket per seat with the chosen pickup printed on it.
//
// "Book now" adds the seats and goes straight to checkout — a hotel guest
// booking a seat on a bus needs no transfer step. "Add to trip" keeps them
// browsing.

const SELF = 'self'

const chipDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })

function Stepper({ label, hint, value, min, onChange }: { label: string; hint?: string; value: number; min: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="font-sans text-sm text-black/80">{label}</p>
        {hint && <p className="font-sans text-[11px] text-black/40">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="w-8 h-8 border border-black/20 flex items-center justify-center disabled:opacity-30 hover:border-black/50"><Minus size={13} /></button>
        <span className="w-5 text-center font-sans text-sm tabular-nums" aria-live="polite">{value}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(value + 1)} className="w-8 h-8 border border-black/20 flex items-center justify-center hover:border-black/50"><Plus size={13} /></button>
      </div>
    </div>
  )
}

export default function DayTourBooking({ tour, bookable }: { tour: Activity; bookable: boolean }) {
  const router = useRouter()
  const booking = useBooking()
  const pickups = tour.grandTour?.pickupPoints ?? []
  const hasChildRate = !!tour.childMaxAge
  const childPrice = hasChildRate ? (tour.childPrice || tour.pricePerPerson) : tour.pricePerPerson

  const departures = useMemo(() => upcomingDepartures(tour, { limit: 8 }), [tour])
  const [date, setDate] = useState(departures[0]?.date ?? '')
  const [timeslotId, setTimeslotId] = useState(departures[0]?.timeslotId ?? '')
  const [pickupChoice, setPickupChoice] = useState('')
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [justAdded, setJustAdded] = useState(false)

  // /grand-tour links here with ?date=&pickup= once the visitor has said
  // which hotel they are at and which departure caught their eye.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const qDate = q.get('date')
    if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) {
      setDate(qDate)
      const first = timeslotsForDate(tour, qDate)[0]
      if (first) setTimeslotId(first.id)
    }
    const qPickup = q.get('pickup')
    if (qPickup && pickups.some(p => p.id === qPickup)) setPickupChoice(qPickup)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const daySlots = date ? timeslotsForDate(tour, date) : []
  useEffect(() => {
    if (!daySlots.some(s => s.id === timeslotId)) setTimeslotId(daySlots[0]?.id ?? '')
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  const slot = daySlots.find(s => s.id === timeslotId)
  const seatsLeft = slot ? slotRemaining(tour, date, slot.id) : 0
  const pickup = pickups.find(p => p.id === pickupChoice)
  const guests = adults + children
  const total = adults * tour.pricePerPerson + children * childPrice

  const problem =
    !bookable ? 'This tour is not open for booking yet.'
    : !date ? 'Choose a date.'
    : date < todayISO() ? 'That date has passed.'
    : !slot ? 'No departure runs on this date. Try another day.'
    : seatsLeft <= 0 ? 'This departure is full. Try another day.'
    : guests > seatsLeft ? `Only ${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left on this departure.`
    : guests < 1 ? 'Add at least one guest.'
    : pickups.length > 0 && !pickupChoice ? 'Choose where to be collected.'
    : null

  const addonId = `activity-${tour.id}-${date}${slot ? `-${slot.id}` : ''}${pickup ? `-${pickup.id}` : ''}`
  const inCart = booking.addons.some(a => a.id === addonId)

  function addToCart() {
    if (problem || !slot) return false
    const addon: BookingAddon = {
      id: addonId,
      type: 'activity',
      title: tour.name,
      operator: tour.supplierName || undefined,
      supplierId: tour.supplierId || undefined,
      date,
      price_per_person: guests > 0 ? total / guests : tour.pricePerPerson,
      guests,
      location: tour.meetingPoint || undefined,
      lat: tour.gpsLat || undefined,
      lng: tour.gpsLng || undefined,
      ...(hasChildRate ? { adults, children } : {}),
      activityId: tour.id,
      timeslotId: slot.id,
      timeslotTime: slot.time,
      ...(pickup ? { pickupPointId: pickup.id, pickupPointName: pickup.name, pickupTime: pickupTime(slot, pickup) } : {}),
    }
    // Same departure and pickup already in the cart: replace it, so changing
    // the party size and pressing the button again updates rather than fails.
    if (inCart) booking.removeAddon(addonId)
    booking.addAddon(addon)
    return true
  }

  function bookNow() {
    if (addToCart()) router.push('/checkout')
  }
  function addToTrip() {
    if (addToCart()) { setJustAdded(true); setTimeout(() => setJustAdded(false), 2500) }
  }

  return (
    <div id="book" className="bg-white border border-black/10 p-5 sm:p-6 scroll-mt-24">
      <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-black/45">{hasChildRate ? 'Adult / child seat' : 'Per seat'}</p>
      <p className="font-display italic text-3xl text-[#2d6a4f]">
        {formatMoney(tour.pricePerPerson)}
        {hasChildRate && <span className="text-base text-black/40"> / {formatMoney(childPrice)}</span>}
      </p>

      {/* Departures */}
      <fieldset className="mt-5">
        <legend className="font-sans text-[11px] tracking-[0.14em] uppercase text-black/50 mb-2 flex items-center gap-1.5"><CalendarDays size={12} /> Departure</legend>
        {departures.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {departures.map(d => {
              const on = d.date === date && d.timeslotId === timeslotId
              return (
                <button
                  type="button"
                  key={`${d.date}-${d.timeslotId}`}
                  onClick={() => { setDate(d.date); setTimeslotId(d.timeslotId) }}
                  aria-pressed={on}
                  className={`text-left px-3 py-2 border font-sans text-xs transition-colors ${on ? 'border-[#2d6a4f] bg-[#2d6a4f] text-white' : 'border-black/15 hover:border-black/40'}`}
                >
                  <span className="block font-medium">{chipDate(d.date)}</span>
                  <span className={on ? 'text-white/75' : 'text-black/45'}>{d.time} · {d.seatsLeft} left</span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="font-sans text-xs text-black/50">No open departures in the next two months. Pick a later date below.</p>
        )}
        <label className="block mt-3">
          <span className="font-sans text-[11px] text-black/45">Or another date</span>
          <input type="date" min={todayISO()} value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full border border-black/15 px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
        </label>
        {daySlots.length > 1 && (
          <select value={timeslotId} onChange={e => setTimeslotId(e.target.value)} aria-label="Departure time" className="mt-2 w-full border border-black/15 px-3 py-2 font-sans text-sm">
            {daySlots.map(s => {
              const left = slotRemaining(tour, date, s.id)
              return <option key={s.id} value={s.id} disabled={left <= 0}>{s.time} · {left <= 0 ? 'Full' : `${left} left`}</option>
            })}
          </select>
        )}
      </fieldset>

      {/* Pickup */}
      {pickups.length > 0 && (
        <label className="block mt-5">
          <span className="font-sans text-[11px] tracking-[0.14em] uppercase text-black/50 mb-2 flex items-center gap-1.5"><Bus size={12} /> Hotel pickup</span>
          <select value={pickupChoice} onChange={e => setPickupChoice(e.target.value)} className="w-full border border-black/15 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]">
            <option value="">Where should we collect you?</option>
            {pickups.map(p => (
              <option key={p.id} value={p.id}>{p.name}{slot ? ` · ${pickupTime(slot, p)}` : ''}</option>
            ))}
            <option value={SELF}>I&apos;ll meet the tour{tour.meetingPoint ? ` at ${tour.meetingPoint}` : ''}</option>
          </select>
        </label>
      )}

      {/* Party */}
      <div className="mt-4 border-y border-black/10 py-1">
        <Stepper label="Adults" value={adults} min={hasChildRate ? 0 : 1} onChange={setAdults} />
        {hasChildRate && <Stepper label="Children" hint={`${tour.childMaxAge} and under`} value={children} min={0} onChange={setChildren} />}
      </div>

      <div className="mt-4 space-y-1 font-sans text-sm">
        {adults > 0 && <div className="flex justify-between text-black/60"><span>{formatMoney(tour.pricePerPerson)} × {adults} adult{adults === 1 ? '' : 's'}</span><span>{formatMoney(adults * tour.pricePerPerson)}</span></div>}
        {children > 0 && <div className="flex justify-between text-black/60"><span>{formatMoney(childPrice)} × {children} child{children === 1 ? '' : 'ren'}</span><span>{formatMoney(children * childPrice)}</span></div>}
        <div className="flex justify-between font-medium pt-1"><span>Total</span><span className="text-[#2d6a4f]">{formatMoney(total)}</span></div>
      </div>

      {pickup && slot && !problem && (
        <p className="mt-3 bg-[#2d6a4f]/5 border-l-2 border-[#2d6a4f] px-3 py-2 font-sans text-xs text-black/75">
          Collected at <strong>{pickup.name}</strong> at <strong>{pickupTime(slot, pickup)}</strong> on {chipDate(date)}.
        </p>
      )}
      {problem && <p className="mt-3 font-sans text-xs text-amber-700" role="status">{problem}</p>}

      <button
        type="button"
        onClick={bookNow}
        disabled={!!problem}
        className="mt-5 w-full bg-[#2d6a4f] text-white py-3.5 font-sans text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#235a3f] disabled:bg-black/10 disabled:text-black/35 disabled:cursor-not-allowed transition-colors"
      >
        <Ticket size={15} /> Book {guests > 0 ? `${guests} seat${guests === 1 ? '' : 's'}` : 'seats'}{!problem ? ` · ${formatMoney(total)}` : ''}
      </button>
      <button
        type="button"
        onClick={addToTrip}
        disabled={!!problem}
        className="mt-2 w-full border border-black/20 py-3 font-sans text-sm flex items-center justify-center gap-2 hover:border-black/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {justAdded ? <><Check size={14} /> Added to your trip</> : <><ShoppingBag size={14} /> Add to trip and keep browsing</>}
      </button>
      <p className="mt-3 font-sans text-[11px] text-black/45 text-center">
        Seats are held while you pay. Each seat gets its own QR ticket to show at boarding.
      </p>
    </div>
  )
}

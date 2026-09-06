'use client'

import { ArrowRight, ArrowLeftRight, Calendar, Clock, MapPin, Search, Users } from 'lucide-react'
import { GoogleAddressField, type GooglePlaceSelection } from '@/components/maps/GoogleAddressField'

// One compounded search bar for the whole transfer, in place of the stacked
// step-by-step form: route, when, how many, and — for a return — the leg
// home, all answered before the visitor ever scrolls. Submitting quotes the
// trip; everything after that happens in the results directly below.

export type TripType = 'one-way' | 'return'

export type ShuttleSearchValue = {
  tripType: TripType
  pickup: GooglePlaceSelection
  destination: GooglePlaceSelection
  date: string
  time: string
  returnDate: string
  returnTime: string
  passengers: number
}

const field = 'w-full border border-gray-200 bg-white px-3 py-2.5 font-sans text-sm text-forest focus:outline-none focus:border-forest transition-colors'
const legend = 'flex font-sans text-[10px] tracking-[0.14em] uppercase text-forest/40 mb-1.5 flex items-center gap-1.5'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function ShuttleSearchForm({
  value,
  onChange,
  onSubmit,
  submitLabel = 'Search transfers',
}: {
  value: ShuttleSearchValue
  onChange: (patch: Partial<ShuttleSearchValue>) => void
  onSubmit: () => void
  submitLabel?: string
}) {
  const isReturn = value.tripType === 'return'
  // Enough to quote: a route and an outbound date. A return leg additionally
  // needs its own date, so the visitor cannot search half a journey.
  const canSearch = Boolean(
    value.pickup.address && value.destination.address && value.date && (!isReturn || value.returnDate),
  )

  function swapEnds() {
    onChange({ pickup: value.destination, destination: value.pickup })
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (canSearch) onSubmit() }}
      className="bg-white border border-black/8 shadow-xl shadow-black/5"
    >
      {/* Trip type — the one choice that changes the shape of the form */}
      <div className="flex border-b border-gray-100">
        {(['one-way', 'return'] as TripType[]).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => onChange({ tripType: type })}
            aria-pressed={value.tripType === type}
            className={`font-sans text-xs tracking-[0.1em] uppercase px-5 py-3 border-b-2 transition-colors ${
              value.tripType === type
                ? 'border-gold text-forest'
                : 'border-transparent text-forest/35 hover:text-forest/60'
            }`}
          >
            {type === 'one-way' ? 'One way' : 'Return'}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-3">
          <div className="relative">
            <p className={legend} aria-hidden="true"><MapPin size={11} className="text-gold" /> Pickup</p>
            <GoogleAddressField
              label="Pickup location"
              value={value.pickup.address}
              lat={value.pickup.lat}
              lng={value.pickup.lng}
              placeholder="Airport, hotel, town or trailhead"
              inputClassName={field}
              labelClassName="sr-only"
              onChange={pickup => onChange({ pickup })}
            />
          </div>

          <div>
            <p className={legend} aria-hidden="true"><MapPin size={11} className="text-gold" /> Destination</p>
            <GoogleAddressField
              label="Destination"
              value={value.destination.address}
              lat={value.destination.lat}
              lng={value.destination.lng}
              placeholder="Lodge, trailhead or attraction"
              inputClassName={field}
              labelClassName="sr-only"
              onChange={destination => onChange({ destination })}
            />
          </div>

          <div className="flex lg:items-end lg:pb-[1px]">
            <button
              type="button"
              onClick={swapEnds}
              title="Swap pickup and destination"
              aria-label="Swap pickup and destination"
              className="flex items-center justify-center gap-2 border border-gray-200 text-forest/50 hover:text-forest hover:border-forest px-3 py-2.5 transition-colors w-full lg:w-11"
            >
              <ArrowLeftRight size={15} />
              <span className="font-sans text-xs lg:hidden">Swap pickup and destination</span>
            </button>
          </div>
        </div>

        {/* Native date and time inputs carry a fixed-width internal editor
            (mm/dd/yyyy plus its picker icon) that will not shrink, so on a
            phone they get a full row each rather than being squeezed two-up
            and spilling past their border. */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${isReturn ? 'lg:grid-cols-5' : 'lg:grid-cols-3'}`}>
          {/* Each input is nested in its own label, so the legend above it is
              the field's real accessible name rather than loose text. */}
          <label className="block min-w-0">
            <span className={legend}><Calendar size={11} className="text-gold" /> {isReturn ? 'Outbound' : 'Date'}</span>
            <input
              type="date"
              min={todayIso()}
              value={value.date}
              onChange={e => onChange({ date: e.target.value })}
              className={field}
            />
          </label>
          <label className="block min-w-0">
            <span className={legend}><Clock size={11} className="text-gold" /> Pickup time</span>
            <input
              type="time"
              value={value.time}
              onChange={e => onChange({ time: e.target.value })}
              className={field}
            />
          </label>

          {isReturn && (
            <>
              <label className="block min-w-0">
                <span className={legend}><Calendar size={11} className="text-gold" /> Return</span>
                <input
                  type="date"
                  min={value.date || todayIso()}
                  value={value.returnDate}
                  onChange={e => onChange({ returnDate: e.target.value })}
                  className={field}
                />
              </label>
              <label className="block min-w-0">
                <span className={legend}><Clock size={11} className="text-gold" /> Return time</span>
                <input
                  type="time"
                  value={value.returnTime}
                  onChange={e => onChange({ returnTime: e.target.value })}
                  className={field}
                />
              </label>
            </>
          )}

          <label className="block min-w-0 sm:col-span-2 lg:col-span-1">
            <span className={legend}><Users size={11} className="text-gold" /> Passengers</span>
            <input
              type="number"
              min={1}
              max={20}
              value={value.passengers}
              onChange={e => onChange({ passengers: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) })}
              className={field}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!canSearch}
          className="w-full bg-gold text-forest font-sans text-sm tracking-wide py-3.5 flex items-center justify-center gap-2 hover:bg-forest hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gold disabled:hover:text-forest"
        >
          <Search size={15} /> {submitLabel} <ArrowRight size={15} />
        </button>

        <p className="font-sans text-xs text-forest/35 text-center">
          Private vehicle, door to door. You pick the operator and the vehicle — no payment until checkout.
        </p>
      </div>
    </form>
  )
}

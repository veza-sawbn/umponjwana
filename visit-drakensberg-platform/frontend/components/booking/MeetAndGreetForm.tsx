'use client'

import { Plane } from 'lucide-react'
import type { MeetAndGreetDetails } from '@/lib/transport'

// Arrival details the transport partner needs to track the passengers and be
// waiting at the pickup point — flight for airport collections, name for the
// greeting board, a phone number to coordinate on the day.

const input = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-xs font-medium text-black/60">{label}</label>
      {children}
    </div>
  )
}

export function MeetAndGreetForm({
  value,
  onChange,
  showAirportFields = true,
}: {
  value: MeetAndGreetDetails
  onChange: (details: MeetAndGreetDetails) => void
  showAirportFields?: boolean
}) {
  const set = (key: keyof MeetAndGreetDetails, v: string) => onChange({ ...value, [key]: v })

  return (
    <div className="space-y-4">
      <p className="font-sans text-xs text-black/40 flex items-start gap-1.5">
        <Plane size={13} className="shrink-0 mt-0.5 text-[#C9A96E]" />
        These details go to your transport partner so they can track your arrival and meet you with a name board at the pickup point.
      </p>

      {showAirportFields && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Flight number">
            <input className={input} value={value.flightNumber ?? ''} onChange={e => set('flightNumber', e.target.value)} placeholder="e.g. SA 573" />
          </Field>
          <Field label="Airline">
            <input className={input} value={value.airline ?? ''} onChange={e => set('airline', e.target.value)} placeholder="e.g. South African Airways" />
          </Field>
          <Field label="Arrival / pickup time">
            <input type="time" className={input} value={value.arrivalTime ?? ''} onChange={e => set('arrivalTime', e.target.value)} />
          </Field>
        </div>
      )}
      {!showAirportFields && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Pickup time">
            <input type="time" className={input} value={value.arrivalTime ?? ''} onChange={e => set('arrivalTime', e.target.value)} />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name for the greeting board">
          <input className={input} value={value.nameBoard ?? ''} onChange={e => set('nameBoard', e.target.value)} placeholder="Name your driver should display" />
        </Field>
        <Field label="Contact phone (on the day)">
          <input className={input} value={value.contactPhone ?? ''} onChange={e => set('contactPhone', e.target.value)} placeholder="+27 …" />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Luggage">
          <input className={input} value={value.luggage ?? ''} onChange={e => set('luggage', e.target.value)} placeholder="e.g. 2 large bags, 2 backpacks" />
        </Field>
        <Field label="Child seats needed">
          <input className={input} value={value.childSeats ?? ''} onChange={e => set('childSeats', e.target.value)} placeholder="e.g. 1 booster seat (age 5)" />
        </Field>
      </div>

      <Field label="Notes for your driver">
        <textarea rows={2} className={`${input} resize-none`} value={value.notes ?? ''} onChange={e => set('notes', e.target.value)} placeholder="Anything else that helps the meet & greet go smoothly" />
      </Field>
    </div>
  )
}

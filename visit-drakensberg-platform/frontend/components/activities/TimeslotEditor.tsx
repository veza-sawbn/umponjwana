'use client'

import { Plus, Trash2 } from 'lucide-react'
import { newActivityTimeslotId, type ActivityTimeslot } from '@/lib/activities'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function emptyTimeslot(): ActivityTimeslot {
  return { id: newActivityTimeslotId(), time: '09:00', capacity: 8, days: [0, 1, 2, 3, 4, 5, 6] }
}

/**
 * Repeatable list of recurring departure times for an activity — each with
 * its own capacity and which days of the week it runs. Shared by the
 * supplier new/edit activity forms so both stay in sync with the
 * ActivityTimeslot shape in lib/activities.ts.
 */
export function TimeslotEditor({ timeslots, onChange }: { timeslots: ActivityTimeslot[]; onChange: (v: ActivityTimeslot[]) => void }) {
  function update(id: string, patch: Partial<ActivityTimeslot>) {
    onChange(timeslots.map(t => t.id === id ? { ...t, ...patch } : t))
  }
  function remove(id: string) {
    onChange(timeslots.filter(t => t.id !== id))
  }
  function toggleDay(t: ActivityTimeslot, day: number) {
    const days = t.days.includes(day) ? t.days.filter(d => d !== day) : [...t.days, day].sort()
    update(t.id, { days })
  }

  return (
    <div className="space-y-3">
      {timeslots.length === 0 && (
        <p className="font-sans text-[11px] text-black/35">
          No fixed timeslots yet — visitors will just pick a date. Add one if this activity departs at set times each day.
        </p>
      )}
      {timeslots.map(t => (
        <div key={t.id} className="border border-black/10 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <input type="time" value={t.time} onChange={e => update(t.id, { time: e.target.value })} className={inp} />
            <input type="number" min="1" value={t.capacity} onChange={e => update(t.id, { capacity: +e.target.value || 1 })} placeholder="Capacity" className={`${inp} w-24`} />
            <span className="font-sans text-xs text-black/40 shrink-0">seats</span>
            <button type="button" onClick={() => remove(t.id)} className="ml-auto text-black/30 hover:text-red-500 shrink-0" aria-label="Remove timeslot">
              <Trash2 size={15} />
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {DAY_LABELS.map((label, day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(t, day)}
                className={`font-sans text-[11px] w-9 py-1 rounded-full border transition-colors ${t.days.includes(day) ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/40 hover:border-[#C9A96E]/40'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...timeslots, emptyTimeslot()])}
        className="flex items-center gap-1.5 font-sans text-xs text-[#C9A96E] hover:underline"
      >
        <Plus size={13} /> Add Timeslot
      </button>
    </div>
  )
}

const inp = 'font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

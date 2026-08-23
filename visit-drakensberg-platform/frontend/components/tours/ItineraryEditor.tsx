'use client'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { newItineraryDayId, type ItineraryDay } from '@/lib/tours'
import { inp } from './PackageEditor'

// Supplier-facing editor for a tour's day-by-day itinerary (lib/tours.ts
// Tour.itinerary). Order in the array IS the day number (index 0 = Day 1) —
// this is also what DeparturePackage.dayCount (lib/departures.ts) counts
// against, so reordering here changes which days a shorter rate package
// includes. Used on both the new-tour and edit-tour supplier pages.

export function emptyItineraryDay(): ItineraryDay {
  return { id: newItineraryDayId(), title: '', description: '' }
}

export default function ItineraryEditor({
  days, onChange,
}: {
  days: ItineraryDay[]
  onChange: (next: ItineraryDay[]) => void
}) {
  function update(id: string, patch: Partial<ItineraryDay>) {
    onChange(days.map(d => (d.id === id ? { ...d, ...patch } : d)))
  }
  function remove(id: string) {
    onChange(days.filter(d => d.id !== id))
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= days.length) return
    const next = [...days]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-4">
      {days.length === 0 && (
        <p className="font-sans text-xs text-black/40">
          No day-by-day plan yet — guests will just see the trip&apos;s overall length and description.
          Add a day below to give each rate package (e.g. a shorter vs. longer trip) its own itinerary.
        </p>
      )}
      {days.map((day, i) => (
        <div key={day.id} className="border border-black/10 rounded-lg p-4 space-y-3 bg-black/[0.015]">
          <div className="flex items-center gap-3">
            <span className="font-display italic text-lg text-[#C9A96E] shrink-0">Day {i + 1}</span>
            <input
              value={day.title}
              onChange={e => update(day.id, { title: e.target.value })}
              placeholder="Day title (e.g. Sentinel Car Park to Tugela Falls)"
              className={`${inp} font-medium`}
            />
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-black/30 hover:text-black/60 disabled:opacity-20">
                <ChevronUp size={14} />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === days.length - 1} className="text-black/30 hover:text-black/60 disabled:opacity-20">
                <ChevronDown size={14} />
              </button>
              <button type="button" onClick={() => remove(day.id)} className="text-red-400 hover:text-red-600 ml-1">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div>
            <label className="font-sans text-xs text-black/40 block mb-1">What happens this day</label>
            <textarea
              value={day.description}
              onChange={e => update(day.id, { description: e.target.value })}
              placeholder="e.g. Ascend via the chain ladders to the escarpment, then hike to the falls…"
              rows={2}
              className={`${inp} resize-none`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-sans text-xs text-black/40 block mb-1">Overnight / accommodation</label>
              <input
                value={day.accommodation ?? ''}
                onChange={e => update(day.id, { accommodation: e.target.value })}
                placeholder="e.g. Sentinel Cave, or Karma Lodge"
                className={inp}
              />
            </div>
            <div>
              <label className="font-sans text-xs text-black/40 block mb-1">Transport</label>
              <input
                value={day.transport ?? ''}
                onChange={e => update(day.id, { transport: e.target.value })}
                placeholder="e.g. Shuttle pickup 06:00, Johannesburg"
                className={inp}
              />
            </div>
            <div>
              <label className="font-sans text-xs text-black/40 block mb-1">Meals</label>
              <input
                value={day.meals ?? ''}
                onChange={e => update(day.id, { meals: e.target.value })}
                placeholder="e.g. Breakfast, packed lunch, dinner"
                className={inp}
              />
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...days, emptyItineraryDay()])} className="flex items-center gap-1.5 font-sans text-xs text-[#C9A96E] hover:text-[#b8965d]">
        <Plus size={13} /> Add {days.length === 0 ? 'a' : 'another'} day
      </button>
    </div>
  )
}

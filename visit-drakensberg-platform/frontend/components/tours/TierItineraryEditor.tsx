'use client'
import { Plus, Trash2 } from 'lucide-react'
import type { TrailDay } from '@/lib/trails'
import { newExtraItineraryDayId, type ExtraItineraryDay } from '@/lib/tours'
import { inp, type PackageForm } from './PackageEditor'

// Per-pricing-tier itinerary customization, rendered inline in a
// PackagesEditor row via its `renderExtra` slot (tour tier editor only —
// see app/supplier/tours/new + [id]/edit). Every tier starts from the
// linked trail's admin-authored day-by-day plan (Trail.days, edited at
// /admin/trails) as its default; this editor lets the supplier narrow it to
// fewer leading days, edit the accommodation/transport/meals/notes of
// specific default days, and add the tier's own extra days before and/or
// after the trail's plan — e.g. a "Shuttle + Extra Night" tier that adds one
// day before the hike's own start date without moving that start date.

function emptyExtraDay(): ExtraItineraryDay {
  return { id: newExtraItineraryDayId(), label: '' }
}

function ExtraDaysEditor({
  label, hint, days, onChange,
}: {
  label: string
  hint: string
  days: ExtraItineraryDay[]
  onChange: (next: ExtraItineraryDay[]) => void
}) {
  function update(id: string, patch: Partial<ExtraItineraryDay>) {
    onChange(days.map(d => (d.id === id ? { ...d, ...patch } : d)))
  }
  function remove(id: string) {
    onChange(days.filter(d => d.id !== id))
  }
  return (
    <div className="space-y-2.5">
      <div>
        <p className="font-sans text-xs font-medium text-black/60">{label}</p>
        <p className="font-sans text-[11px] text-black/35">{hint}</p>
      </div>
      {days.map(day => (
        <div key={day.id} className="border border-black/10 rounded-lg p-3 space-y-2 bg-white">
          <div className="flex items-center gap-2">
            <input value={day.label} onChange={e => update(day.id, { label: e.target.value })} placeholder="Day label (e.g. Shuttle pickup from Johannesburg)" className={`${inp} text-xs`} />
            <button type="button" onClick={() => remove(day.id)} className="text-red-400 hover:text-red-600 shrink-0"><Trash2 size={13} /></button>
          </div>
          <textarea value={day.description ?? ''} onChange={e => update(day.id, { description: e.target.value })} placeholder="What happens this day…" rows={2} className={`${inp} text-xs resize-none`} />
          <div className="grid grid-cols-3 gap-2">
            <input value={day.accommodation ?? ''} onChange={e => update(day.id, { accommodation: e.target.value })} placeholder="Overnight / accommodation" className={`${inp} text-xs`} />
            <input value={day.transport ?? ''} onChange={e => update(day.id, { transport: e.target.value })} placeholder="Transport" className={`${inp} text-xs`} />
            <input value={day.meals ?? ''} onChange={e => update(day.id, { meals: e.target.value })} placeholder="Meals" className={`${inp} text-xs`} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...days, emptyExtraDay()])} className="flex items-center gap-1.5 font-sans text-[11px] text-[#C9A96E] hover:text-[#b8965d]">
        <Plus size={12} /> Add a day
      </button>
    </div>
  )
}

export default function TierItineraryEditor({
  trailDays, pkg, update,
}: {
  trailDays: TrailDay[]
  pkg: PackageForm
  update: (patch: Partial<PackageForm>) => void
}) {
  if (trailDays.length === 0) return null

  const dayCount = pkg.itineraryDayCount ? Math.min(+pkg.itineraryDayCount, trailDays.length) : trailDays.length
  const overrides = pkg.itineraryOverrides ?? []
  const before = pkg.itineraryDaysBefore ?? []
  const after = pkg.itineraryDaysAfter ?? []

  function overrideFor(dayIndex: number): { notes?: string; accommodation?: string; transport?: string; meals?: string } {
    return overrides.find(o => o.dayIndex === dayIndex) ?? {}
  }
  function updateOverride(dayIndex: number, patch: Partial<{ notes: string; accommodation: string; transport: string; meals: string }>) {
    const existing = overrides.find(o => o.dayIndex === dayIndex)
    const next = { ...(existing ?? { dayIndex }), ...patch }
    update({ itineraryOverrides: existing ? overrides.map(o => (o.dayIndex === dayIndex ? next : o)) : [...overrides, next] })
  }

  return (
    <div className="border-t border-black/8 pt-3 mt-1 space-y-4">
      <div>
        <p className="font-sans text-xs font-medium text-black/60">Itinerary for this rate</p>
        <p className="font-sans text-[11px] text-black/35">
          Starts from the trail&apos;s {trailDays.length}-day plan (edited at Admin → Trails). Narrow it down, tweak specific days, or add extra days below.
        </p>
      </div>

      <div className="w-52">
        <label className="font-sans text-xs text-black/40 block mb-1">Trip length for this rate</label>
        <select value={pkg.itineraryDayCount || ''} onChange={e => update({ itineraryDayCount: e.target.value })} className={`${inp} text-xs`}>
          <option value="">All {trailDays.length} trail days</option>
          {Array.from({ length: trailDays.length }, (_, i) => i + 1).map(n => (
            <option key={n} value={n}>{n} day{n !== 1 ? 's' : ''}</option>
          ))}
        </select>
      </div>

      <ExtraDaysEditor
        label="Extra days before the hiking date"
        hint="Inserted ahead of the trail's Day 1 without moving the hike's own start date — e.g. a shuttle pickup the day before."
        days={before}
        onChange={next => update({ itineraryDaysBefore: next })}
      />

      <div className="space-y-2">
        <p className="font-sans text-xs font-medium text-black/60">Edit specific trail days for this rate</p>
        {trailDays.slice(0, dayCount).map((day, i) => {
          const o = overrideFor(i)
          return (
            <div key={i} className="border border-black/10 rounded-lg p-3 space-y-2 bg-white">
              <p className="font-sans text-xs font-medium text-black/70">Day {i + 1} — {day.label || 'Untitled'}</p>
              <textarea
                value={o.notes ?? ''}
                onChange={e => updateOverride(i, { notes: e.target.value })}
                placeholder={day.notes ? `Default: ${day.notes}` : 'Notes override for this rate (optional)…'}
                rows={2}
                className={`${inp} text-xs resize-none`}
              />
              <div className="grid grid-cols-3 gap-2">
                <input value={o.accommodation ?? ''} onChange={e => updateOverride(i, { accommodation: e.target.value })} placeholder="Overnight / accommodation" className={`${inp} text-xs`} />
                <input value={o.transport ?? ''} onChange={e => updateOverride(i, { transport: e.target.value })} placeholder="Transport" className={`${inp} text-xs`} />
                <input value={o.meals ?? ''} onChange={e => updateOverride(i, { meals: e.target.value })} placeholder="Meals" className={`${inp} text-xs`} />
              </div>
            </div>
          )
        })}
      </div>

      <ExtraDaysEditor
        label="Extra days after the trail's plan"
        hint="Appended after the last included trail day — e.g. an extra night and a shuttle back to the city."
        days={after}
        onChange={next => update({ itineraryDaysAfter: next })}
      />
    </div>
  )
}

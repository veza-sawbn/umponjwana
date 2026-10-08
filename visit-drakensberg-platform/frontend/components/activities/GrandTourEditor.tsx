'use client'
import { Plus, Trash2, Mountain } from 'lucide-react'
import { newEntityId } from '@/lib/entities'
import type { GrandTourListing, PickupPoint } from '@/lib/grand-tour'
import { useGrandTourStages } from '@/lib/use-grand-tour-stages'

/**
 * "List this as a Grand Tour Drakensberg day tour" — VD Operations' editor
 * (/operations/grand-tour). Suppliers do not see it; the database ignores a
 * Grand Tour listing written by anyone else
 * (supabase/migrations/20261008_grand_tour_ops_only.sql).
 *
 * Stores Activity.grandTour: the highlights the tour visits (which places it
 * on the /grand-tour itinerary) and the hotels it collects guests from. The
 * activity's timeslots are its departures, so the editor says plainly that
 * it needs at least one before the tour can be booked.
 */
export function emptyGrandTour(): GrandTourListing {
  return { enabled: false, highlightIds: [], departsFrom: '', pickupPoints: [] }
}

export function GrandTourEditor({
  value, onChange, hasTimeslots,
}: {
  value: GrandTourListing
  onChange: (v: GrandTourListing) => void
  hasTimeslots: boolean
}) {
  const stages = useGrandTourStages()
  const set = <K extends keyof GrandTourListing>(k: K, v: GrandTourListing[K]) => onChange({ ...value, [k]: v })
  const inp = 'w-full border border-black/12 rounded-lg px-3 py-2 font-sans text-sm text-black/80 focus:outline-none focus:border-[#C9A96E]'

  function toggleHighlight(id: string) {
    const has = value.highlightIds.includes(id)
    set('highlightIds', has ? value.highlightIds.filter(h => h !== id) : [...value.highlightIds, id])
  }
  function updatePickup(id: string, patch: Partial<PickupPoint>) {
    set('pickupPoints', value.pickupPoints.map(p => (p.id === id ? { ...p, ...patch } : p)))
  }
  function addPickup() {
    set('pickupPoints', [...value.pickupPoints, { id: newEntityId('pk'), name: '', area: value.departsFrom || '', minutesBefore: 30 }])
  }

  return (
    <div className="rounded-lg border border-black/8 bg-black/[0.02] p-4 space-y-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="grandTourEnabled"
          checked={value.enabled}
          onChange={e => set('enabled', e.target.checked)}
          className="mt-0.5 rounded"
        />
        <label htmlFor="grandTourEnabled" className="cursor-pointer">
          <span className="font-sans text-sm font-medium text-black/70 flex items-center gap-1.5">
            <Mountain size={14} className="text-[#C9A96E]" /> List on the Grand Tour Drakensberg
          </span>
          <span className="block font-sans text-[11px] text-black/40 mt-0.5">
            A scheduled day tour guests book seats on, with optional hotel pickups. Each seat becomes a ticket VD
            Operations scans at boarding.
          </span>
        </label>
      </div>

      {value.enabled && (
        <div className="pl-7 space-y-5">
          {!hasTimeslots && (
            <p className="font-sans text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This activity has no timeslots yet, and timeslots are its departures. Until the supplier adds one, it can’t be booked.
            </p>
          )}

          <div>
            <p className="font-sans text-xs font-medium text-black/60 mb-1">Highlights this tour visits</p>
            <p className="font-sans text-[11px] text-black/40 mb-2">Places the tour on the Grand Tour itinerary under these stops.</p>
            <div className="space-y-3">
              {stages.map(stage => (
                <fieldset key={stage.id}>
                  <legend className="font-sans text-[11px] uppercase tracking-wider text-black/40 mb-1.5">{stage.number}. {stage.name}</legend>
                  <div className="flex flex-wrap gap-2">
                    {stage.highlights.map(h => {
                      const on = value.highlightIds.includes(h.id)
                      return (
                        <button
                          type="button"
                          key={h.id}
                          onClick={() => toggleHighlight(h.id)}
                          aria-pressed={on}
                          className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${on ? 'bg-[#2d6a4f] border-[#2d6a4f] text-white' : 'border-black/15 text-black/60 hover:border-black/30'}`}
                        >
                          {h.name}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-sans text-xs font-medium text-black/60 mb-1" htmlFor="gtDepartsFrom">Departs from</label>
            <input
              id="gtDepartsFrom"
              value={value.departsFrom ?? ''}
              onChange={e => set('departsFrom', e.target.value)}
              placeholder="e.g. Champagne Valley"
              className={inp}
            />
            <p className="font-sans text-[11px] text-black/40 mt-1">Where guests start, if that’s not where the tour goes, e.g. a Sani Pass tour departing Champagne Valley.</p>
          </div>

          <div>
            <p className="font-sans text-xs font-medium text-black/60 mb-1">Hotel pickups</p>
            <p className="font-sans text-[11px] text-black/40 mb-2">
              Guests choose one when they book. The pickup time printed on their ticket is the departure time minus the minutes you set here.
            </p>
            <div className="space-y-2">
              {value.pickupPoints.map(p => (
                <div key={p.id} className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1.4fr_1fr_auto_auto] gap-2 items-center">
                  <input value={p.name} onChange={e => updatePickup(p.id, { name: e.target.value })} placeholder="Hotel, e.g. Champagne Sports Resort" aria-label="Pickup name" className={inp} />
                  <input value={p.area ?? ''} onChange={e => updatePickup(p.id, { area: e.target.value })} placeholder="Area" aria-label="Pickup area" className={`${inp} hidden sm:block`} />
                  <label className="flex items-center gap-1.5 font-sans text-[11px] text-black/50 whitespace-nowrap">
                    <input
                      type="number" min={0} max={300} step={5}
                      value={p.minutesBefore}
                      onChange={e => updatePickup(p.id, { minutesBefore: Math.max(0, parseInt(e.target.value) || 0) })}
                      aria-label="Minutes before departure"
                      className="w-16 border border-black/12 rounded-lg px-2 py-2 font-sans text-sm"
                    />
                    min before
                  </label>
                  <button type="button" onClick={() => set('pickupPoints', value.pickupPoints.filter(x => x.id !== p.id))} aria-label="Remove pickup" className="p-2 text-black/30 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addPickup} className="mt-2 flex items-center gap-1.5 font-sans text-xs text-[#C9A96E] hover:underline">
              <Plus size={13} /> Add a pickup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Drops empty pickup rows before saving; returns undefined when the listing was never switched on. */
export function cleanGrandTour(v: GrandTourListing): GrandTourListing | undefined {
  if (!v.enabled && v.highlightIds.length === 0 && v.pickupPoints.length === 0) return undefined
  return {
    ...v,
    departsFrom: v.departsFrom?.trim() || undefined,
    pickupPoints: v.pickupPoints
      .filter(p => p.name.trim())
      .map(p => ({ ...p, name: p.name.trim(), area: p.area?.trim() || undefined })),
  }
}

'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Pencil, Plus, Trash2, ArrowUp, ArrowDown, RotateCcw, Save, AlertTriangle, Navigation, Clock, UserCircle,
} from 'lucide-react'
import type { SupplierOrder, OrderItem } from '@/lib/booking-orders'
import type { Tour } from '@/lib/tours'
import type { Departure } from '@/lib/departures'
import type { Trail } from '@/lib/trails'
import { getTripRequestById, type TripRequest } from '@/lib/custom-trips'
import {
  resolveDefaultItinerary, effectiveItineraryDays, getBookingItineraries, getSupplierBookingItem,
  saveBookingItinerary, resetBookingItinerary, tripRequestIdForItem,
  type BookingItinerary, type ItineraryDay, type ResolvedItinerary,
} from '@/lib/booking-itinerary'

export type ItineraryCatalog = { departures: Departure[]; tours: Tour[]; trails: Trail[] }

function fmt(d?: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function addDays(iso: string, n: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const input = 'w-full font-sans text-sm border border-black/10 px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
const label = 'font-sans text-[10px] uppercase tracking-wider text-black/40 mb-1 block'

type Draft = {
  days: ItineraryDay[]
  meetingPoint: string
  meetingTime: string
  guide: string
  notes: string
}

/**
 * The itinerary this guest sees for one booked tour, exactly as
 * /account/itinerary shows it — and the operator's editor for it. Saving
 * writes vd_booking_itineraries (never the guest's booking) and the guest's
 * itinerary shows the operator's version from then on.
 */
export default function BookingItineraryEditor({
  order, item, catalog, supplierName,
}: {
  order: SupplierOrder
  item: OrderItem
  catalog: ItineraryCatalog
  supplierName: string
}) {
  const [loading, setLoading] = useState(true)
  const [resolved, setResolved] = useState<ResolvedItinerary | null>(null)
  const [override, setOverride] = useState<BookingItinerary | null>(null)
  const [tripRequest, setTripRequest] = useState<TripRequest | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const requestId = tripRequestIdForItem(item.id)
    Promise.all([
      getSupplierBookingItem(order.bookingId, item.id),
      getBookingItineraries(order.bookingId),
      requestId ? getTripRequestById(requestId) : Promise.resolve(null),
    ]).then(([booked, overrides, request]) => {
      if (cancelled) return
      // The order item has no package; the guest's booking does. Fall back
      // to the order's own fields if that lookup isn't available.
      const full = {
        id: item.id,
        title: item.title,
        date: booked?.date ?? item.date,
        packageId: booked?.packageId ?? undefined,
      }
      setResolved(resolveDefaultItinerary(full, { ...catalog, tripRequest: request }))
      setOverride(overrides.find(o => o.itemId === item.id) ?? null)
      setTripRequest(request)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [order.bookingId, item.id, item.title, item.date, catalog])

  if (loading || !resolved) {
    return <p className="font-sans text-xs text-black/30">Loading the guest&apos;s itinerary…</p>
  }

  const days = effectiveItineraryDays(resolved, override)
  const meetingPoint = override?.meetingPoint || resolved.tour?.meetingPoint || ''
  const guide = override?.guide || resolved.departure?.guide || tripRequest?.preferredGuideName || ''
  const editable = order.status !== 'cancelled' && order.status !== 'declined' && order.status !== 'expired'

  // Quote proposed different dates from the ones the booking was made on.
  const altStart = tripRequest?.quote?.alternativeStartDate
  const datesDiffer = !!altStart && !!item.date && altStart !== item.date

  function startEditing() {
    setDraft({
      days: days.length > 0 ? days.map(d => ({ ...d })) : [{ date: item.date ?? '', label: '' }],
      meetingPoint,
      meetingTime: override?.meetingTime ?? '',
      guide,
      notes: override?.notes ?? '',
    })
  }

  function updateDay(i: number, patch: Partial<ItineraryDay>) {
    setDraft(d => d && { ...d, days: d.days.map((day, j) => j === i ? { ...day, ...patch } : day) })
  }
  function moveDay(i: number, dir: -1 | 1) {
    setDraft(d => {
      if (!d) return d
      const j = i + dir
      if (j < 0 || j >= d.days.length) return d
      const next = [...d.days]
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...d, days: next }
    })
  }
  function addDay() {
    setDraft(d => {
      if (!d) return d
      const last = d.days[d.days.length - 1]
      return { ...d, days: [...d.days, { date: last?.date ? addDays(last.date, 1) : '', label: '' }] }
    })
  }
  // Shift every day by the same amount, keeping their spacing.
  function shiftStart(newStart: string) {
    setDraft(d => {
      if (!d || !newStart) return d
      const oldStart = d.days[0]?.date
      if (!oldStart) return { ...d, days: d.days.map((day, i) => ({ ...day, date: addDays(newStart, i) })) }
      const delta = Math.round((new Date(newStart).getTime() - new Date(oldStart).getTime()) / 86400000)
      return { ...d, days: d.days.map(day => ({ ...day, date: day.date ? addDays(day.date, delta) : day.date })) }
    })
  }

  async function save() {
    if (!draft) return
    if (draft.days.some(d => !d.label.trim() && !d.description?.trim())) {
      toast.error('Give every day a title, or remove the empty day.')
      return
    }
    setSaving(true)
    try {
      const saved = await saveBookingItinerary({
        bookingId: order.bookingId,
        itemId: item.id,
        supplierId: order.supplierId,
        days: draft.days,
        meetingPoint: draft.meetingPoint.trim() || undefined,
        meetingTime: draft.meetingTime.trim() || undefined,
        guide: draft.guide.trim() || undefined,
        notes: draft.notes.trim() || undefined,
        updatedByName: supplierName || undefined,
      }, { userId: order.userId, reference: order.reference, serviceTitle: item.title })
      setOverride(saved)
      setDraft(null)
      toast.success(`Itinerary updated. ${order.customerName} has been notified.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the itinerary.')
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    if (!window.confirm('Discard your changes and show the guest the standard itinerary from your tour listing again?')) return
    setSaving(true)
    try {
      await resetBookingItinerary(order.bookingId, item.id)
      setOverride(null)
      setDraft(null)
      toast.success('The guest now sees the standard itinerary.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reset the itinerary.')
    } finally {
      setSaving(false)
    }
  }

  /* ── Editing ─────────────────────────────────────────────── */
  if (draft) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Meeting point</label>
            <input className={input} value={draft.meetingPoint} onChange={e => setDraft({ ...draft, meetingPoint: e.target.value })} placeholder="e.g. Mahai campsite reception" />
          </div>
          <div>
            <label className={label}>Meeting time</label>
            <input className={input} value={draft.meetingTime} onChange={e => setDraft({ ...draft, meetingTime: e.target.value })} placeholder="e.g. 06:30 on day 1" />
          </div>
          <div>
            <label className={label}>Guide</label>
            <input className={input} value={draft.guide} onChange={e => setDraft({ ...draft, guide: e.target.value })} placeholder="Guide's name" />
          </div>
          <div>
            <label className={label}>Trip starts</label>
            <input type="date" className={input} value={draft.days[0]?.date ?? ''} onChange={e => shiftStart(e.target.value)} />
            <p className="font-sans text-[11px] text-black/35 mt-1">Moves every day, keeping the spacing.</p>
          </div>
        </div>
        <div>
          <label className={label}>Note to the guest (shown above the plan)</label>
          <textarea rows={2} className={`${input} resize-none`} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. We've moved the summit day to avoid forecast storms." />
        </div>

        <div className="space-y-3">
          {draft.days.map((day, i) => (
            <div key={i} className="bg-white border border-black/8 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display italic text-base text-[#2d6a4f] w-14 shrink-0">Day {i + 1}</span>
                <input type="date" className={`${input} w-auto`} value={day.date} onChange={e => updateDay(i, { date: e.target.value })} aria-label={`Day ${i + 1} date`} />
                <input className={`${input} flex-1 min-w-[180px]`} value={day.label} onChange={e => updateDay(i, { label: e.target.value })} placeholder="Day title, e.g. Sentinel car park → Tugela Falls" aria-label={`Day ${i + 1} title`} />
                <div className="flex gap-1 ml-auto">
                  <button type="button" onClick={() => moveDay(i, -1)} disabled={i === 0} className="p-1.5 border border-black/10 text-black/40 hover:text-black/70 disabled:opacity-30" aria-label="Move day up"><ArrowUp size={12} /></button>
                  <button type="button" onClick={() => moveDay(i, 1)} disabled={i === draft.days.length - 1} className="p-1.5 border border-black/10 text-black/40 hover:text-black/70 disabled:opacity-30" aria-label="Move day down"><ArrowDown size={12} /></button>
                  <button type="button" onClick={() => setDraft({ ...draft, days: draft.days.filter((_, j) => j !== i) })} disabled={draft.days.length === 1} className="p-1.5 border border-red-200 text-red-400 hover:bg-red-50 disabled:opacity-30" aria-label="Remove day"><Trash2 size={12} /></button>
                </div>
              </div>
              <textarea rows={2} className={`${input} resize-none`} value={day.description ?? ''} onChange={e => updateDay(i, { description: e.target.value })} placeholder="What happens on this day" aria-label={`Day ${i + 1} description`} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input className={input} value={day.accommodation ?? ''} onChange={e => updateDay(i, { accommodation: e.target.value })} placeholder="Overnight" aria-label={`Day ${i + 1} overnight`} />
                <input className={input} value={day.transport ?? ''} onChange={e => updateDay(i, { transport: e.target.value })} placeholder="Transport" aria-label={`Day ${i + 1} transport`} />
                <input className={input} value={day.meals ?? ''} onChange={e => updateDay(i, { meals: e.target.value })} placeholder="Meals" aria-label={`Day ${i + 1} meals`} />
              </div>
            </div>
          ))}
          <button type="button" onClick={addDay} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] border border-[#2d6a4f]/30 px-3 py-1.5 hover:bg-[#2d6a4f]/5">
            <Plus size={12} /> Add a day
          </button>
        </div>

        <div className="flex gap-2 flex-wrap pt-1">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-[#2d6a4f] text-white font-sans text-sm px-4 py-2 hover:bg-[#235a3f] disabled:opacity-50">
            <Save size={13} /> {saving ? 'Saving…' : 'Save & notify guest'}
          </button>
          <button onClick={() => setDraft(null)} disabled={saving} className="font-sans text-sm px-4 py-2 border border-black/10 text-black/50 hover:border-black/20">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  /* ── What the guest sees ─────────────────────────────────── */
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-sans text-xs text-black/50">
          {override
            ? <>Customised for this guest{override.updatedAt ? ` · updated ${fmt(override.updatedAt)}` : ''}{override.updatedByName ? ` by ${override.updatedByName}` : ''}</>
            : <>Standard itinerary from {resolved.trail ? `the ${resolved.trail.name} trail plan` : 'your tour listing'}{resolved.packageName ? ` — ${resolved.packageName}` : ''}</>}
        </p>
        {editable && (
          <div className="flex gap-2">
            {override && (
              <button onClick={reset} disabled={saving} className="inline-flex items-center gap-1.5 font-sans text-xs text-black/50 border border-black/10 px-3 py-1.5 hover:border-black/20 disabled:opacity-50">
                <RotateCcw size={12} /> Reset to standard
              </button>
            )}
            <button onClick={startEditing} className="inline-flex items-center gap-1.5 font-sans text-xs text-white bg-[#2d6a4f] px-3 py-1.5 hover:bg-[#235a3f]">
              <Pencil size={12} /> Adjust itinerary
            </button>
          </div>
        )}
      </div>

      {datesDiffer && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 px-3 py-2">
          <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="font-sans text-xs text-amber-800">
            Your quote proposed {fmt(altStart)}{tripRequest?.quote?.alternativeEndDate ? ` → ${fmt(tripRequest.quote.alternativeEndDate)}` : ''}, but this booking was made for {fmt(item.date)}.
            Adjust the itinerary if the guest should see the proposed dates.
          </p>
        </div>
      )}

      {(meetingPoint || override?.meetingTime || guide) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-xs text-black/60">
          {meetingPoint && <span className="flex items-center gap-1"><Navigation size={11} className="text-[#2d6a4f]" />{meetingPoint}</span>}
          {override?.meetingTime && <span className="flex items-center gap-1"><Clock size={11} className="text-[#2d6a4f]" />{override.meetingTime}</span>}
          {guide && <span className="flex items-center gap-1"><UserCircle size={11} className="text-[#2d6a4f]" />{guide}</span>}
        </div>
      )}

      {override?.notes && (
        <p className="font-sans text-sm text-black/70 border-l-2 border-[#2d6a4f] pl-3 whitespace-pre-line">{override.notes}</p>
      )}

      {days.length === 0 ? (
        <p className="font-sans text-xs text-black/40">
          The guest sees no day-by-day plan for this booking — only the date and party size. Use &ldquo;Adjust itinerary&rdquo; to give them one.
        </p>
      ) : (
        <div className="space-y-1.5">
          {days.map((day, i) => (
            <div key={i} className="bg-white border border-black/6 px-3 py-2">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-display italic text-sm text-[#2d6a4f]">Day {i + 1}</span>
                {day.date && <span className="font-sans text-[11px] text-black/40">{fmt(day.date)}</span>}
                {day.label && <span className="font-sans text-sm text-black/80 font-medium">{day.label}</span>}
              </div>
              {day.description && <p className="font-sans text-xs text-black/60 mt-0.5 leading-relaxed">{day.description}</p>}
              {(day.accommodation || day.transport || day.meals) && (
                <p className="font-sans text-[11px] text-black/45 mt-1">
                  {[day.accommodation && `Overnight: ${day.accommodation}`, day.transport && `Transport: ${day.transport}`, day.meals && `Meals: ${day.meals}`].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

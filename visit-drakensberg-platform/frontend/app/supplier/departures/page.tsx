'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Plus, Users, Trash2, ChevronLeft, X, Settings2, UserPlus, Mail } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { getSupplierEntities, type SupplierEntity } from '@/lib/supplier-entities'
import { getMyTours, type Tour, type PricingTier } from '@/lib/tours'
import { getTrails, type Trail } from '@/lib/trails'
import { formatMoney } from '@/lib/allocation'
import {
  getMyDepartures, addDeparture, updateDeparture, deleteDeparture, newDeparturePackageId,
  type Departure,
} from '@/lib/departures'
import {
  PackagesEditor, InclusionChips, emptyPackage, packagesToForm, formToPackages, cheapest,
  resolveLivePackages, withTierOverrides, inp, type PackageForm,
} from '@/components/tours/PackageEditor'
import {
  getGuestsForDeparture, addManualGuest, removeManualGuest, type DepartureGuest,
} from '@/lib/departure-guests'

type Guide = SupplierEntity & { name: string }

const STATUS: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  open:      'bg-blue-100 text-blue-700',
  full:      'bg-slate-100 text-slate-600',
}

// Turns a tour's pricing tiers into one pre-selected package row each,
// carrying tierId so the price/add-ons stay linked to that tier (see
// resolveLivePackages/withTierOverrides). The supplier prunes whichever
// tiers don't apply to this particular date, or overrides a price.
function packagesFromTiers(tiers: PricingTier[]): PackageForm[] {
  return tiers.map(t => ({ id: newDeparturePackageId(), name: t.name, pricePerPerson: String(t.pricePerPerson || ''), inclusions: t.inclusions, tierId: t.id }))
}

function RatesFieldset({
  inclusions, onChangeInclusions, packages, onChangePackages, tour, trailDayCount,
}: {
  inclusions: string[]; onChangeInclusions: (next: string[]) => void
  packages: PackageForm[]; onChangePackages: (next: PackageForm[]) => void
  tour?: Tour
  // The linked trail's day count — freeform rates (no tierId) can truncate
  // to a plain trip length here. Tier-linked rates get their itinerary
  // (including trip length) from the tour's pricing tier instead, edited on
  // the tour itself, so PackagesEditor hides this field for those rows.
  trailDayCount: number
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="font-sans text-sm font-medium text-black/70">Baseline Inclusions <span className="font-normal text-black/30">(covered by every rate below)</span></label>
        <InclusionChips value={inclusions} onChange={onChangeInclusions} />
      </div>
      <div className="space-y-1.5">
        <label className="font-sans text-sm font-medium text-black/70">Rate Packages <span className="font-normal text-black/30">(different prices for the same departure)</span></label>
        {trailDayCount > 0 && (
          <p className="font-sans text-xs text-black/40">
            &quot;{tour!.name}&quot;&apos;s trail has a {trailDayCount}-day itinerary. A freeform rate below can set its own
            trip length; a rate linked to a pricing tier follows that tier&apos;s itinerary instead — edit it on the tour.
          </p>
        )}
        <PackagesEditor packages={packages} onChange={onChangePackages} itineraryDayCount={trailDayCount} />
      </div>
    </div>
  )
}

/* ─── Configure modal for an existing departure ─────────────────────────────── */

function ConfigureModal({ dep, tour, trailDayCount, onClose, onSaved }: { dep: Departure; tour: Tour | undefined; trailDayCount: number; onClose: () => void; onSaved: (patch: Partial<Departure>) => void }) {
  const [inclusions, setInclusions] = useState<string[]>(dep.inclusions ?? [])
  // Load with each tier-linked row showing its tour tier's *current*
  // name/price/add-ons, not the stale snapshot stored on the departure —
  // editing a tour tier should be visible here immediately.
  const [packages, setPackages] = useState<PackageForm[]>(() => packagesToForm(resolveLivePackages(dep.packages ?? [], tour)))
  const [saving, setSaving] = useState(false)

  const availableTiers = (tour?.pricingTiers ?? []).filter(t => !packages.some(p => p.tierId === t.id))

  function addTier(t: PricingTier) {
    setPackages(p => [...p, { id: newDeparturePackageId(), name: t.name, pricePerPerson: String(t.pricePerPerson || ''), inclusions: t.inclusions, tierId: t.id }])
  }

  async function save() {
    const parsed = formToPackages(packages)
    if (parsed.length === 0) return
    setSaving(true)
    const patch = { inclusions, packages: withTierOverrides(parsed, tour), pricePerPerson: cheapest(parsed) }
    try {
      await updateDeparture(dep.id, patch)
      onSaved(patch)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl border border-black/8 w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display italic text-xl text-black/90">Configure Rates & Inclusions</h2>
            <p className="font-sans text-xs text-black/40 mt-0.5">{dep.tour} · {dep.date}</p>
          </div>
          <button onClick={onClose} className="text-black/30 hover:text-black/60"><X size={18} /></button>
        </div>

        {availableTiers.length > 0 && (
          <div className="space-y-1.5">
            <label className="font-sans text-sm font-medium text-black/70">Add from this tour&apos;s pricing tiers</label>
            <div className="flex flex-wrap gap-1.5">
              {availableTiers.map(t => (
                <button key={t.id} type="button" onClick={() => addTier(t)} className="font-sans text-xs px-3 py-1.5 rounded-full border border-[#C9A96E]/40 text-[#C9A96E] hover:bg-[#C9A96E]/10 flex items-center gap-1">
                  <Plus size={12} /> {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <RatesFieldset inclusions={inclusions} onChangeInclusions={setInclusions} packages={packages} onChangePackages={setPackages} tour={tour} trailDayCount={trailDayCount} />

        <div className="flex gap-3 pt-2">
          <button onClick={save} disabled={saving} className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Rates & Inclusions'}
          </button>
          <button onClick={onClose} className="font-sans text-sm px-5 py-2.5 border border-black/15 rounded-lg text-black/50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Guests modal — record who's already booked on a departure ─────────────── */
/* For suppliers migrating off Wix Events (or any other outside booking       */
/* system): the guest already has a seat, so this just records who they are  */
/* and reserves that seat here, without running them through checkout.       */

const emptyGuestForm = { name: '', email: '', phone: '', seats: '1', notes: '', packageId: '', sendConfirmation: true }

async function sendGuestConfirmation(guestId: string): Promise<{ sent: boolean; error: string | null }> {
  try {
    const res = await fetch('/api/departure-guests/send-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId }),
    })
    const data = await res.json()
    return { sent: !!data.sent, error: data.error ?? null }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'Could not send the confirmation email.' }
  }
}

function GuestsModal({
  dep, tour, onClose, onSeatsChanged,
}: { dep: Departure; tour: Tour | undefined; onClose: () => void; onSeatsChanged: (bookedSeats: number) => void }) {
  const [guests, setGuests] = useState<DepartureGuest[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyGuestForm)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Local copy of the running seat count, so "seats left" updates live as
  // guests are added/removed without waiting on the parent table to re-render.
  const [bookedSeats, setBookedSeats] = useState(dep.bookedSeats)

  useEffect(() => {
    getGuestsForDeparture(dep.id).then(g => { setGuests(g); setLoading(false) })
  }, [dep.id])

  const seatsLeft = Math.max(0, dep.maxSeats - bookedSeats)
  // The rates this departure actually offers, resolved live against the
  // tour's pricing tiers — same source the guest picks from at checkout —
  // so the supplier records exactly which rate a manually-added guest paid.
  const livePackages = dep.packages ? resolveLivePackages(dep.packages, tour) : []

  async function handleAdd() {
    if (!form.name.trim()) { setError('Guest name is required.'); return }
    setError('')
    setNotice('')
    setSaving(true)
    try {
      const guest = await addManualGuest({
        departureId: dep.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        seats: +form.seats || 1,
        notes: form.notes,
        packageId: form.packageId || undefined,
      })
      setGuests(g => [...g, guest])
      setForm(emptyGuestForm)
      const next = bookedSeats + guest.seats
      setBookedSeats(next)
      onSeatsChanged(next)

      if (form.sendConfirmation && form.email.trim()) {
        const result = await sendGuestConfirmation(guest.id)
        if (result.sent) setNotice(`Confirmation email sent to ${guest.email}.`)
        else setError(`Guest saved, but the confirmation email failed to send: ${result.error}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add this guest.')
    } finally {
      setSaving(false)
    }
  }

  async function handleResend(guest: DepartureGuest) {
    setSendingId(guest.id)
    setNotice('')
    setError('')
    const result = await sendGuestConfirmation(guest.id)
    if (result.sent) setNotice(`Confirmation email sent to ${guest.email}.`)
    else setError(`Could not send: ${result.error}`)
    setSendingId(null)
  }

  async function handleRemove(guest: DepartureGuest) {
    setRemovingId(guest.id)
    try {
      await removeManualGuest(guest)
      setGuests(g => g.filter(x => x.id !== guest.id))
      const next = Math.max(0, bookedSeats - guest.seats)
      setBookedSeats(next)
      onSeatsChanged(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove this guest.')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-xl border border-black/8 w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display italic text-xl text-black/90">Guests</h2>
            <p className="font-sans text-xs text-black/40 mt-0.5">{dep.tour} · {dep.date} · {seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left</p>
          </div>
          <button onClick={onClose} className="text-black/30 hover:text-black/60"><X size={18} /></button>
        </div>

        <div className="space-y-2">
          {loading && <p className="font-sans text-sm text-black/30">Loading…</p>}
          {!loading && guests.length === 0 && (
            <p className="font-sans text-sm text-black/30">No guests recorded yet. Add anyone who booked outside the platform below (e.g. migrating from Wix Events).</p>
          )}
          {guests.map(g => {
            const pkg = livePackages.find(p => p.id === g.packageId)
            return (
              <div key={g.id} className="flex items-center justify-between gap-3 border border-black/8 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="font-sans text-sm text-black/80 truncate">
                    {g.name} <span className="text-black/35">· {g.seats} seat{g.seats === 1 ? '' : 's'}{pkg ? ` · ${pkg.name}` : ''}</span>
                  </p>
                  {(g.email || g.phone) && (
                    <p className="font-sans text-xs text-black/40 truncate">{[g.email, g.phone].filter(Boolean).join(' · ')}</p>
                  )}
                  {g.notes && <p className="font-sans text-xs text-black/35 truncate">{g.notes}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {g.email && (
                    <button onClick={() => handleResend(g)} disabled={sendingId === g.id} title="Send confirmation email" className="text-black/30 hover:text-[#C9A96E] disabled:opacity-40">
                      <Mail size={14} />
                    </button>
                  )}
                  <button onClick={() => handleRemove(g)} disabled={removingId === g.id} className="text-red-400 hover:text-red-600 disabled:opacity-40">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="h-px bg-black/6" />

        <div className="space-y-3">
          <label className="font-sans text-sm font-medium text-black/70">Add a guest</label>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Guest name" className={inp} />
            <input type="number" min="1" value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} placeholder="Seats" className={inp} />
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email (optional)" className={inp} />
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone (optional)" className={inp} />
          </div>
          {livePackages.length > 0 && (
            <div>
              <label className="font-sans text-[11px] text-black/40 block mb-1">Rate paid</label>
              <select value={form.packageId} onChange={e => setForm(f => ({ ...f, packageId: e.target.value }))} className={inp}>
                <option value="">No specific rate</option>
                {livePackages.map(p => <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.pricePerPerson)}</option>)}
              </select>
            </div>
          )}
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes — e.g. Wix booking reference (optional)" className={inp} />
          <label className="flex items-center gap-2 font-sans text-xs text-black/60 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sendConfirmation}
              onChange={e => setForm(f => ({ ...f, sendConfirmation: e.target.checked }))}
              className="accent-[#C9A96E]"
            />
            Send a confirmation email with their itinerary{!form.email.trim() && ' (needs an email address above)'}
          </label>
          {error && <p className="font-sans text-xs text-red-500">{error}</p>}
          {notice && <p className="font-sans text-xs text-[#2d6a4f]">{notice}</p>}
          <button onClick={handleAdd} disabled={saving} className="flex items-center gap-1.5 font-sans text-xs text-[#C9A96E] hover:text-[#b8965d] disabled:opacity-50">
            <Plus size={13} /> {saving ? 'Adding…' : 'Add guest'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

function DeparturesInner() {
  const searchParams = useSearchParams()
  const tourFilter = searchParams.get('tour')

  const [tours, setTours] = useState<Tour[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [guides, setGuides] = useState<Guide[]>([])
  const [rows, setRows] = useState<Departure[]>([])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [configuring, setConfiguring] = useState<Departure | null>(null)
  const [managingGuests, setManagingGuests] = useState<Departure | null>(null)
  const [form, setForm] = useState({
    tourId: '', date: '', guide: '', maxSeats: '10',
    inclusions: [] as string[],
    packages: [emptyPackage('Standard')] as PackageForm[],
  })

  useEffect(() => {
    // Both reads are supplier-scoped; the unscoped variants are public-catalog only.
    getMyTours().then(all => {
      const active = all.filter(t => t.status === 'active')
      setTours(active)
      if (tourFilter) {
        const t = active.find(x => x.id === tourFilter)
        if (t) setForm(f => ({ ...f, tourId: t.id }))
      }
    })
    getMyDepartures().then(setRows)
    getTrails().then(setTrails)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) setGuides(await getSupplierEntities<Guide>('guides', effectiveSupplierId(user.id)))
    })
  }, [tourFilter])

  const activeTour = tourFilter ? tours.find(t => t.id === tourFilter) : null
  const filtered = activeTour ? rows.filter(r => r.tourId === activeTour.id) : rows

  function selectTour(tourId: string) {
    const tour = tours.find(t => t.id === tourId)
    setForm(f => {
      // Only replace packages while the form is still at its untouched
      // default (a single blank row) — never clobber packages the supplier
      // already started editing.
      const untouched = f.packages.length === 1 && !f.packages[0].pricePerPerson
      const packages = untouched
        ? (tour?.pricingTiers && tour.pricingTiers.length > 0
            ? packagesFromTiers(tour.pricingTiers)
            : [{ ...f.packages[0], name: f.packages[0].name || 'Standard', pricePerPerson: tour ? String(tour.pricePerPerson || '') : f.packages[0].pricePerPerson }])
        : f.packages
      return {
        ...f,
        tourId,
        inclusions: f.inclusions.length === 0 ? (tour?.included ?? []) : f.inclusions,
        packages,
      }
    })
  }

  async function handleAdd() {
    if (!form.tourId || !form.date) return
    const tour = tours.find(t => t.id === form.tourId)
    if (!tour) return
    const packages = formToPackages(form.packages)
    if (packages.length === 0) return
    setSaving(true)
    try {
      const dep = await addDeparture({
        tourId: tour.id,
        trailId: tour.trailId,
        tour: tour.name,
        supplierName: tour.supplierName || tour.name,
        supplierId: tour.supplierId || '',
        tourDays: tour.days,
        date: form.date,
        guide: form.guide,
        maxSeats: +form.maxSeats,
        bookedSeats: 0,
        status: 'open',
        pricePerPerson: cheapest(packages),
        inclusions: form.inclusions,
        packages: withTierOverrides(packages, tour),
      })
      setRows(r => [...r, dep])
      setAdding(false)
      setForm({ tourId: tourFilter ? form.tourId : '', date: '', guide: '', maxSeats: '10', inclusions: [], packages: [emptyPackage('Standard')] })
    } catch (e) {
      console.error('[departures] save failed:', e)
      alert('Failed to save departure. Check the console for details.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteDeparture(id)
    setRows(rs => rs.filter(x => x.id !== id))
  }

  function rateSummary(r: Departure) {
    const packages = r.packages && r.packages.length > 0 ? resolveLivePackages(r.packages, tours.find(t => t.id === r.tourId)) : null
    if (!packages) return `${formatMoney(r.pricePerPerson)}`
    if (packages.length === 1) return `${formatMoney(packages[0].pricePerPerson)} · ${packages[0].name}`
    const prices = packages.map(p => p.pricePerPerson)
    return `${formatMoney(Math.min(...prices))}–${Math.max(...prices).toLocaleString()} · ${packages.length} rates`
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Departures</h1>
          {activeTour && (
            <div className="flex items-center gap-2 bg-[#C9A96E]/10 text-[#C9A96E] font-sans text-xs px-3 py-1 rounded-full">
              {activeTour.name}
              <Link href="/supplier/departures" className="hover:text-black/50">
                <X size={12} />
              </Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {activeTour && (
            <Link href="/supplier/departures" className="font-sans text-xs text-black/40 hover:text-black/70 flex items-center gap-1">
              <ChevronLeft size={12} /> All departures
            </Link>
          )}
          <button onClick={() => setAdding(v => !v)} className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
            <Plus size={15} /> Schedule Departure
          </button>
        </div>
      </div>

      {adding && (
        <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Tour</label>
              <select
                value={form.tourId}
                onChange={e => selectTour(e.target.value)}
                className={inp}
              >
                <option value="">Select tour…</option>
                {tours.length === 0 && <option disabled>No active tours — create one first</option>}
                {tours.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Departure Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Assigned Guide</label>
              <select value={form.guide} onChange={e => setForm(f => ({ ...f, guide: e.target.value }))} className={inp}>
                <option value="">Select guide…</option>
                {guides.length === 0 && <option disabled>No guides on your team yet</option>}
                {guides.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
              </select>
              {guides.length === 0 && (
                <p className="font-sans text-[11px] text-black/30">
                  <Link href="/supplier/guides" className="text-[#C9A96E] hover:underline">Add a guide to your team</Link> to assign one here.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Max Seats</label>
              <input type="number" value={form.maxSeats} onChange={e => setForm(f => ({ ...f, maxSeats: e.target.value }))} min="1" className={inp} />
            </div>
          </div>

          <div className="h-px bg-black/6" />

          <RatesFieldset
            inclusions={form.inclusions}
            onChangeInclusions={next => setForm(f => ({ ...f, inclusions: next }))}
            packages={form.packages}
            onChangePackages={next => setForm(f => ({ ...f, packages: next }))}
            tour={tours.find(t => t.id === form.tourId)}
            trailDayCount={trails.find(t => t.id === tours.find(x => x.id === form.tourId)?.trailId)?.days.length ?? 0}
          />

          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              disabled={saving || !form.tourId || !form.date}
              className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Add Departure'}
            </button>
            <button onClick={() => setAdding(false)} className="font-sans text-sm px-4 py-2 border border-black/10 rounded-lg text-black/50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/6">
              {['Tour', 'Date', 'Guide', 'Seats', 'Rates', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center font-sans text-sm text-black/30">No departures scheduled</td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.id} className={i < filtered.length - 1 ? 'border-b border-black/5' : ''}>
                <td className="px-4 py-3 font-sans text-sm text-black/80">{r.tour}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{r.date}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{r.guide || '—'}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">
                  <span className="flex items-center gap-1"><Users size={12} /> {r.bookedSeats}/{r.maxSeats}</span>
                </td>
                <td className="px-4 py-3 font-sans text-sm text-black/60 whitespace-nowrap">{rateSummary(r)}</td>
                <td className="px-4 py-3">
                  <span className={`font-sans text-xs px-2 py-0.5 rounded-full capitalize ${STATUS[r.status]}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setManagingGuests(r)} className="text-black/30 hover:text-[#C9A96E]" title="Add or view guests">
                      <UserPlus size={14} />
                    </button>
                    <button onClick={() => setConfiguring(r)} className="text-black/30 hover:text-[#C9A96E]" title="Configure rates & inclusions">
                      <Settings2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {configuring && (
        <ConfigureModal
          dep={configuring}
          tour={tours.find(t => t.id === configuring.tourId)}
          trailDayCount={trails.find(t => t.id === tours.find(x => x.id === configuring.tourId)?.trailId)?.days.length ?? 0}
          onClose={() => setConfiguring(null)}
          onSaved={patch => setRows(rs => rs.map(x => (x.id === configuring.id ? { ...x, ...patch } : x)))}
        />
      )}

      {managingGuests && (
        <GuestsModal
          dep={managingGuests}
          tour={tours.find(t => t.id === managingGuests.tourId)}
          onClose={() => setManagingGuests(null)}
          onSeatsChanged={bookedSeats => setRows(rs => rs.map(x => (x.id === managingGuests.id ? { ...x, bookedSeats, status: bookedSeats >= x.maxSeats ? 'full' : (x.status === 'full' ? 'open' : x.status) } : x)))}
        />
      )}
    </div>
  )
}

export default function DeparturesPage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" /></div>}>
      <DeparturesInner />
    </Suspense>
  )
}

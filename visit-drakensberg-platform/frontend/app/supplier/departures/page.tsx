'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Plus, Users, Trash2, ChevronLeft, X, Settings2, UserPlus, Mail, Pencil, ArrowUp, UserRound } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { getSupplierEntities, type SupplierEntity } from '@/lib/supplier-entities'
import { GUIDE_TYPE_LABEL, guideTypeOf, type GuideType } from '@/lib/operators'
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
import { splitGuides, joinGuides, sameGuides } from '@/lib/departure-guides'
import { getContacts, type Contact } from '@/lib/contacts'
import ContactPicker from '@/components/admin/contacts/ContactPicker'
import {
  getGuestsForDeparture, addManualGuest, removeManualGuest, getBookingsForDeparture, duplicatedBooking,
  type DepartureGuest, type DepartureBooking,
} from '@/lib/departure-guests'

type Guide = SupplierEntity & { name: string; guideType?: GuideType }

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
            trip length; a rate linked to a pricing tier follows that tier&apos;s itinerary instead, which you edit on the tour.
          </p>
        )}
        <PackagesEditor packages={packages} onChange={onChangePackages} itineraryDayCount={trailDayCount} />
      </div>
    </div>
  )
}

/* ─── Guides ─────────────────────────────────────────────────────────────────── */

/**
 * Pick one or more guides for a departure, lead guide first. Team guides come
 * from the supplier's roster; a guide who isn't on it (a freelancer, a guide
 * borrowed from another operator) can be typed in. Stored joined with " + "
 * in the departure's `guide` field — see lib/departure-guides.ts.
 */
function GuidesPicker({ value, onChange, guides }: {
  value: string[]
  onChange: (next: string[]) => void
  guides: Guide[]
}) {
  const [other, setOther] = useState('')
  const chosen = new Set(value.map(v => v.toLowerCase()))
  const available = guides.filter(g => !chosen.has(g.name.toLowerCase()))
  const typeOf = (name: string) => {
    const g = guides.find(x => x.name.toLowerCase() === name.toLowerCase())
    return g ? GUIDE_TYPE_LABEL[guideTypeOf(g)] : 'Not on your team'
  }
  const add = (name: string) => {
    const n = name.replace(/\s+/g, ' ').trim()
    if (n && !chosen.has(n.toLowerCase())) onChange([...value, n])
  }
  const move = (i: number) => onChange([value[i], ...value.filter((_, j) => j !== i)])

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <p className="font-sans text-xs text-black/35">No guide assigned yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((name, i) => (
            <li key={name} className="flex items-center gap-2 border border-black/10 rounded-lg px-3 py-2">
              <UserRound size={14} className="text-[#C9A96E] shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-sans text-sm text-black/80 truncate">{name}</span>
                <span className="block font-sans text-[11px] text-black/35">{i === 0 ? 'Lead guide · ' : ''}{typeOf(name)}</span>
              </span>
              {i > 0 && (
                <button type="button" onClick={() => move(i)} title="Make lead guide" aria-label={`Make ${name} the lead guide`}
                  className="text-black/30 hover:text-[#C9A96E] p-1"><ArrowUp size={14} /></button>
              )}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${name}`}
                className="text-black/30 hover:text-red-500 p-1"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}

      <select value="" onChange={e => { if (e.target.value) add(e.target.value) }} className={inp}>
        <option value="">{value.length ? 'Add another guide…' : 'Select guide…'}</option>
        {available.length === 0 && <option disabled>{guides.length ? 'Every team guide is already on it' : 'No guides on your team yet'}</option>}
        {/* The type rides along in the label: a trainee shouldn't be
            assigned to lead a departure on their own. */}
        {available.map(g => (
          <option key={g.id} value={g.name}>{g.name} — {GUIDE_TYPE_LABEL[guideTypeOf(g)]}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <input value={other} onChange={e => setOther(e.target.value)} placeholder="Or type a guide who isn't on your team"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(other); setOther('') } }}
          className={`${inp} flex-1`} />
        <button type="button" onClick={() => { add(other); setOther('') }} disabled={!other.trim()}
          className="font-sans text-xs px-3 rounded-lg border border-black/15 text-black/60 disabled:opacity-40">Add</button>
      </div>
      {guides.length === 0 && (
        <p className="font-sans text-[11px] text-black/30">
          <Link href="/supplier/guides" className="text-[#C9A96E] hover:underline">Add a guide to your team</Link> to pick them here.
        </p>
      )}
    </div>
  )
}

/** Change who guides an existing departure — open, full or already booked. */
function GuidesModal({ dep, guides, onClose, onSaved }: {
  dep: Departure
  guides: Guide[]
  onClose: () => void
  onSaved: (patch: Partial<Departure>) => void
}) {
  const [value, setValue] = useState<string[]>(() => splitGuides(dep.guide))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const next = joinGuides(value)
  const changed = !sameGuides(next, dep.guide)

  async function save() {
    if (!changed) { onClose(); return }
    setSaving(true); setError(null)
    // A different guide hasn't been told about this departure yet: clear the
    // "guide notified" mark the staff page keeps, so it shows as pending again.
    const patch = { guide: next, guideNotified: false }
    try {
      await updateDeparture(dep.id, patch)
      onSaved({ guide: next })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the guides')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-white sm:rounded-xl border border-black/8 w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display italic text-xl text-black/90">Guides</h2>
            <p className="font-sans text-xs text-black/40 mt-0.5">{dep.tour} · {dep.date}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-black/30 hover:text-black/60"><X size={18} /></button>
        </div>

        <GuidesPicker value={value} onChange={setValue} guides={guides} />

        {dep.bookedSeats > 0 && changed && (
          <p className="font-sans text-xs text-black/50 bg-[#F7F5F2] rounded-lg px-3 py-2">
            {dep.bookedSeats} guest{dep.bookedSeats === 1 ? ' has' : 's have'} already booked. They&apos;ll see the new
            guide{value.length === 1 ? '' : 's'} on the listing and their itinerary; resend their confirmation from the
            guests list if you want to email them.
          </p>
        )}
        {error && <p className="font-sans text-xs text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg disabled:opacity-50">
            {saving ? 'Saving…' : changed ? 'Save Guides' : 'Done'}
          </button>
          <button onClick={onClose} className="font-sans text-sm px-5 py-2.5 border border-black/15 rounded-lg text-black/50">Cancel</button>
        </div>
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
  // Guests who booked through checkout — paid, or still paying.
  const [bookings, setBookings] = useState<DepartureBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyGuestForm)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Visit Drakensberg staff (admin, finance, operations) can pick the guest
  // from the platform's contact book, filtered to people who have been
  // invoiced. A supplier signed into their own portal never sees it: the
  // contact book is staff-only by RLS, and the picker isn't shown either.
  const [isStaff, setIsStaff] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [pickedContact, setPickedContact] = useState<Contact | null>(null)
  useEffect(() => {
    let live = true
    supabase.rpc('is_ops').then(({ data }) => {
      if (!live || data !== true) return
      setIsStaff(true)
      setContactsLoading(true)
      getContacts()
        .then(c => { if (live) setContacts(c ?? []) })
        .finally(() => { if (live) setContactsLoading(false) })
    })
    return () => { live = false }
  }, [])
  function pickContact(c: Contact) {
    setPickedContact(c)
    // Every field comes from the picked contact. A contact with no name leaves
    // the name blank (never the previous guest's) so "Guest name is required"
    // asks for it, rather than mailing this person an itinerary addressed to
    // somebody else.
    setForm(f => ({ ...f, name: c.name || c.company || '', email: c.email ?? '', phone: c.phone }))
  }
  function clearPicked() {
    setPickedContact(null)
    setForm(f => ({ ...f, name: '', email: '', phone: '' }))
  }
  // Local copy of the running seat count, so "seats left" updates live as
  // guests are added/removed without waiting on the parent table to re-render.
  const [bookedSeats, setBookedSeats] = useState(dep.bookedSeats)

  useEffect(() => {
    Promise.all([getGuestsForDeparture(dep.id), getBookingsForDeparture(dep.id)])
      .then(([g, b]) => { setGuests(g); setBookings(b); setLoading(false) })
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
      setPickedContact(null)
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

        {loading && <p className="font-sans text-sm text-black/30">Loading…</p>}

        {!loading && bookings.length > 0 && (
          <div className="space-y-2">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-black/40">Booked online</p>
            {bookings.map(b => {
              const pkg = livePackages.find(p => p.id === b.packageId)
              const rate = pkg?.name ?? b.rateTitle?.match(/\(([^)]+)\)\s*$/)?.[1]
              const releases = b.releasesAt
                ? new Date(b.releasesAt).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : ''
              return (
                <div key={b.bookingId} className={`border rounded-lg px-3 py-2 ${b.status === 'pending' ? 'border-amber-200 bg-amber-50/40' : 'border-black/8'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-sans text-sm text-black/80 min-w-0 truncate">
                      {b.customerName} <span className="text-black/35">· {b.seats} seat{b.seats === 1 ? '' : 's'}{rate ? ` · ${rate}` : ''}</span>
                    </p>
                    <span className={`shrink-0 font-sans text-[10px] px-2 py-0.5 rounded-full ${b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {b.status === 'confirmed' ? 'Paid' : 'Not paid yet'}
                    </span>
                  </div>
                  <p className="font-sans text-xs text-black/40 truncate">{[b.customerEmail, b.reference].filter(Boolean).join(' · ')}</p>
                  {b.status === 'pending' && (
                    <p className="font-sans text-[11px] text-amber-700 mt-0.5">
                      {b.paymentOpen ? 'Payment page open. ' : 'Payment declined or not started. '}
                      Seat{b.seats === 1 ? '' : 's'} released {releases ? `at ${releases}` : 'shortly'} unless they pay.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="space-y-2">
          {!loading && (guests.length > 0 || bookings.length > 0) && (
            <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-black/40">Added by hand</p>
          )}
          {!loading && guests.length === 0 && (
            <p className="font-sans text-sm text-black/30">
              {bookings.length > 0 ? 'Nobody added by hand.' : 'No guests yet.'} Add anyone who booked outside the platform below (e.g. migrating from Wix Events).
            </p>
          )}
          {guests.map(g => {
            const pkg = livePackages.find(p => p.id === g.packageId)
            const dup = duplicatedBooking(g, bookings)
            return (
              <div key={g.id} className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2 ${dup ? 'border-amber-300 bg-amber-50/40' : 'border-black/8'}`}>
                <div className="min-w-0">
                  <p className="font-sans text-sm text-black/80 truncate">
                    {g.name} <span className="text-black/35">· {g.seats} seat{g.seats === 1 ? '' : 's'}{pkg ? ` · ${pkg.name}` : ''}</span>
                  </p>
                  {(g.email || g.phone) && (
                    <p className="font-sans text-xs text-black/40 truncate">{[g.email, g.phone].filter(Boolean).join(' · ')}</p>
                  )}
                  {g.notes && <p className="font-sans text-xs text-black/35 truncate">{g.notes}</p>}
                  {dup && (
                    <p className="font-sans text-[11px] text-amber-700 mt-0.5">
                      Also booked online as {dup.reference}, so this entry takes a second seat. Remove it if it&apos;s the same guest.
                    </p>
                  )}
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
          {isStaff && (
            <div className="space-y-1">
              <ContactPicker contacts={contacts} loading={contactsLoading} invoicedOnly
                selected={pickedContact} onSelect={pickContact} onAddNew={clearPicked} />
              <p className="font-sans text-[11px] text-black/35">
                Pick someone Visit Drakensberg has invoiced to fill in their details, or type a new guest below.
              </p>
            </div>
          )}
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
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes, e.g. Wix booking reference (optional)" className={inp} />
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
  const [editingGuides, setEditingGuides] = useState<Departure | null>(null)
  const [form, setForm] = useState({
    tourId: '', date: '', guides: [] as string[], maxSeats: '10',
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
        guide: joinGuides(form.guides),
        maxSeats: +form.maxSeats,
        bookedSeats: 0,
        status: 'open',
        pricePerPerson: cheapest(packages),
        inclusions: form.inclusions,
        packages: withTierOverrides(packages, tour),
      })
      setRows(r => [...r, dep])
      setAdding(false)
      setForm({ tourId: tourFilter ? form.tourId : '', date: '', guides: [], maxSeats: '10', inclusions: [], packages: [emptyPackage('Standard')] })
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
                {tours.length === 0 && <option disabled>No active tours. Create one first</option>}
                {tours.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Departure Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Guides <span className="font-normal text-black/30">(lead first; change any time)</span></label>
              <GuidesPicker value={form.guides} onChange={next => setForm(f => ({ ...f, guides: next }))} guides={guides} />
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
        <div className="overflow-x-auto">
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
                <td className="px-4 py-3 font-sans text-sm text-black/60">
                  <button onClick={() => setEditingGuides(r)} title="Change guides"
                    className="group inline-flex items-start gap-1.5 text-left hover:text-[#C9A96E]">
                    <span>
                      {splitGuides(r.guide).length === 0
                        ? <span className="text-[#C9A96E]">Assign guide</span>
                        : splitGuides(r.guide).map(n => <span key={n} className="block">{n}</span>)}
                    </span>
                    <Pencil size={12} className="mt-1 shrink-0 text-black/25 group-hover:text-[#C9A96E]" />
                  </button>
                </td>
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

      {editingGuides && (
        <GuidesModal
          dep={editingGuides}
          guides={guides}
          onClose={() => setEditingGuides(null)}
          onSaved={patch => setRows(rs => rs.map(x => (x.id === editingGuides.id ? { ...x, ...patch } : x)))}
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

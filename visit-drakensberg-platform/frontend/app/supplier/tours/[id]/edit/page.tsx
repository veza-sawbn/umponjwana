'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Plus, X } from 'lucide-react'
import { getMyTours, updateTour } from '@/lib/tours'
import { getTrails, type TrailDay } from '@/lib/trails'
import { GoogleAddressField } from '@/components/maps/GoogleAddressField'
import { PackagesEditor, emptyTier, tiersToForm, formToTiers, cheapest, type PackageForm } from '@/components/tours/PackageEditor'
import TierItineraryEditor from '@/components/tours/TierItineraryEditor'

const DIFFICULTIES = ['Easy', 'Moderate', 'Challenging', 'Extreme']
const CANCELLATIONS = ['48h', '72h', '7 days', '14 days']

type FormState = {
  name: string; difficulty: string; days: number; minAge: number; maxGroup: number;
  meetingPoint: string; gpsLat: string; gpsLng: string; description: string;
  included: string[]; fitnessNotes: string; cancellation: string;
  pricingTiers: PackageForm[]; status: 'active' | 'draft'
}

const EMPTY: Omit<FormState, 'pricingTiers'> = {
  name: '', difficulty: 'Moderate', days: 1, minAge: 0, maxGroup: 10,
  meetingPoint: '', gpsLat: '', gpsLng: '', description: '',
  included: [], fitnessNotes: '', cancellation: '48h',
  status: 'active',
}

export default function EditTourPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  // Lazy initializer so each mount gets a fresh tier id — EMPTY is a module
  // singleton and would otherwise hand every mount the same placeholder id
  // (overwritten once the real tour loads below, but never while loading===true).
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY, pricingTiers: [emptyTier('Standard')] }))
  // The tour's linked trail's day-by-day plan — the default every pricing
  // tier's itinerary is built from (see TierItineraryEditor). Trail
  // assignment itself isn't editable here (fixed at tour creation).
  const [trailDays, setTrailDays] = useState<TrailDay[]>([])
  const [includedDraft, setIncludedDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    // Scoped read: a supplier must not be able to load another supplier's
    // tour into this form, even though the write would be refused by RLS.
    getMyTours().then(async all => {
      const tour = all.find(t => t.id === id)
      if (tour) {
        setForm({
          name: tour.name, difficulty: tour.difficulty, days: tour.days,
          minAge: tour.minAge, maxGroup: tour.maxGroup,
          meetingPoint: tour.meetingPoint, gpsLat: tour.gpsLat, gpsLng: tour.gpsLng,
          description: tour.description, included: tour.included,
          fitnessNotes: tour.fitnessNotes, cancellation: tour.cancellation,
          pricingTiers: tiersToForm(tour.pricingTiers, tour.pricePerPerson),
          status: tour.status,
        })
        const trails = await getTrails()
        setTrailDays(trails.find(t => t.id === tour.trailId)?.days ?? [])
      }
      setLoading(false)
    })
  }, [id])

  function addIncluded() {
    const v = includedDraft.trim()
    if (!v) return
    setForm(f => (f.included.includes(v) ? f : { ...f, included: [...f.included, v] }))
    setIncludedDraft('')
  }

  function removeIncluded(item: string) {
    setForm(f => ({ ...f, included: f.included.filter(x => x !== item) }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Tour name is required.'); return }
    const pricingTiers = formToTiers(form.pricingTiers)
    if (pricingTiers.length === 0) { setError('At least one pricing tier with a name and price is required.'); return }
    setError('')
    setSaving(true)
    try {
      await updateTour(id, { ...form, pricingTiers, pricePerPerson: cheapest(pricingTiers) })
      router.push('/supplier/tours')
    } catch {
      setError('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Tours</button>
      <h1 className="font-display italic text-2xl text-black/90 mb-6">Edit Tour</h1>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        <F label="Tour Name" required><input value={form.name} onChange={e => set('name', e.target.value)} className={inp} /></F>

        <F label="Difficulty">
          <div className="flex gap-2 flex-wrap">
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => set('difficulty', d)} className={chip(form.difficulty === d)}>{d}</button>
            ))}
          </div>
        </F>

        <div className="grid grid-cols-3 gap-4">
          <F label="Duration (days)" required><input type="number" value={form.days} onChange={e => set('days', +e.target.value)} min="1" className={inp} /></F>
          <F label="Min Age"><input type="number" value={form.minAge} onChange={e => set('minAge', +e.target.value)} min="0" className={inp} /></F>
          <F label="Max Group Size"><input type="number" value={form.maxGroup} onChange={e => set('maxGroup', +e.target.value)} min="1" className={inp} /></F>
        </div>

        <GoogleAddressField label="Meeting Point / Start Location" required value={form.meetingPoint} lat={form.gpsLat} lng={form.gpsLng} placeholder="Start typing the meeting point" inputClassName={inp} labelClassName="font-sans text-sm font-medium text-black/70" onChange={({ address, lat, lng }) => { set('meetingPoint', address); if (lat) set('gpsLat', lat); if (lng) set('gpsLng', lng) }} />
        <div className="grid grid-cols-2 gap-4">
          <F label="GPS Latitude"><input value={form.gpsLat} onChange={e => set('gpsLat', e.target.value)} className={inp} /></F>
          <F label="GPS Longitude"><input value={form.gpsLng} onChange={e => set('gpsLng', e.target.value)} className={inp} /></F>
        </div>

        <F label="Description" required><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} className={`${inp} resize-none`} /></F>

        <F label="What's Included">
          <div className="flex gap-2">
            <input
              value={includedDraft}
              onChange={e => setIncludedDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIncluded() } }}
              placeholder="e.g. Two nights in mountain huts"
              className={inp}
            />
            <button
              type="button"
              onClick={addIncluded}
              disabled={!includedDraft.trim()}
              className="shrink-0 px-3 rounded-lg border border-black/15 text-black/60 hover:border-[#C9A96E]/50 hover:text-[#C9A96E] disabled:opacity-30 transition-colors"
              aria-label="Add inclusion"
            >
              <Plus size={16} />
            </button>
          </div>
          {form.included.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {form.included.map(item => (
                <li key={item} className="flex items-center justify-between gap-3 border border-black/8 rounded-lg px-3 py-2">
                  <span className="font-sans text-sm text-black/70 min-w-0 break-words">{item}</span>
                  <button
                    type="button"
                    onClick={() => removeIncluded(item)}
                    className="text-black/25 hover:text-red-500 shrink-0 transition-colors"
                    aria-label={`Remove ${item}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="font-sans text-xs text-black/35 mt-1">
            List exactly what this tour covers, in your own words. Press Enter to add each one.
          </p>
        </F>

        <F label="Fitness Requirements"><textarea value={form.fitnessNotes} onChange={e => set('fitnessNotes', e.target.value)} rows={3} className={`${inp} resize-none`} /></F>

        <F label="Cancellation Policy">
          <select value={form.cancellation} onChange={e => set('cancellation', e.target.value)} className={inp}>
            {CANCELLATIONS.map(c => <option key={c}>{c}</option>)}
          </select>
        </F>

        <F label="Pricing Tiers" required>
          <PackagesEditor
            packages={form.pricingTiers}
            onChange={next => set('pricingTiers', next)}
            namePlaceholder={i => (i === 0 ? 'Tier name (e.g. Shuttled)' : 'Tier name (e.g. Self-Drive)')}
            priceLabel="Price per person (ZAR)"
            inclusionsLabel="Add-ons for this tier"
            addLabel="Add another pricing tier"
            makeRow={emptyTier}
            renderExtra={(pkg, update) => (
              <TierItineraryEditor trailDays={trailDays} pkg={pkg} update={update} />
            )}
          />
          <p className="font-sans text-xs text-black/35 mt-1">
            Each departure can offer a subset of these tiers — e.g. Shuttled on one date, Self-Drive on another.
            {trailDays.length > 0
              ? ' Each tier starts from the trail’s day-by-day plan (Admin → Trails) — customize it per tier above.'
              : ' Add a day-by-day plan to this trail at Admin → Trails to let tiers customize their itinerary.'}
          </p>
        </F>

        <F label="Status">
          <div className="flex gap-2">
            {['active', 'draft'].map(s => (
              <button key={s} onClick={() => set('status', s)} className={chip(form.status === s)}>{s}</button>
            ))}
          </div>
        </F>
      </div>

      {error && <p className="font-sans text-sm text-red-500 mt-2">{error}</p>}

      <div className="flex gap-3 mt-6">
        <button onClick={handleSave} disabled={saving} className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={() => router.back()} className="font-sans text-sm px-5 py-2.5 border border-black/15 rounded-lg text-black/50">Cancel</button>
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
const chip = (active: boolean) => `font-sans text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${active ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`
function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-sm font-medium text-black/70">{label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

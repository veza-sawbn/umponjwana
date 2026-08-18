'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Mountain, ChevronDown, Plus, X } from 'lucide-react'
import { getTrails, type Trail } from '@/lib/trails'
import { addTour } from '@/lib/tours'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { getMyOperatorProfile } from '@/lib/operators'
import { GoogleAddressField } from '@/components/maps/GoogleAddressField'
import { PackagesEditor, emptyTier, formToTiers, cheapest, type PackageForm } from '@/components/tours/PackageEditor'

const DIFFICULTIES = ['Easy', 'Moderate', 'Challenging', 'Extreme']
const CANCELLATIONS = ['48h', '72h', '7 days', '14 days']

const EMPTY = {
  trailId: '', trailName: '',
  name: '', difficulty: 'Moderate', days: 1, minAge: 0, maxGroup: 10,
  meetingPoint: '', gpsLat: '', gpsLng: '', description: '',
  included: [] as string[], fitnessNotes: '', cancellation: '48h',
  status: 'draft' as 'active' | 'draft',
}

export default function NewTourPage() {
  const router = useRouter()
  // Lazy initializer so each mount gets a fresh tier id — EMPTY is a module
  // singleton and would otherwise hand every "New Tour" visit in the same
  // session the same id.
  const [form, setForm] = useState(() => ({ ...EMPTY, pricingTiers: [emptyTier('Standard')] as PackageForm[] }))
  const [trails, setTrails] = useState<Trail[]>([])
  const [trailOpen, setTrailOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Resolved from the supplier's own account — never typed in by hand, so a
  // tour can't be published under a company name the supplier doesn't own.
  const [supplierId, setSupplierId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [includedDraft, setIncludedDraft] = useState('')
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getTrails().then(all => setTrails(all.filter(t => t.status === 'published')))
  }, [])

  // Company name comes from the operator profile (/supplier/company), falling
  // back to the account's profile name.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const ownerId = effectiveSupplierId(user.id)
      setSupplierId(ownerId)

      const operator = await getMyOperatorProfile(ownerId)
      if (operator?.companyName) { setCompanyName(operator.companyName); return }

      const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('id', ownerId).maybeSingle()
      setCompanyName(profile?.full_name || user.user_metadata?.full_name || '')
    })
  }, [])

  function addIncluded() {
    const v = includedDraft.trim()
    if (!v) return
    setForm(f => (f.included.includes(v) ? f : { ...f, included: [...f.included, v] }))
    setIncludedDraft('')
  }

  function removeIncluded(item: string) {
    setForm(f => ({ ...f, included: f.included.filter(x => x !== item) }))
  }

  function selectTrail(t: Trail) {
    setForm(f => ({
      ...f,
      trailId: t.id,
      trailName: t.name,
      name: f.name || t.name,
      difficulty: t.difficulty === 'Strenuous' ? 'Challenging' : t.difficulty,
      meetingPoint: f.meetingPoint || t.trailhead,
      description: f.description || t.description,
    }))
    setTrailOpen(false)
  }

  const selectedTrail = trails.find(t => t.id === form.trailId)

  async function handleCreate() {
    if (!form.name.trim()) { setError('Tour name is required.'); return }
    if (!form.meetingPoint.trim()) { setError('Meeting point is required.'); return }
    const pricingTiers = formToTiers(form.pricingTiers)
    if (pricingTiers.length === 0) { setError('At least one pricing tier with a name and price is required.'); return }
    setError('')
    // Snapshot form values before any async gap so stale closure can't affect them
    const snapshot = { ...form }
    // Fold in anything typed but not yet added, so a half-entered inclusion
    // isn't silently dropped on save.
    const pending = includedDraft.trim()
    const included = pending && !snapshot.included.includes(pending)
      ? [...snapshot.included, pending]
      : snapshot.included
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const ownerId = supplierId || (user ? effectiveSupplierId(user.id) : '')
      if (!ownerId) throw new Error('You need to be signed in to create a tour.')
      await addTour({
        ...snapshot,
        included,
        pricingTiers,
        pricePerPerson: cheapest(pricingTiers),
        supplierId: ownerId,
        supplierName: companyName,
      })
      router.push('/supplier/tours')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save tour. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1">
        <ChevronLeft size={14} /> Tours
      </button>
      <h1 className="font-display italic text-2xl text-black/90 mb-6">New Tour</h1>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">

        {/* Trail selector */}
        <F label="Trail" required>
          <div className="relative">
            <button
              type="button"
              onClick={() => setTrailOpen(v => !v)}
              className={`${inp} flex items-center justify-between text-left ${form.trailId ? 'text-black/80' : 'text-black/30'}`}
            >
              <span className="flex items-center gap-2">
                <Mountain size={14} className="text-[#C9A96E] shrink-0" />
                {form.trailId ? form.trailName : 'Select a trail…'}
              </span>
              <ChevronDown size={14} className={`shrink-0 transition-transform ${trailOpen ? 'rotate-180' : ''}`} />
            </button>
            {trailOpen && (
              <div className="absolute top-full left-0 right-0 z-20 bg-white border border-black/10 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto">
                {trails.length === 0 && (
                  <p className="font-sans text-sm text-black/30 px-4 py-3">No published trails found</p>
                )}
                {trails.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTrail(t)}
                    className={`w-full text-left px-4 py-3 hover:bg-[#C9A96E]/5 transition-colors border-b border-black/5 last:border-0 ${form.trailId === t.id ? 'bg-[#C9A96E]/10' : ''}`}
                  >
                    <p className="font-sans text-sm font-medium text-black/80">{t.name}</p>
                    <p className="font-sans text-xs text-black/40 mt-0.5">{t.region} · {t.distance} · {t.difficulty}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedTrail && (
            <div className="mt-2 flex flex-wrap gap-3 font-sans text-xs text-black/40">
              <span>{selectedTrail.distance}</span>
              <span>{selectedTrail.elevation}</span>
              <span>{selectedTrail.duration}</span>
              {selectedTrail.permit_required && (
                <span className="text-[#C9A96E]">Permit required · R{selectedTrail.permit_cost} pp</span>
              )}
            </div>
          )}
        </F>

        <F label="Tour Name" required>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Cathedral Peak Summit Hike" className={inp} />
        </F>

        <F label="Listed Under">
          <div className="flex items-center justify-between gap-3 border border-black/10 rounded-lg px-3 py-2 bg-black/[0.02]">
            <span className={`font-sans text-sm ${companyName ? 'text-black/70' : 'text-black/30'}`}>
              {companyName || 'Loading your company name…'}
            </span>
            <a
              href="/supplier/company"
              className="font-sans text-xs text-[#C9A96E] hover:underline shrink-0"
            >
              Edit
            </a>
          </div>
          <p className="font-sans text-xs text-black/35 mt-1">
            Taken from your company profile — every tour is published under it.
          </p>
        </F>

        <F label="Difficulty">
          <div className="flex gap-2 flex-wrap">
            {DIFFICULTIES.map(d => <button key={d} onClick={() => set('difficulty', d)} className={chip(form.difficulty === d)}>{d}</button>)}
          </div>
        </F>

        <div className="grid grid-cols-3 gap-4">
          <F label="Duration (days)" required><input type="number" value={form.days} onChange={e => set('days', +e.target.value)} min="1" className={inp} /></F>
          <F label="Min Age"><input type="number" value={form.minAge} onChange={e => set('minAge', +e.target.value)} min="0" className={inp} /></F>
          <F label="Max Group Size"><input type="number" value={form.maxGroup} onChange={e => set('maxGroup', +e.target.value)} min="1" className={inp} /></F>
        </div>

        <GoogleAddressField label="Meeting Point / Start Location" required value={form.meetingPoint} lat={form.gpsLat} lng={form.gpsLng} placeholder="e.g. Cathedral Peak Hotel carpark" inputClassName={inp} labelClassName="font-sans text-sm font-medium text-black/70" onChange={({ address, lat, lng }) => { set('meetingPoint', address); if (lat) set('gpsLat', lat); if (lng) set('gpsLng', lng) }} />
        <div className="grid grid-cols-2 gap-4">
          <F label="GPS Latitude"><input value={form.gpsLat} onChange={e => set('gpsLat', e.target.value)} placeholder="-28.9833" className={inp} /></F>
          <F label="GPS Longitude"><input value={form.gpsLng} onChange={e => set('gpsLng', e.target.value)} placeholder="29.2333" className={inp} /></F>
        </div>

        <F label="Description" required>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} placeholder="Describe the tour experience…" className={`${inp} resize-none`} />
        </F>

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
              className="shrink-0 px-3 rounded-lg border border-black/15 text-black/60 hover:border-[#C9A96E]/50 hover:text-[#C9A96E] disabled:opacity-30 disabled:hover:border-black/15 disabled:hover:text-black/60 transition-colors"
              aria-label="Add inclusion"
            >
              <Plus size={16} />
            </button>
          </div>
          {form.included.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {form.included.map(item => (
                <li
                  key={item}
                  className="flex items-center justify-between gap-3 border border-black/8 rounded-lg px-3 py-2"
                >
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

        <F label="Fitness Requirements">
          <textarea value={form.fitnessNotes} onChange={e => set('fitnessNotes', e.target.value)} rows={3} placeholder="Describe fitness level needed…" className={`${inp} resize-none`} />
        </F>

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
          />
          <p className="font-sans text-xs text-black/35 mt-1">
            Each departure can offer a subset of these tiers — e.g. Shuttled on one date, Self-Drive on another.
          </p>
        </F>

        <F label="Status">
          <div className="flex gap-2">
            {['active', 'draft'].map(s => <button key={s} onClick={() => set('status', s)} className={chip(form.status === s)}>{s}</button>)}
          </div>
        </F>
      </div>

      {error && <p className="font-sans text-sm text-red-500 mt-2">{error}</p>}

      <div className="flex gap-3 mt-6">
        <button
          onClick={handleCreate}
          disabled={saving}
          className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Create Tour'}
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
      <label className="font-sans text-sm font-medium text-black/70">
        {label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

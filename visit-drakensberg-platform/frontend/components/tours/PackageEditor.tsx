'use client'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { newDeparturePackageId, type DeparturePackage } from '@/lib/departures'
import { newPricingTierId, type PricingTier, type Tour } from '@/lib/tours'

// Shared rate/add-ons editor. A tour pricing tier and a departure rate
// package are the same shape (name + price + inclusions), so both the
// tour-tiers module (app/supplier/tours/new, app/supplier/tours/[id]/edit)
// and the per-departure rate editor (app/supplier/departures) share this
// one component and form-row type instead of duplicating it.

export const INCLUSION_OPTIONS = ['Guide', 'Permits', 'Meals', 'Accommodation', 'Transport', 'Equipment', 'Porter', 'Emergency evacuation cover']

export const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
export const chip = (active: boolean) => `font-sans text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${active ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`

// One editable row — a departure rate package or a tour pricing tier.
// `tierId` is only ever set on departure rows materialized from a tour tier
// (see app/supplier/departures/page.tsx); tour tier rows never carry it.
// `dayCount` is only meaningful on departure rate packages (the tour's
// itinerary lives at the tour level, so pricing-tier rows never set it).
export type PackageForm = { id: string; name: string; pricePerPerson: string; inclusions: string[]; tierId?: string; dayCount?: string }

export function emptyPackage(name = ''): PackageForm {
  return { id: newDeparturePackageId(), name, pricePerPerson: '', inclusions: [] }
}

export function emptyTier(name = ''): PackageForm {
  return { id: newPricingTierId(), name, pricePerPerson: '', inclusions: [] }
}

export function packagesToForm(packages: DeparturePackage[] | undefined): PackageForm[] {
  if (!packages || packages.length === 0) return [emptyPackage('Standard')]
  return packages.map(p => ({ id: p.id, name: p.name, pricePerPerson: String(p.pricePerPerson || ''), inclusions: p.inclusions ?? [], tierId: p.tierId, dayCount: p.dayCount ? String(p.dayCount) : '' }))
}

export function formToPackages(packages: PackageForm[]): DeparturePackage[] {
  return packages
    .filter(p => p.name.trim() && +p.pricePerPerson > 0)
    .map(p => ({
      id: p.id,
      name: p.name.trim(),
      pricePerPerson: +p.pricePerPerson,
      inclusions: p.inclusions,
      ...(p.tierId ? { tierId: p.tierId } : {}),
      ...(p.dayCount && +p.dayCount > 0 ? { dayCount: +p.dayCount } : {}),
    }))
}

// Tour-tier form load: a tour with no tiers yet (or one predating this
// feature) shows a single pre-filled "Standard" row seeded from its legacy
// flat price, so editing an old tour never starts from an empty state.
export function tiersToForm(tiers: PricingTier[] | undefined, fallbackPrice?: number): PackageForm[] {
  if (!tiers || tiers.length === 0) return [{ ...emptyTier('Standard'), pricePerPerson: fallbackPrice ? String(fallbackPrice) : '' }]
  return tiers.map(t => ({ id: t.id, name: t.name, pricePerPerson: String(t.pricePerPerson || ''), inclusions: t.inclusions ?? [] }))
}

export function formToTiers(rows: PackageForm[]): PricingTier[] {
  return rows
    .filter(r => r.name.trim() && +r.pricePerPerson > 0)
    .map(r => ({ id: r.id, name: r.name.trim(), pricePerPerson: +r.pricePerPerson, inclusions: r.inclusions }))
}

export function cheapest(rows: { pricePerPerson: number }[]): number {
  return rows.length > 0 ? Math.min(...rows.map(r => r.pricePerPerson)) : 0
}

// Merges live tour-tier name/inclusions/price into a departure's stored
// packages so displays follow tier edits automatically, mirroring
// resolveTierPackages() in lib/experiences.ts (kept separate to avoid this
// 'use client' module leaking into that server-safe lib). A package with no
// tierId, or whose tier has been deleted, is returned unchanged.
export function resolveLivePackages(packages: DeparturePackage[], tour: Tour | undefined): DeparturePackage[] {
  if (!tour) return packages
  return packages.map(p => {
    if (!p.tierId) return p
    const tier = tour.pricingTiers?.find(t => t.id === p.tierId)
    if (!tier) return p
    return { ...p, name: tier.name, inclusions: tier.inclusions, pricePerPerson: p.priceOverride ?? tier.pricePerPerson }
  })
}

// Given rows the supplier just edited (pre-filled with each tier's live
// price), computes which tier-linked rows they changed away from that price
// and stamps a priceOverride so it's frozen for this departure going
// forward; rows left matching the tier's current price keep following it.
export function withTierOverrides(packages: DeparturePackage[], tour: Tour | undefined): DeparturePackage[] {
  if (!tour) return packages
  return packages.map(p => {
    if (!p.tierId) return p
    const tier = tour.pricingTiers?.find(t => t.id === p.tierId)
    if (!tier) return p
    const { priceOverride: _drop, ...rest } = p
    return tier.pricePerPerson === p.pricePerPerson ? rest : { ...rest, priceOverride: p.pricePerPerson }
  })
}

export function InclusionChips({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [custom, setCustom] = useState('')
  function toggle(item: string) {
    onChange(value.includes(item) ? value.filter(x => x !== item) : [...value, item])
  }
  function addCustom() {
    const v = custom.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setCustom('')
  }
  const extras = value.filter(v => !INCLUSION_OPTIONS.includes(v))
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {INCLUSION_OPTIONS.map(item => <button key={item} type="button" onClick={() => toggle(item)} className={chip(value.includes(item))}>{item}</button>)}
        {extras.map(item => <button key={item} type="button" onClick={() => toggle(item)} className={chip(true)}>{item} ×</button>)}
      </div>
      <div className="flex gap-2">
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
          placeholder="Add custom inclusion…"
          className={`${inp} text-xs py-1.5`}
        />
        <button type="button" onClick={addCustom} className="font-sans text-xs px-3 py-1.5 border border-black/10 rounded-lg text-black/50 hover:border-[#C9A96E]/40 whitespace-nowrap">Add</button>
      </div>
    </div>
  )
}

export function PackagesEditor({
  packages, onChange,
  namePlaceholder = (i: number) => (i === 0 ? 'Rate name (e.g. Self-Sufficient)' : 'Rate name (e.g. Portered)'),
  priceLabel = 'Price per person (ZAR)',
  inclusionsLabel = 'Extra inclusions for this rate',
  addLabel = 'Add another rate package',
  makeRow = emptyPackage,
  itineraryDayCount = 0,
}: {
  packages: PackageForm[]
  onChange: (next: PackageForm[]) => void
  namePlaceholder?: (i: number) => string
  priceLabel?: string
  inclusionsLabel?: string
  addLabel?: string
  makeRow?: () => PackageForm
  // The parent tour's authored itinerary day count. > 0 unlocks a "trip
  // length for this rate" field per row, so e.g. a "Standard" package can
  // cover just the first 2 of a 3-day tour's itinerary while a "Shuttle +
  // Extra Night" package covers all 3. 0 (tour has no itinerary yet, or
  // this editor is for tour pricing tiers, which have no day pool of their
  // own) hides the field entirely — same layout as before this existed.
  itineraryDayCount?: number
}) {
  function update(id: string, patch: Partial<PackageForm>) {
    onChange(packages.map(p => (p.id === id ? { ...p, ...patch } : p)))
  }
  function remove(id: string) {
    if (packages.length <= 1) return
    onChange(packages.filter(p => p.id !== id))
  }
  return (
    <div className="space-y-4">
      {packages.map((pkg, i) => (
        <div key={pkg.id} className="border border-black/10 rounded-lg p-4 space-y-3 bg-black/[0.015]">
          <div className="flex items-center gap-3">
            <input
              value={pkg.name}
              onChange={e => update(pkg.id, { name: e.target.value })}
              placeholder={namePlaceholder(i)}
              className={`${inp} font-medium`}
            />
            {packages.length > 1 && (
              <button type="button" onClick={() => remove(pkg.id)} className="text-red-400 hover:text-red-600 shrink-0">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="w-44">
              <label className="font-sans text-xs text-black/40 block mb-1">{priceLabel}</label>
              <input type="number" value={pkg.pricePerPerson} onChange={e => update(pkg.id, { pricePerPerson: e.target.value })} placeholder="0" min="0" className={inp} />
            </div>
            {itineraryDayCount > 0 && (
              <div className="w-44">
                <label className="font-sans text-xs text-black/40 block mb-1">Trip length for this rate</label>
                <select value={pkg.dayCount || ''} onChange={e => update(pkg.id, { dayCount: e.target.value })} className={inp}>
                  <option value="">All {itineraryDayCount} days</option>
                  {Array.from({ length: itineraryDayCount }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} day{n !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="font-sans text-xs text-black/40 block mb-1">{inclusionsLabel}</label>
            <InclusionChips value={pkg.inclusions} onChange={next => update(pkg.id, { inclusions: next })} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...packages, makeRow()])} className="flex items-center gap-1.5 font-sans text-xs text-[#C9A96E] hover:text-[#b8965d]">
        <Plus size={13} /> {addLabel}
      </button>
    </div>
  )
}

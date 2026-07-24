'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Plus, Users, Trash2, ChevronLeft, X, Settings2 } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { getSupplierEntities, type SupplierEntity } from '@/lib/supplier-entities'
import { getTours, type Tour } from '@/lib/tours'
import {
  getDepartures, addDeparture, updateDeparture, deleteDeparture, newDeparturePackageId,
  type Departure, type DeparturePackage,
} from '@/lib/departures'

type Guide = SupplierEntity & { name: string }

const STATUS: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  open:      'bg-blue-100 text-blue-700',
  full:      'bg-slate-100 text-slate-600',
}

const INCLUSION_OPTIONS = ['Guide', 'Permits', 'Meals', 'Accommodation', 'Transport', 'Equipment', 'Porter', 'Emergency evacuation cover']

type PackageForm = { id: string; name: string; pricePerPerson: string; inclusions: string[] }

function emptyPackage(name = ''): PackageForm {
  return { id: newDeparturePackageId(), name, pricePerPerson: '', inclusions: [] }
}

function packagesToForm(packages: DeparturePackage[] | undefined): PackageForm[] {
  if (!packages || packages.length === 0) return [emptyPackage('Standard')]
  return packages.map(p => ({ id: p.id, name: p.name, pricePerPerson: String(p.pricePerPerson || ''), inclusions: p.inclusions ?? [] }))
}

function formToPackages(packages: PackageForm[]): DeparturePackage[] {
  return packages
    .filter(p => p.name.trim() && +p.pricePerPerson > 0)
    .map(p => ({ id: p.id, name: p.name.trim(), pricePerPerson: +p.pricePerPerson, inclusions: p.inclusions }))
}

function cheapest(packages: DeparturePackage[]): number {
  return packages.length > 0 ? Math.min(...packages.map(p => p.pricePerPerson)) : 0
}

/* ─── Shared rate/inclusions editor (used by both Add and Configure) ───────── */

function InclusionChips({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
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

function PackagesEditor({ packages, onChange }: { packages: PackageForm[]; onChange: (next: PackageForm[]) => void }) {
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
              placeholder={i === 0 ? 'Rate name (e.g. Self-Sufficient)' : 'Rate name (e.g. Portered)'}
              className={`${inp} font-medium`}
            />
            {packages.length > 1 && (
              <button type="button" onClick={() => remove(pkg.id)} className="text-red-400 hover:text-red-600 shrink-0">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="w-44">
            <label className="font-sans text-xs text-black/40 block mb-1">Price per person (ZAR)</label>
            <input type="number" value={pkg.pricePerPerson} onChange={e => update(pkg.id, { pricePerPerson: e.target.value })} placeholder="0" min="0" className={inp} />
          </div>
          <div>
            <label className="font-sans text-xs text-black/40 block mb-1">Extra inclusions for this rate</label>
            <InclusionChips value={pkg.inclusions} onChange={next => update(pkg.id, { inclusions: next })} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...packages, emptyPackage()])} className="flex items-center gap-1.5 font-sans text-xs text-[#C9A96E] hover:text-[#b8965d]">
        <Plus size={13} /> Add another rate package
      </button>
    </div>
  )
}

function RatesFieldset({
  inclusions, onChangeInclusions, packages, onChangePackages,
}: {
  inclusions: string[]; onChangeInclusions: (next: string[]) => void
  packages: PackageForm[]; onChangePackages: (next: PackageForm[]) => void
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="font-sans text-sm font-medium text-black/70">Baseline Inclusions <span className="font-normal text-black/30">(covered by every rate below)</span></label>
        <InclusionChips value={inclusions} onChange={onChangeInclusions} />
      </div>
      <div className="space-y-1.5">
        <label className="font-sans text-sm font-medium text-black/70">Rate Packages <span className="font-normal text-black/30">(different prices for the same departure)</span></label>
        <PackagesEditor packages={packages} onChange={onChangePackages} />
      </div>
    </div>
  )
}

/* ─── Configure modal for an existing departure ─────────────────────────────── */

function ConfigureModal({ dep, onClose, onSaved }: { dep: Departure; onClose: () => void; onSaved: (patch: Partial<Departure>) => void }) {
  const [inclusions, setInclusions] = useState<string[]>(dep.inclusions ?? [])
  const [packages, setPackages] = useState<PackageForm[]>(packagesToForm(dep.packages))
  const [saving, setSaving] = useState(false)

  async function save() {
    const parsed = formToPackages(packages)
    if (parsed.length === 0) return
    setSaving(true)
    const patch = { inclusions, packages: parsed, pricePerPerson: cheapest(parsed) }
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

        <RatesFieldset inclusions={inclusions} onChangeInclusions={setInclusions} packages={packages} onChangePackages={setPackages} />

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

/* ─── Page ───────────────────────────────────────────────────────────────────── */

function DeparturesInner() {
  const searchParams = useSearchParams()
  const tourFilter = searchParams.get('tour')

  const [tours, setTours] = useState<Tour[]>([])
  const [guides, setGuides] = useState<Guide[]>([])
  const [rows, setRows] = useState<Departure[]>([])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [configuring, setConfiguring] = useState<Departure | null>(null)
  const [form, setForm] = useState({
    tourId: '', date: '', guide: '', maxSeats: '10',
    inclusions: [] as string[],
    packages: [emptyPackage('Standard')] as PackageForm[],
  })

  useEffect(() => {
    getTours().then(all => {
      const active = all.filter(t => t.status === 'active')
      setTours(active)
      if (tourFilter) {
        const t = active.find(x => x.id === tourFilter)
        if (t) setForm(f => ({ ...f, tourId: t.id }))
      }
    })
    getDepartures().then(setRows)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) setGuides(await getSupplierEntities<Guide>('guides', user.id))
    })
  }, [tourFilter])

  const activeTour = tourFilter ? tours.find(t => t.id === tourFilter) : null
  const filtered = activeTour ? rows.filter(r => r.tourId === activeTour.id) : rows

  function selectTour(tourId: string) {
    const tour = tours.find(t => t.id === tourId)
    setForm(f => ({
      ...f,
      tourId,
      inclusions: f.inclusions.length === 0 ? (tour?.included ?? []) : f.inclusions,
      packages: f.packages.length === 1 && !f.packages[0].pricePerPerson
        ? [{ ...f.packages[0], name: f.packages[0].name || 'Standard', pricePerPerson: tour ? String(tour.pricePerPerson || '') : f.packages[0].pricePerPerson }]
        : f.packages,
    }))
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
        packages,
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
    const packages = r.packages && r.packages.length > 0 ? r.packages : null
    if (!packages) return `R ${r.pricePerPerson.toLocaleString()}`
    if (packages.length === 1) return `R ${packages[0].pricePerPerson.toLocaleString()} · ${packages[0].name}`
    const prices = packages.map(p => p.pricePerPerson)
    return `R ${Math.min(...prices).toLocaleString()}–${Math.max(...prices).toLocaleString()} · ${packages.length} rates`
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
          onClose={() => setConfiguring(null)}
          onSaved={patch => setRows(rs => rs.map(x => (x.id === configuring.id ? { ...x, ...patch } : x)))}
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

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
const chip = (active: boolean) => `font-sans text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${active ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`

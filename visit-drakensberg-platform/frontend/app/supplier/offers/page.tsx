'use client'
import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { BadgePercent, Plus, Trash2, Pause, Play } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { getPropertiesBySupplier } from '@/lib/properties'
import { getActivitiesBySupplier } from '@/lib/activities'
import { getSupplierCommissionRate } from '@/lib/commercial-agreements'
import {
  getSupplierEntities, addSupplierEntity, updateSupplierEntity, deleteSupplierEntity,
} from '@/lib/supplier-entities'
import { formatMoney, formatRate } from '@/lib/allocation'
import { todayISO } from '@/lib/upcoming'
import {
  offerState, validateOffer, offerCommissionPreview, OFFER_STATE_LABEL,
  type Offer, type OfferState, type OfferType,
} from '@/lib/offers'
import CommissionReminder from '@/components/supplier/CommissionReminder'

const ENTITY = 'offers'

const STATE_STYLES: Record<OfferState, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  live:      'bg-emerald-100 text-emerald-700',
  paused:    'bg-slate-100 text-slate-600',
  ended:     'bg-black/5 text-black/40',
}

const EMPTY_FORM = {
  title: '', description: '', type: 'percent' as OfferType, value: '',
  listing: '', startsOn: '', endsOn: '', examplePrice: '1000', commissionAcknowledged: false,
}

function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function OffersPage() {
  const [rows, setRows] = useState<Offer[]>([])
  const [listings, setListings] = useState<string[]>([])
  const [rate, setRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const today = todayISO()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const supplierId = effectiveSupplierId(user.id)
      const [mine, props, acts, commission] = await Promise.all([
        getSupplierEntities<Offer>(ENTITY, supplierId),
        getPropertiesBySupplier(supplierId),
        getActivitiesBySupplier(supplierId),
        getSupplierCommissionRate(supplierId),
      ])
      setRows(mine)
      setListings([...props.map(p => p.name), ...acts.map(a => a.name)])
      setRate(commission)
      setLoading(false)
    })
  }, [])

  const rateLabel = rate == null ? 'your commission rate' : formatRate(rate)

  // Live, then scheduled (soonest first), then paused, then ended.
  const sorted = useMemo(() => {
    const order: Record<OfferState, number> = { live: 0, scheduled: 1, paused: 2, ended: 3 }
    return [...rows].sort((a, b) =>
      order[offerState(a, today)] - order[offerState(b, today)] || a.startsOn.localeCompare(b.startsOn))
  }, [rows, today])

  const preview = useMemo(() => {
    const price = Number(form.examplePrice)
    if (!(price > 0) || !(Number(form.value) > 0) || rate == null) return null
    return { price, ...offerCommissionPreview({ type: form.type, value: Number(form.value) }, price, rate) }
  }, [form.examplePrice, form.value, form.type, rate])

  async function add() {
    const fields = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      value: Number(form.value),
      listing: form.listing,
      startsOn: form.startsOn,
      endsOn: form.endsOn,
    }
    const problem = validateOffer({ ...fields, commissionAcknowledged: form.commissionAcknowledged }, today)
    if (problem) { toast.error(problem); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('no session')
      const saved = await addSupplierEntity<Offer>(ENTITY, {
        ...fields,
        supplierId: effectiveSupplierId(user.id),
        status: 'active',
        commissionAcknowledged: true,
        commissionAcknowledgedAt: new Date().toISOString(),
        commissionRateAtCreation: rate ?? 0,
      } as Omit<Offer, 'id' | 'createdAt'>)
      setRows(r => [...r, saved])
      setForm(EMPTY_FORM)
      setAdding(false)
      toast.success(
        saved.startsOn > today
          ? `Offer scheduled for ${fmtDate(saved.startsOn)}. Commission (${rateLabel}) still applies.`
          : `Offer is live. Commission (${rateLabel}) still applies.`,
      )
    } catch {
      toast.error('Could not create the offer. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePause(o: Offer) {
    const status: Offer['status'] = o.status === 'paused' ? 'active' : 'paused'
    const prev = rows
    setRows(rs => rs.map(x => (x.id === o.id ? { ...x, status } : x)))
    try {
      await updateSupplierEntity<Offer>(ENTITY, o.id, { status })
      if (status === 'active') toast.success(`Offer resumed. Commission (${rateLabel}) still applies.`)
    } catch {
      setRows(prev)
      toast.error('Could not update the offer. Please try again.')
    }
  }

  async function remove(id: string) {
    const prev = rows
    setRows(rs => rs.filter(x => x.id !== id))
    try {
      await deleteSupplierEntity(ENTITY, id)
    } catch {
      setRows(prev)
      toast.error('Could not delete the offer. Please try again.')
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BadgePercent size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Offers</h1>
        </div>
        <button onClick={() => setAdding(v => !v)} className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Plus size={15} /> Schedule Offer
        </button>
      </div>

      <p className="font-sans text-sm text-black/50 -mt-3">
        Set up a reduced price in advance. It goes live on its start date and ends automatically after its last day.
      </p>

      <CommissionReminder rateLabel={rateLabel} />

      {adding && (
        <div className="bg-white rounded-xl border border-black/8 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Offer name</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Winter midweek special" className={inp} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Description (optional)</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Stay Sunday to Thursday and save." className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as OfferType }))} className={inp}>
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Amount (ZAR)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Value</label>
              <input type="number" min="0" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder={form.type === 'percent' ? '15' : '200'} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Starts on</label>
              <input type="date" min={today} value={form.startsOn} onChange={e => setForm(f => ({ ...f, startsOn: e.target.value }))} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Ends on (last day)</label>
              <input type="date" min={form.startsOn || today} value={form.endsOn} onChange={e => setForm(f => ({ ...f, endsOn: e.target.value }))} className={inp} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Apply to Listing (optional)</label>
              <select value={form.listing} onChange={e => setForm(f => ({ ...f, listing: e.target.value }))} className={inp}>
                <option value="">All listings</option>
                {listings.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* What a booking at the offer price pays out — commission included. */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-sans text-sm font-semibold text-amber-900">Commission on this offer</p>
              <span className="font-sans text-xs text-amber-800">Example booking price</span>
              <input type="number" min="0" value={form.examplePrice} onChange={e => setForm(f => ({ ...f, examplePrice: e.target.value }))} className="w-28 font-sans text-sm border border-amber-200 rounded-lg px-2 py-1 bg-white outline-none focus:border-[#C9A96E]/50" aria-label="Example booking price" />
            </div>
            {preview ? (
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-sans text-sm">
                <div><dt className="text-xs text-amber-800/70">Normal price</dt><dd className="text-black/80">{formatMoney(preview.price)}</dd></div>
                <div><dt className="text-xs text-amber-800/70">Guest pays with offer</dt><dd className="text-black/80">{formatMoney(preview.netAmount)}</dd></div>
                <div><dt className="text-xs text-amber-800/70">Commission ({rateLabel})</dt><dd className="text-black/80">−{formatMoney(preview.commissionAmount)}</dd></div>
                <div><dt className="text-xs text-amber-800/70">You receive</dt><dd className="font-semibold text-black/90">{formatMoney(preview.supplierShare)}</dd></div>
              </dl>
            ) : (
              <p className="font-sans text-xs text-amber-800">Enter the offer value to see what a booking pays out after commission.</p>
            )}
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.commissionAcknowledged} onChange={e => setForm(f => ({ ...f, commissionAcknowledged: e.target.checked }))} className="mt-0.5 accent-[#C9A96E]" />
              <span className="font-sans text-sm text-amber-900">
                I understand Visit Drakensberg&apos;s commission ({rateLabel}) is still charged on every booking made with this offer.
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <button onClick={add} disabled={saving || !form.commissionAcknowledged} className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg disabled:opacity-60">
              {saving ? 'Saving…' : 'Schedule Offer'}
            </button>
            <button onClick={() => { setAdding(false); setForm(EMPTY_FORM) }} className="font-sans text-sm px-4 py-2 border border-black/10 rounded-lg text-black/50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-black/6">{['Offer', 'Discount', 'Listing', 'Runs', 'Status', 'Commission', ''].map((h, i) => <th key={i} className="px-4 py-3 text-left font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-10 text-center font-sans text-sm text-black/30">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center font-sans text-sm text-black/30">No offers yet. Schedule one to run a deal on set dates.</td></tr>}
            {sorted.map((r, i) => {
              const state = offerState(r, today)
              return (
                <tr key={r.id} className={i < sorted.length - 1 ? 'border-b border-black/5' : ''}>
                  <td className="px-4 py-3 font-sans text-sm text-black/80 max-w-[220px]">
                    <p className="font-medium truncate">{r.title}</p>
                    {r.description && <p className="text-xs text-black/40 truncate">{r.description}</p>}
                  </td>
                  <td className="px-4 py-3 font-sans text-sm text-black/80">{r.type === 'percent' ? `${r.value}%` : formatMoney(r.value)} off</td>
                  <td className="px-4 py-3 font-sans text-sm text-black/60 max-w-[160px] truncate">{r.listing || 'All listings'}</td>
                  <td className="px-4 py-3 font-sans text-sm text-black/60 whitespace-nowrap">{fmtDate(r.startsOn)} – {fmtDate(r.endsOn)}</td>
                  <td className="px-4 py-3"><span className={`font-sans text-xs px-2 py-0.5 rounded-full ${STATE_STYLES[state]}`}>{OFFER_STATE_LABEL[state]}</span></td>
                  <td className="px-4 py-3 font-sans text-xs text-amber-800 whitespace-nowrap">{rateLabel} still applies</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {state !== 'ended' && (
                        <button onClick={() => togglePause(r)} aria-label={`${r.status === 'paused' ? 'Resume' : 'Pause'} ${r.title}`} className="text-black/40 hover:text-black/70">
                          {r.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
                        </button>
                      )}
                      <button onClick={() => remove(r.id)} aria-label={`Delete ${r.title}`} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

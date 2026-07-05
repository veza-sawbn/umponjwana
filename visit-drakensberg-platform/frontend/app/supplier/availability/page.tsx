'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Clock, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { getPropertiesBySupplier } from '@/lib/properties'
import { getActivitiesBySupplier } from '@/lib/activities'
import { getTours } from '@/lib/tours'
import {
  getSupplierEntities, addSupplierEntity, deleteSupplierEntity, type SupplierEntity,
} from '@/lib/supplier-entities'

type Block = SupplierEntity & { listingId: string; listing: string; from: string; to: string; reason: string }

const ENTITY = 'availability_blocks'

export default function AvailabilityPage() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [listings, setListings] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ listingId: '', from: '', to: '', reason: '' })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const [myBlocks, props, acts, tours] = await Promise.all([
        getSupplierEntities<Block>(ENTITY, user.id),
        getPropertiesBySupplier(user.id),
        getActivitiesBySupplier(user.id),
        getTours(),
      ])
      setBlocks(myBlocks.sort((a, b) => a.from.localeCompare(b.from)))
      setListings([
        ...props.map(p => ({ id: p.id, name: p.name })),
        ...acts.map(a => ({ id: a.id, name: a.name })),
        ...tours.filter(t => t.supplierId === user.id).map(t => ({ id: t.id, name: t.name })),
      ])
      setLoading(false)
    })
  }, [])

  async function add() {
    if (!form.listingId || !form.from || !form.to) return
    if (form.to < form.from) {
      toast.error('The end date must be after the start date.')
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('no session')
      const listing = listings.find(l => l.id === form.listingId)
      const saved = await addSupplierEntity<Block>(ENTITY, {
        supplierId: user.id,
        listingId: form.listingId,
        listing: listing?.name ?? form.listingId,
        from: form.from,
        to: form.to,
        reason: form.reason,
        status: 'active',
      } as Omit<Block, 'id' | 'createdAt'>)
      setBlocks(b => [...b, saved].sort((x, y) => x.from.localeCompare(y.from)))
      setForm({ listingId: '', from: '', to: '', reason: '' })
      setAdding(false)
      toast.success('Dates blocked.')
    } catch {
      toast.error('Could not save the block. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    const prev = blocks
    setBlocks(bs => bs.filter(x => x.id !== id))
    try {
      await deleteSupplierEntity(ENTITY, id)
      toast.success('Block removed.')
    } catch {
      setBlocks(prev)
      toast.error('Could not remove the block. Please try again.')
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Availability</h1>
        </div>
        <button onClick={() => setAdding(v => !v)} className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Plus size={15} /> Block Dates
        </button>
      </div>

      {adding && (
        <div className="bg-white rounded-xl border border-black/8 p-6 space-y-4">
          <p className="font-sans font-semibold text-black/80">Block a Date Range</p>
          {listings.length === 0 && !loading && (
            <p className="font-sans text-sm text-black/40">You have no listings yet — create a listing first, then block dates on it.</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Listing</label>
              <select value={form.listingId} onChange={e => setForm(f => ({ ...f, listingId: e.target.value }))} className={inp}>
                <option value="">Select listing…</option>
                {listings.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">From</label>
              <input type="date" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">To</label>
              <input type="date" value={form.to} min={form.from || undefined} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Reason</label>
              <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Maintenance, owner stay, renovation…" className={inp} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={add} disabled={saving} className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg disabled:opacity-60">
              {saving ? 'Saving…' : 'Block Dates'}
            </button>
            <button onClick={() => setAdding(false)} className="font-sans text-sm px-4 py-2 border border-black/10 rounded-lg text-black/50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-black/6">{['Listing', 'From', 'To', 'Reason', ''].map((h, i) => <th key={i} className="px-4 py-3 text-left font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-10 text-center font-sans text-sm text-black/30">Loading…</td></tr>}
            {!loading && blocks.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center font-sans text-sm text-black/30">No blocked dates — your listings are bookable on all dates.</td></tr>}
            {blocks.map((b, i) => (
              <tr key={b.id} className={i < blocks.length - 1 ? 'border-b border-black/5' : ''}>
                <td className="px-4 py-3 font-sans text-sm text-black/80 max-w-[180px] truncate">{b.listing}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{b.from}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{b.to}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{b.reason || '—'}</td>
                <td className="px-4 py-3"><button onClick={() => remove(b.id)} aria-label={`Remove block on ${b.listing}`} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

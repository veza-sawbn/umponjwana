'use client'
import { useState } from 'react'
import { Clock, Plus, Trash2 } from 'lucide-react'

interface Block { id: string; listing: string; from: string; to: string; reason: string }

const INIT: Block[] = [
  { id: '1', listing: 'Cathedral Peak Mountain Lodge', from: '2025-09-14', to: '2025-09-21', reason: 'Maintenance' },
  { id: '2', listing: 'Berg Valley Guesthouse',        from: '2025-12-20', to: '2026-01-05', reason: 'Owner stay' },
]

export default function AvailabilityPage() {
  const [blocks, setBlocks] = useState<Block[]>(INIT)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ listing: '', from: '', to: '', reason: '' })

  function add() {
    if (!form.listing || !form.from || !form.to) return
    setBlocks(b => [...b, { id: Date.now().toString(), ...form }])
    setForm({ listing: '', from: '', to: '', reason: '' })
    setAdding(false)
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
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Listing</label>
              <select value={form.listing} onChange={e => setForm(f => ({ ...f, listing: e.target.value }))} className={inp}>
                <option value="">Select listing…</option>
                {['Cathedral Peak Mountain Lodge', 'Berg Valley Guesthouse'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">From</label>
              <input type="date" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">To</label>
              <input type="date" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Reason</label>
              <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Maintenance, owner stay, renovation…" className={inp} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={add} className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg">Block Dates</button>
            <button onClick={() => setAdding(false)} className="font-sans text-sm px-4 py-2 border border-black/10 rounded-lg text-black/50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-black/6">{['Listing', 'From', 'To', 'Reason', ''].map(h => <th key={h} className="px-4 py-3 text-left font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody>
            {blocks.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center font-sans text-sm text-black/30">No blocked dates</td></tr>}
            {blocks.map((b, i) => (
              <tr key={b.id} className={i < blocks.length - 1 ? 'border-b border-black/5' : ''}>
                <td className="px-4 py-3 font-sans text-sm text-black/80 max-w-[180px] truncate">{b.listing}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{b.from}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{b.to}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{b.reason || '—'}</td>
                <td className="px-4 py-3"><button onClick={() => setBlocks(bs => bs.filter(x => x.id !== b.id))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

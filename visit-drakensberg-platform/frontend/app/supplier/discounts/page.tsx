'use client'
import { useState } from 'react'
import { Tag, Plus, Trash2 } from 'lucide-react'

interface Discount { id: string; code: string; type: 'percent' | 'flat'; value: number; listing: string; validUntil: string; uses: number }

const INIT: Discount[] = [
  { id: 'd1', code: 'BERG15',    type: 'percent', value: 15,  listing: 'Cathedral Peak Mountain Lodge', validUntil: '2025-09-30', uses: 12 },
  { id: 'd2', code: 'WINTER200', type: 'flat',    value: 200, listing: 'Berg Valley Guesthouse',        validUntil: '2025-08-31', uses: 5  },
]

export default function DiscountsPage() {
  const [rows, setRows] = useState(INIT)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ code: '', type: 'percent' as 'percent' | 'flat', value: '', listing: '', validUntil: '' })

  function add() {
    if (!form.code || !form.value) return
    setRows(r => [...r, { id: Date.now().toString(), code: form.code.toUpperCase(), type: form.type, value: +form.value, listing: form.listing, validUntil: form.validUntil, uses: 0 }])
    setForm({ code: '', type: 'percent', value: '', listing: '', validUntil: '' })
    setAdding(false)
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tag size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Discounts</h1>
        </div>
        <button onClick={() => setAdding(v => !v)} className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Plus size={15} /> Create Discount
        </button>
      </div>

      {adding && (
        <div className="bg-white rounded-xl border border-black/8 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Code</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="SUMMER20" className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'percent' | 'flat' }))} className={inp}>
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Amount (ZAR)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Value</label>
              <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder={form.type === 'percent' ? '20' : '200'} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Valid Until</label>
              <input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Apply to Listing (optional)</label>
              <select value={form.listing} onChange={e => setForm(f => ({ ...f, listing: e.target.value }))} className={inp}>
                <option value="">All listings</option>
                {['Cathedral Peak Mountain Lodge', 'Berg Valley Guesthouse'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={add} className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg">Create</button>
            <button onClick={() => setAdding(false)} className="font-sans text-sm px-4 py-2 border border-black/10 rounded-lg text-black/50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-black/6">{['Code', 'Discount', 'Listing', 'Valid Until', 'Uses', ''].map(h => <th key={h} className="px-4 py-3 text-left font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={i < rows.length - 1 ? 'border-b border-black/5' : ''}>
                <td className="px-4 py-3 font-mono text-sm font-semibold text-black/80">{r.code}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/80">{r.type === 'percent' ? `${r.value}%` : `R ${r.value}`} off</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60 max-w-[160px] truncate">{r.listing || 'All listings'}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{r.validUntil}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{r.uses}</td>
                <td className="px-4 py-3"><button onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

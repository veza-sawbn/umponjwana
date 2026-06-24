'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Plus, Users, Trash2, ChevronLeft, X } from 'lucide-react'

interface Departure { id: string; tour: string; tourId: string; date: string; guide: string; maxSeats: number; bookedSeats: number; status: string }

const TOURS = [
  { id: '1', name: 'Cathedral Peak Summit Hike' },
  { id: '2', name: 'Amphitheatre Circular Trail' },
  { id: '3', name: 'Giants Castle Cultural Tour' },
]

const INIT: Departure[] = [
  { id: '1', tourId: '1', tour: 'Cathedral Peak Summit Hike',  date: '2025-07-12', guide: 'Bongani Ndlovu',   maxSeats: 10, bookedSeats: 7, status: 'confirmed' },
  { id: '2', tourId: '2', tour: 'Amphitheatre Circular Trail',  date: '2025-07-19', guide: 'Zanele Mthembu',   maxSeats: 12, bookedSeats: 4, status: 'open' },
  { id: '3', tourId: '3', tour: 'Giants Castle Cultural Tour',  date: '2025-08-02', guide: 'Marné du Plessis', maxSeats: 8,  bookedSeats: 8, status: 'full' },
]

const STATUS: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  open:      'bg-blue-100 text-blue-700',
  full:      'bg-slate-100 text-slate-600',
}

export default function DeparturesPage() {
  const searchParams = useSearchParams()
  const tourFilter = searchParams.get('tour')

  const [rows, setRows] = useState(INIT)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ tour: '', tourId: '', date: '', guide: '', maxSeats: '10' })

  // Pre-select tour when coming from tours page
  useEffect(() => {
    if (tourFilter) {
      const t = TOURS.find(x => x.id === tourFilter)
      if (t) setForm(f => ({ ...f, tourId: t.id, tour: t.name }))
    }
  }, [tourFilter])

  const activeTour = tourFilter ? TOURS.find(t => t.id === tourFilter) : null
  const filtered = activeTour ? rows.filter(r => r.tourId === activeTour.id) : rows

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
        <div className="bg-white rounded-xl border border-black/8 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Tour</label>
              <select
                value={form.tourId}
                onChange={e => {
                  const t = TOURS.find(x => x.id === e.target.value)
                  setForm(f => ({ ...f, tourId: e.target.value, tour: t?.name ?? '' }))
                }}
                className={inp}
              >
                <option value="">Select tour…</option>
                {TOURS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                {['Bongani Ndlovu', 'Marné du Plessis', 'Zanele Mthembu'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-sans text-sm font-medium text-black/70">Max Seats</label>
              <input type="number" value={form.maxSeats} onChange={e => setForm(f => ({ ...f, maxSeats: e.target.value }))} min="1" className={inp} />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (form.tour && form.date) {
                  setRows(r => [...r, { id: Date.now().toString(), tourId: form.tourId, tour: form.tour, date: form.date, guide: form.guide, maxSeats: +form.maxSeats, bookedSeats: 0, status: 'open' }])
                  setAdding(false)
                }
              }}
              className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg"
            >
              Add Departure
            </button>
            <button onClick={() => setAdding(false)} className="font-sans text-sm px-4 py-2 border border-black/10 rounded-lg text-black/50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/6">
              {['Tour', 'Date', 'Guide', 'Seats', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center font-sans text-sm text-black/30">No departures scheduled</td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.id} className={i < filtered.length - 1 ? 'border-b border-black/5' : ''}>
                <td className="px-4 py-3 font-sans text-sm text-black/80">{r.tour}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{r.date}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{r.guide || '—'}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">
                  <span className="flex items-center gap-1"><Users size={12} /> {r.bookedSeats}/{r.maxSeats}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-sans text-xs px-2 py-0.5 rounded-full capitalize ${STATUS[r.status]}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

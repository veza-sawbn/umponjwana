'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Plus, Users, Trash2, ChevronLeft, X } from 'lucide-react'
import { getTours, type Tour } from '@/lib/tours'
import { getDepartures, addDeparture, deleteDeparture, type Departure } from '@/lib/departures'

const STATUS: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  open:      'bg-blue-100 text-blue-700',
  full:      'bg-slate-100 text-slate-600',
}

function DeparturesInner() {
  const searchParams = useSearchParams()
  const tourFilter = searchParams.get('tour')

  const [tours, setTours] = useState<Tour[]>([])
  const [rows, setRows] = useState<Departure[]>([])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ tourId: '', date: '', guide: '', maxSeats: '10' })

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
  }, [tourFilter])

  const activeTour = tourFilter ? tours.find(t => t.id === tourFilter) : null
  const filtered = activeTour ? rows.filter(r => r.tourId === activeTour.id) : rows

  async function handleAdd() {
    if (!form.tourId || !form.date) return
    const tour = tours.find(t => t.id === form.tourId)
    if (!tour) return
    setSaving(true)
    try {
      const dep = await addDeparture({
        tourId: tour.id,
        trailId: tour.trailId,
        tour: tour.name,
        supplierName: tour.supplierName || tour.name,
        tourDays: tour.days,
        date: form.date,
        guide: form.guide,
        maxSeats: +form.maxSeats,
        bookedSeats: 0,
        status: 'open',
        pricePerPerson: tour.pricePerPerson,
      })
      setRows(r => [...r, dep])
      setAdding(false)
      setForm({ tourId: tourFilter ? form.tourId : '', date: '', guide: '', maxSeats: '10' })
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
                onChange={e => setForm(f => ({ ...f, tourId: e.target.value }))}
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
                  <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600">
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

export default function DeparturesPage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" /></div>}>
      <DeparturesInner />
    </Suspense>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

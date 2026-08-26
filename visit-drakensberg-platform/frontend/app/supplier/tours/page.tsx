'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Map, Plus, Clock, Users, Mountain, Trash2 } from 'lucide-react'
import { getMyTours, deleteTour, type Tour } from '@/lib/tours'
import { formatMoney } from '@/lib/allocation'

const DIFF_STYLE: Record<string, string> = {
  Easy: 'bg-emerald-100 text-emerald-700',
  Moderate: 'bg-blue-100 text-blue-700',
  Challenging: 'bg-amber-100 text-amber-700',
  Extreme: 'bg-red-100 text-red-700',
}

export default function ToursPage() {
  const [tours, setTours] = useState<Tour[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Scoped to this supplier only — getTours() is the public catalog read.
    getMyTours().then(t => { setTours(t); setLoading(false) })
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Remove this tour?')) return
    await deleteTour(id)
    setTours(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Map size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Tours</h1>
        </div>
        <Link href="/supplier/tours/new" className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Plus size={15} /> Add Tour
        </Link>
      </div>

      {loading ? (
        <div className="py-10 text-center font-sans text-sm text-black/30">Loading…</div>
      ) : tours.length === 0 ? (
        <div className="bg-white rounded-xl border border-black/8 py-16 text-center">
          <Mountain size={28} className="text-black/15 mx-auto mb-3" />
          <p className="font-sans text-sm text-black/30">No tours yet — add your first tour to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tours.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-black/8 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
                <Mountain size={18} className="text-[#C9A96E]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans font-semibold text-black/90 truncate">{t.name}</p>
                {t.trailName && (
                  <p className="font-sans text-xs text-[#C9A96E] mt-0.5 truncate">↳ {t.trailName}</p>
                )}
                <div className="flex items-center gap-4 mt-1">
                  <span className={`font-sans text-[10px] px-1.5 py-0.5 rounded capitalize ${DIFF_STYLE[t.difficulty] ?? 'bg-slate-100 text-slate-500'}`}>{t.difficulty}</span>
                  <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Clock size={11} /> {t.days} day{t.days > 1 ? 's' : ''}</span>
                  <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Users size={11} /> max {t.maxGroup}</span>
                  {t.pricePerPerson > 0 && <span className="font-sans text-xs text-black/40">{formatMoney(t.pricePerPerson)} pp</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`font-sans text-xs px-2 py-0.5 rounded-full capitalize ${t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{t.status}</span>
                <Link href={`/supplier/tours/${t.id}/edit`} className="font-sans text-xs text-[#C9A96E] hover:underline">Edit</Link>
                <Link href={`/supplier/departures?tour=${t.id}`} className="font-sans text-xs text-black/40 hover:text-black/70">Departures</Link>
                <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

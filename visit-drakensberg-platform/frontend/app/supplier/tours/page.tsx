'use client'
import Link from 'next/link'
import { Map, Plus, Clock, Users, Star, Mountain } from 'lucide-react'

const MOCK = [
  { id: '1', name: 'Cathedral Peak Summit Hike',    days: 2, maxGroup: 10, rating: 4.9, difficulty: 'Challenging', status: 'active' },
  { id: '2', name: 'Amphitheatre Circular Trail',   days: 1, maxGroup: 12, rating: 4.7, difficulty: 'Moderate',    status: 'active' },
  { id: '3', name: 'Giants Castle Cultural Tour',   days: 3, maxGroup: 8,  rating: 4.8, difficulty: 'Easy',        status: 'active' },
]

export default function ToursPage() {
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

      <div className="grid gap-3">
        {MOCK.map(t => (
          <div key={t.id} className="bg-white rounded-xl border border-black/8 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
              <Mountain size={18} className="text-[#C9A96E]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-sans font-semibold text-black/90">{t.name}</p>
              <div className="flex items-center gap-4 mt-1">
                <span className="font-sans text-xs text-black/40">{t.difficulty}</span>
                <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Clock size={11} /> {t.days} day{t.days > 1 ? 's' : ''}</span>
                <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Users size={11} /> max {t.maxGroup}</span>
                <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Star size={11} /> {t.rating}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`font-sans text-xs px-2 py-0.5 rounded-full capitalize ${t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{t.status}</span>
              <Link href={`/supplier/tours/${t.id}/edit`} className="font-sans text-xs text-[#C9A96E] hover:underline">Edit</Link>
              <Link href={`/supplier/departures?tour=${t.id}`} className="font-sans text-xs text-black/40 hover:text-black/70">Departures</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'
import Link from 'next/link'
import { Map, Plus, Clock, ArrowRight } from 'lucide-react'

const MOCK = [
  { id: '1', from: 'King Shaka International Airport', to: 'Central Berg',          duration: '2h 30m', price: 950,  status: 'active' },
  { id: '2', from: 'Durban CBD',                       to: 'Drakensberg Sun',       duration: '2h 15m', price: 850,  status: 'active' },
  { id: '3', from: 'Central Berg',                     to: 'Monk\'s Cowl Trailhead', duration: '45m',    price: 350,  status: 'active' },
  { id: '4', from: 'Himeville',                        to: 'Sani Pass (Top)',        duration: '1h 30m', price: 600,  status: 'active' },
]

export default function RoutesPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Map size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Routes</h1>
        </div>
        <Link href="/supplier/routes/new" className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Plus size={15} /> Add Route
        </Link>
      </div>

      <div className="grid gap-3">
        {MOCK.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-black/8 p-5 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 font-sans text-sm font-semibold text-black/90">
                <span className="truncate">{r.from}</span>
                <ArrowRight size={14} className="shrink-0 text-[#C9A96E]" />
                <span className="truncate">{r.to}</span>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Clock size={11} /> {r.duration}</span>
                <span className="font-sans text-xs text-black/40">R {r.price}/person</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-sans text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 capitalize">{r.status}</span>
              <Link href={`/supplier/routes/${r.id}/edit`} className="font-sans text-xs text-[#C9A96E] hover:underline">Edit</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

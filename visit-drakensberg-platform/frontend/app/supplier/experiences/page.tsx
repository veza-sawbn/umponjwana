'use client'
import Link from 'next/link'
import { Sparkles, Plus, Clock, Users, Star } from 'lucide-react'

const MOCK = [
  { id: '1', name: 'Drakensberg Stargazing Night',        category: 'Nature',      duration: '3h', maxGroup: 20, rating: 5.0, status: 'active' },
  { id: '2', name: 'Mountain Photography Workshop',       category: 'Creative',    duration: '6h', maxGroup: 8,  rating: 4.8, status: 'active' },
  { id: '3', name: 'Sound Healing & Sunrise Meditation',  category: 'Wellness',    duration: '2h', maxGroup: 15, rating: 4.9, status: 'active' },
  { id: '4', name: 'San Rock Art Heritage Walk',          category: 'Cultural',    duration: '4h', maxGroup: 12, rating: 4.7, status: 'draft' },
]

export default function ExperiencesPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Experiences</h1>
        </div>
        <Link href="/supplier/experiences/new" className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Plus size={15} /> Add Experience
        </Link>
      </div>

      <div className="grid gap-3">
        {MOCK.map(e => (
          <div key={e.id} className="bg-white rounded-xl border border-black/8 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-[#C9A96E]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-sans font-semibold text-black/90">{e.name}</p>
              <div className="flex items-center gap-4 mt-1">
                <span className="font-sans text-xs text-black/40">{e.category}</span>
                <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Clock size={11} /> {e.duration}</span>
                <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Users size={11} /> max {e.maxGroup}</span>
                <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Star size={11} /> {e.rating}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`font-sans text-xs px-2 py-0.5 rounded-full capitalize ${e.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{e.status}</span>
              <Link href={`/supplier/experiences/${e.id}/edit`} className="font-sans text-xs text-[#C9A96E] hover:underline">Edit</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

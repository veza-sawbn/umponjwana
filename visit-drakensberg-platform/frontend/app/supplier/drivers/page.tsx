'use client'
import Link from 'next/link'
import { Users, Plus, Car } from 'lucide-react'

const MOCK = [
  { id: '1', name: 'Sipho Dlamini',   license: 'PDP',  languages: 'Zulu, English', trips: 142, status: 'active' },
  { id: '2', name: 'Johan van Wyk',   license: 'PDP',  languages: 'Afrikaans, English', trips: 98, status: 'active' },
  { id: '3', name: 'Thandi Nkosi',    license: 'Code 10', languages: 'Zulu, English, Sotho', trips: 67, status: 'active' },
]

export default function DriversPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Drivers</h1>
        </div>
        <Link href="/supplier/drivers/new" className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Plus size={15} /> Add Driver
        </Link>
      </div>

      <div className="grid gap-3">
        {MOCK.map(d => (
          <div key={d.id} className="bg-white rounded-xl border border-black/8 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
              <span className="font-sans text-sm font-semibold text-[#C9A96E]">{d.name.split(' ').map(n => n[0]).join('')}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-sans font-semibold text-black/90">{d.name}</p>
              <div className="flex items-center gap-4 mt-1">
                <span className="font-sans text-xs text-black/40">License: {d.license}</span>
                <span className="font-sans text-xs text-black/40">{d.languages}</span>
                <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Car size={11} /> {d.trips} trips</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-sans text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{d.status}</span>
              <Link href={`/supplier/drivers/${d.id}/edit`} className="font-sans text-xs text-[#C9A96E] hover:underline">Edit</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

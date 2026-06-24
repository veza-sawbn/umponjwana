'use client'
import Link from 'next/link'
import { Truck, Plus, Users } from 'lucide-react'

const MOCK = [
  { id: '1', name: 'Toyota Land Cruiser 79',   seats: 7,  reg: 'KZN 123 GP', type: '4×4',     status: 'active' },
  { id: '2', name: 'Mercedes Sprinter',         seats: 16, reg: 'KZN 456 GP', type: 'Minibus',  status: 'active' },
  { id: '3', name: 'Nissan Navara Double Cab',  seats: 5,  reg: 'KZN 789 GP', type: '4×4',     status: 'maintenance' },
]

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  maintenance: 'bg-amber-100 text-amber-700',
  inactive: 'bg-slate-100 text-slate-500',
}

export default function VehiclesPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Vehicles</h1>
        </div>
        <Link href="/supplier/vehicles/new" className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Plus size={15} /> Add Vehicle
        </Link>
      </div>

      <div className="grid gap-3">
        {MOCK.map(v => (
          <div key={v.id} className="bg-white rounded-xl border border-black/8 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
              <Truck size={18} className="text-[#C9A96E]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-sans font-semibold text-black/90">{v.name}</p>
              <div className="flex items-center gap-4 mt-1">
                <span className="font-sans text-xs text-black/40">{v.type}</span>
                <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Users size={11} /> {v.seats} seats</span>
                <span className="font-sans text-xs text-black/40">{v.reg}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`font-sans text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[v.status]}`}>{v.status}</span>
              <Link href={`/supplier/vehicles/${v.id}/edit`} className="font-sans text-xs text-[#C9A96E] hover:underline">Edit</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

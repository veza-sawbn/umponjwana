'use client'
import Link from 'next/link'
import { Building2, Plus, Star, BedDouble, Eye } from 'lucide-react'

const MOCK_PROPERTIES = [
  { id: '1', name: 'Cathedral Peak Mountain Lodge', type: 'Lodge', rooms: 12, rating: 4.8, reviews: 34, status: 'active' },
  { id: '2', name: 'Berg Valley Guesthouse',        type: 'Guesthouse', rooms: 6, rating: 4.5, reviews: 21, status: 'active' },
]

export default function PropertiesPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Properties</h1>
        </div>
        <Link
          href="/supplier/properties/new"
          className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors"
        >
          <Plus size={15} /> Add Property
        </Link>
      </div>

      <div className="grid gap-4">
        {MOCK_PROPERTIES.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-black/8 p-5 flex items-center gap-5">
            <div className="w-14 h-14 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
              <Building2 size={22} className="text-[#C9A96E]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-sans font-semibold text-black/90 truncate">{p.name}</p>
              <div className="flex items-center gap-4 mt-1">
                <span className="font-sans text-xs text-black/40">{p.type}</span>
                <span className="font-sans text-xs text-black/40 flex items-center gap-1"><BedDouble size={12} /> {p.rooms} rooms</span>
                <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Star size={12} /> {p.rating} ({p.reviews})</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-sans text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 capitalize">{p.status}</span>
              <Link href={`/supplier/properties/${p.id}/edit`} className="font-sans text-xs text-[#C9A96E] hover:underline">Edit</Link>
              <Link href={`/supplier/rooms?property=${p.id}`} className="font-sans text-xs text-black/40 hover:text-black/70">Rooms</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

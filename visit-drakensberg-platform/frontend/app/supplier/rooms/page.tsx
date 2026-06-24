'use client'
import Link from 'next/link'
import { BedDouble, Plus, Users } from 'lucide-react'

const MOCK = [
  { id: '1', property: 'Cathedral Peak Mountain Lodge', type: 'Mountain Suite',       beds: 'King',       maxOccupancy: 2, pricePerNight: 2850, count: 4, status: 'active' },
  { id: '2', property: 'Cathedral Peak Mountain Lodge', type: 'Family Chalet',         beds: '2x Queen',   maxOccupancy: 4, pricePerNight: 4200, count: 3, status: 'active' },
  { id: '3', property: 'Cathedral Peak Mountain Lodge', type: 'Backpacker Dorm Bed',   beds: 'Single Bunk', maxOccupancy: 1, pricePerNight: 480,  count: 12, status: 'active' },
  { id: '4', property: 'Berg Valley Guesthouse',        type: 'Garden Room',           beds: 'Queen',      maxOccupancy: 2, pricePerNight: 1450, count: 4, status: 'active' },
  { id: '5', property: 'Berg Valley Guesthouse',        type: 'Honeymoon Cottage',     beds: 'King',       maxOccupancy: 2, pricePerNight: 2100, count: 2, status: 'active' },
]

export default function RoomsPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BedDouble size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Room Types</h1>
        </div>
        <Link href="/supplier/rooms/new" className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Plus size={15} /> Add Room Type
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-black/6">{['Property', 'Room Type', 'Beds', 'Occupancy', 'Price/Night', 'Units', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody>
            {MOCK.map((r, i) => (
              <tr key={r.id} className={i < MOCK.length - 1 ? 'border-b border-black/5' : ''}>
                <td className="px-4 py-3 font-sans text-xs text-black/40 max-w-[140px] truncate">{r.property}</td>
                <td className="px-4 py-3 font-sans text-sm font-medium text-black/80">{r.type}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{r.beds}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60 flex items-center gap-1"><Users size={12} /> {r.maxOccupancy}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/80">R {r.pricePerNight.toLocaleString()}</td>
                <td className="px-4 py-3 font-sans text-sm text-black/60">{r.count}</td>
                <td className="px-4 py-3"><span className="font-sans text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

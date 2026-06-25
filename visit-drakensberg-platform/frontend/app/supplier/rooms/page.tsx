'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { BedDouble, Plus, Users, Pencil } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { getRoomsBySupplier, type Room } from '@/lib/rooms'

function RoomsInner() {
  const searchParams = useSearchParams()
  const propertyFilter = searchParams.get('property')

  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      getRoomsBySupplier(user.id).then(r => {
        setRooms(r)
        setLoading(false)
      })
    })
  }, [])

  const filtered = propertyFilter ? rooms.filter(r => r.propertyId === propertyFilter) : rooms

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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-black/8 p-12 text-center">
          <BedDouble size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-xl text-black/20 mb-2">No room types yet</p>
          <p className="font-sans text-sm text-black/30 mb-5">Add room types for your properties.</p>
          <Link href="/supplier/rooms/new" className="inline-flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
            <Plus size={14} /> Add Room Type
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-black/8 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/6">
                {['Property', 'Room Type', 'Beds', 'Occupancy', 'Price/Night', 'Units', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className={i < filtered.length - 1 ? 'border-b border-black/5' : ''}>
                  <td className="px-4 py-3 font-sans text-xs text-black/40 max-w-[140px] truncate">{r.propertyName}</td>
                  <td className="px-4 py-3 font-sans text-sm font-medium text-black/80">{r.name}</td>
                  <td className="px-4 py-3 font-sans text-sm text-black/60">{r.bedConfig}</td>
                  <td className="px-4 py-3 font-sans text-sm text-black/60">
                    <span className="flex items-center gap-1"><Users size={12} /> {r.maxOccupancy}</span>
                  </td>
                  <td className="px-4 py-3 font-sans text-sm text-black/80">R {r.basePrice.toLocaleString()}</td>
                  <td className="px-4 py-3 font-sans text-sm text-black/60">{r.units}</td>
                  <td className="px-4 py-3">
                    <span className={`font-sans text-xs px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/supplier/rooms/${r.id}/edit`} className="text-[#C9A96E] hover:text-[#b8965d]">
                      <Pencil size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function RoomsPage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" /></div>}>
      <RoomsInner />
    </Suspense>
  )
}

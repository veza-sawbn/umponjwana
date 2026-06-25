'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Building2, Plus, Star, BedDouble } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { getPropertiesBySupplier, type Property } from '@/lib/properties'

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      getPropertiesBySupplier(user.id).then(p => {
        setProperties(p)
        setLoading(false)
      })
    })
  }, [])

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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-xl border border-black/8 p-12 text-center">
          <Building2 size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-xl text-black/20 mb-2">No properties yet</p>
          <p className="font-sans text-sm text-black/30 mb-5">Add your first property to start managing your accommodation.</p>
          <Link href="/supplier/properties/new" className="inline-flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
            <Plus size={14} /> Add Property
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {properties.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-black/8 p-5 flex items-center gap-5">
              <div className="w-14 h-14 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
                <Building2 size={22} className="text-[#C9A96E]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans font-semibold text-black/90 truncate">{p.name}</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="font-sans text-xs text-black/40">{p.type}</span>
                  {p.starRating && (
                    <span className="font-sans text-xs text-black/40 flex items-center gap-1">
                      <Star size={12} /> {p.starRating} Star
                    </span>
                  )}
                  {p.region && (
                    <span className="font-sans text-xs text-black/40">{p.region}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-sans text-xs px-2 py-0.5 rounded-full capitalize ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {p.status}
                </span>
                <Link href={`/supplier/properties/${p.id}/edit`} className="font-sans text-xs text-[#C9A96E] hover:underline">Edit</Link>
                <Link href={`/supplier/rooms?property=${p.id}`} className="font-sans text-xs text-black/40 hover:text-black/70 flex items-center gap-1">
                  <BedDouble size={12} /> Rooms
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

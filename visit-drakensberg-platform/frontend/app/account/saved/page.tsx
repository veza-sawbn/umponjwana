'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Heart, MapPin, Star, X } from 'lucide-react'

type SavedListing = {
  id: string
  title: string
  type: 'accommodation' | 'activity' | 'hike' | 'experience'
  location: string
  rating: number
  price: number | null
  image: string
  href: string
}

const TYPE_LABEL: Record<string, string> = {
  accommodation: 'Stay', activity: 'Activity', hike: 'Hike', experience: 'Experience',
}

// No favourites/saved-listings persistence layer exists yet — this page is
// wired for it (add/remove UI, empty state) but starts empty rather than
// showing fake saved items.
export default function SavedListingsPage() {
  const [saved, setSaved] = useState<SavedListing[]>([])

  function remove(id: string) {
    setSaved(p => p.filter(s => s.id !== id))
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display italic text-3xl text-[#000000]">Saved Listings</h1>
        <p className="font-sans text-sm text-gray-400 mt-1">{saved.length} saved listing{saved.length !== 1 ? 's' : ''}</p>
      </div>

      {saved.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <Heart size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-2xl text-gray-300 mb-2">No saved listings yet</p>
          <p className="font-sans text-sm text-gray-400 mb-5">Save your favourite stays, trails and activities to plan your trip.</p>
          <Link href="/stays" className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">Browse Stays</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {saved.map(item => (
            <div key={item.id} className="bg-white border border-gray-200 overflow-hidden group">
              <div className="relative h-44 overflow-hidden">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <span className="absolute top-3 left-3 bg-white/90 font-sans text-[10px] tracking-[0.12em] uppercase px-2.5 py-1 text-gray-600">
                  {TYPE_LABEL[item.type]}
                </span>
                <button
                  onClick={() => remove(item.id)}
                  className="absolute top-3 right-3 bg-white/90 p-1.5 text-red-400 hover:bg-white transition-colors"
                  title="Remove from saved"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="p-4">
                <p className="font-sans text-xs text-gray-400 flex items-center gap-1 mb-1"><MapPin size={10} />{item.location}</p>
                <h3 className="font-display italic text-xl text-[#000000] mb-2">{item.title}</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Star size={12} className="text-[#C9A96E] fill-[#C9A96E]" />
                    <span className="font-sans text-xs text-gray-600">{item.rating}</span>
                  </div>
                  {item.price && (
                    <p className="font-display italic text-[#2d6a4f]">R {item.price.toLocaleString()}<span className="font-sans text-xs text-gray-400">/night</span></p>
                  )}
                </div>
                <Link href={item.href} className="block mt-3 text-center border border-[#2d6a4f] text-[#2d6a4f] py-2 font-sans text-xs hover:bg-[#2d6a4f] hover:text-white transition-colors">
                  View Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

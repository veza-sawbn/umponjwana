'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, MapPin, Star, X } from 'lucide-react'
import { formatMoney } from '@/lib/allocation'
import { useSavedListings } from '@/lib/saved-listings-context'
import {
  listingHref,
  SAVED_TYPE_LABEL,
  SAVED_TYPE_PRICE_SUFFIX,
  type SavedListing,
  type SavedListingType,
} from '@/lib/saved-listings'
import { isOptimizableImageHost } from '@/lib/image-url'

// Reads the same store the heart button on every public listing writes to
// (lib/saved-listings-context.tsx). Removing here removes everywhere: the
// heart on /stays un-fills the moment this page drops the listing.
export default function SavedListingsPage() {
  const { saved, ready, removeSaved } = useSavedListings()
  const [typeFilter, setTypeFilter] = useState<SavedListingType | ''>('')

  // Only offer filters the visitor actually has saves for — a row of empty
  // categories is noise on a page whose whole job is a short personal list.
  const types = useMemo(() => {
    const order: SavedListingType[] = ['stay', 'hike', 'activity', 'tour', 'package', 'experience']
    const present = new Set(saved.map(s => s.type))
    return order.filter(t => present.has(t))
  }, [saved])

  const visible = typeFilter ? saved.filter(s => s.type === typeFilter) : saved

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display italic text-3xl text-[#000000]">Saved Listings</h1>
        <p className="font-sans text-sm text-gray-400 mt-1">
          {ready
            ? `${saved.length} saved listing${saved.length !== 1 ? 's' : ''}`
            : 'Loading your saved listings…'}
        </p>
      </div>

      {types.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setTypeFilter('')}
            className={pillCls(!typeFilter)}
          >
            All ({saved.length})
          </button>
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={pillCls(typeFilter === t)}>
              {SAVED_TYPE_LABEL[t]} ({saved.filter(s => s.type === t).length})
            </button>
          ))}
        </div>
      )}

      {!ready ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="bg-white border border-gray-200 h-72 animate-pulse" />
          ))}
        </div>
      ) : saved.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <Heart size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-2xl text-gray-300 mb-2">No saved listings yet</p>
          <p className="font-sans text-sm text-gray-400 mb-5">
            Tap the heart on any stay, trail or activity to keep it here while you plan your trip.
          </p>
          <Link href="/stays" className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">Browse Stays</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map(item => (
            <SavedCard key={`${item.type}:${item.id}`} item={item} onRemove={() => removeSaved(item.type, item.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

const pillCls = (active: boolean) =>
  `font-sans text-xs px-3 py-1.5 border transition-colors ${
    active
      ? 'bg-[#2d6a4f] border-[#2d6a4f] text-white'
      : 'bg-white border-gray-200 text-gray-500 hover:border-[#2d6a4f]'
  }`

function SavedCard({ item, onRemove }: { item: SavedListing; onRemove: () => void }) {
  return (
    <div className="bg-white border border-gray-200 overflow-hidden group">
      <div className="relative h-44 overflow-hidden bg-[#2d6a4f]/8">
        {item.image ? (
          // The snapshot's image URL comes from whichever catalogue the
          // listing lives in, and next/image throws a render error — taking
          // down the whole page, not just the photo — for a host that isn't
          // allow-listed in next.config.mjs. Same fallback the trail and
          // explore cards use (lib/image-url.ts).
          isOptimizableImageHost(item.image) ? (
            <Image
              src={item.image}
              alt={item.title}
              fill
              loading="lazy"
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <img
              src={item.image}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Heart size={24} className="text-[#2d6a4f]/20" />
          </div>
        )}
        <span className="absolute top-3 left-3 bg-white/90 font-sans text-[10px] tracking-[0.12em] uppercase px-2.5 py-1 text-gray-600">
          {SAVED_TYPE_LABEL[item.type] ?? item.type}
        </span>
        <button
          onClick={onRemove}
          className="absolute top-3 right-3 bg-white/90 p-1.5 text-red-400 hover:bg-white transition-colors"
          title="Remove from saved"
          aria-label={`Remove ${item.title} from saved`}
        >
          <X size={14} />
        </button>
      </div>
      <div className="p-4">
        {item.location && (
          <p className="font-sans text-xs text-gray-400 flex items-center gap-1 mb-1"><MapPin size={10} />{item.location}</p>
        )}
        <h3 className="font-display italic text-xl text-[#000000] mb-2">{item.title}</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {item.rating ? (
              <>
                <Star size={12} className="text-[#C9A96E] fill-[#C9A96E]" />
                <span className="font-sans text-xs text-gray-600">{item.rating}</span>
              </>
            ) : (
              <span className="font-sans text-xs text-gray-300">New listing</span>
            )}
          </div>
          {item.price ? (
            <p className="font-display italic text-[#2d6a4f]">
              {formatMoney(item.price)}
              <span className="font-sans text-xs text-gray-400">{SAVED_TYPE_PRICE_SUFFIX[item.type] ?? ''}</span>
            </p>
          ) : null}
        </div>
        <Link
          href={listingHref(item)}
          className="block mt-3 text-center border border-[#2d6a4f] text-[#2d6a4f] py-2 font-sans text-xs hover:bg-[#2d6a4f] hover:text-white transition-colors"
        >
          View Details →
        </Link>
      </div>
    </div>
  )
}

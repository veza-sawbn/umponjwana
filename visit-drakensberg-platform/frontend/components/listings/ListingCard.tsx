'use client'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Heart } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { StarRating } from '@/components/ui/StarRating'
import { formatCurrency } from '@/lib/utils'

interface Listing {
  id: string
  title: string
  location: string
  category: string
  price_per_unit: number
  unit_type: string
  rating_avg: number
  review_count: number
  images: string[]
  is_featured?: boolean
}

const CATEGORY_COLORS: Record<string, 'primary' | 'info' | 'success' | 'warning' | 'neutral'> = {
  stay: 'primary', activity: 'info', hike: 'success', shuttle: 'warning', package: 'neutral',
}

const UNIT_LABELS: Record<string, string> = {
  per_night: '/ night', per_person: '/ person', per_group: '/ group',
}

export function ListingCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-card animate-pulse">
      <div className="bg-gray-200 h-52" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-1/3 mt-3" />
      </div>
    </div>
  )
}

export function ListingCard({ listing }: { listing: Listing }) {
  const [liked, setLiked] = useState(false)
  const image = listing.images?.[0] ?? 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600'

  return (
    <Link href={`/listings/${listing.id}`} className="group block rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-shadow bg-white">
      <div className="relative h-52 overflow-hidden">
        <Image
          src={image}
          alt={listing.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute top-3 left-3">
          <Badge variant={CATEGORY_COLORS[listing.category] ?? 'neutral'} className="capitalize shadow-sm">
            {listing.category}
          </Badge>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); setLiked(!liked) }}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors shadow-sm"
        >
          <Heart className={`h-4 w-4 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
        </button>
        {listing.is_featured && (
          <div className="absolute bottom-3 left-3 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">
            Featured
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">{listing.title}</h3>
        </div>
        <div className="flex items-center gap-1 mt-1.5 text-gray-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs truncate">{listing.location}</span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5">
            <StarRating value={Math.round(listing.rating_avg ?? 0)} size="sm" />
            <span className="text-xs text-gray-500">({listing.review_count ?? 0})</span>
          </div>
          <div className="text-right">
            <span className="font-bold text-gray-900 text-sm">{formatCurrency(listing.price_per_unit)}</span>
            <span className="text-xs text-gray-400 ml-1">{UNIT_LABELS[listing.unit_type] ?? ''}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

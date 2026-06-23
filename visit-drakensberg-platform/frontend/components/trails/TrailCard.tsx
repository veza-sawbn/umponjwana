'use client'
import { useState } from 'react'
import { Mountain, ArrowUp, Clock, Star, Heart } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface Trail {
  id: string
  name: string
  area: string
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert'
  distance_km: number
  elevation_gain_m: number
  duration_hours: number
  rating: number
  review_count: number
  image: string
  tags: string[]
  is_featured?: boolean
}

interface TrailCardProps {
  trail: Trail
}

/* ─── Difficulty config ──────────────────────────────────────────────────── */
const DIFFICULTY = {
  easy: { label: 'Easy', bg: 'bg-emerald-500', text: 'text-white' },
  moderate: { label: 'Moderate', bg: 'bg-amber-400', text: 'text-white' },
  hard: { label: 'Hard', bg: 'bg-orange-500', text: 'text-white' },
  expert: { label: 'Expert', bg: 'bg-red-500', text: 'text-white' },
} as const

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function StarRatingDisplay({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${
              i < full
                ? 'fill-gold text-gold'
                : i === full && half
                ? 'fill-gold/50 text-gold'
                : 'fill-none text-gray-300'
            }`}
          />
        ))}
      </div>
      <span className="font-sans text-xs font-semibold text-forest">{rating.toFixed(1)}</span>
      <span className="font-sans text-xs text-forest/40">({count.toLocaleString()})</span>
    </div>
  )
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function TrailCard({ trail }: TrailCardProps) {
  const [saved, setSaved] = useState(false)
  const diff = DIFFICULTY[trail.difficulty]

  return (
    <motion.div
      className="bg-white rounded-2xl overflow-hidden shadow-card flex flex-col"
      whileHover={{ y: -3, boxShadow: '0 8px 30px rgba(0,0,0,0.14)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={trail.image}
          alt={trail.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Gradient for badge legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

        {/* Difficulty badge */}
        <span
          className={`absolute top-3 left-3 font-sans text-xs font-semibold px-2.5 py-1 rounded-full ${diff.bg} ${diff.text}`}
        >
          {diff.label}
        </span>

        {/* Featured badge */}
        {trail.is_featured && (
          <span className="absolute top-3 left-[calc(3rem+0.75rem+0.5rem)] font-sans text-xs font-semibold px-2.5 py-1 rounded-full bg-gold text-forest">
            Featured
          </span>
        )}

        {/* Save / heart button */}
        <motion.button
          onClick={(e) => { e.preventDefault(); setSaved((s) => !s) }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all shadow-sm"
          aria-label={saved ? 'Remove from saved' : 'Save trail'}
          whileTap={{ scale: 0.85 }}
          transition={{ duration: 0.1 }}
        >
          <Heart
            className={`h-4 w-4 transition-colors ${saved ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
          />
        </motion.button>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        {/* Name & area */}
        <h3 className="font-display text-lg font-bold text-forest leading-tight mb-0.5">
          {trail.name}
        </h3>
        <p className="font-sans text-xs text-sage font-medium mb-3">{trail.area}</p>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1 text-forest/60">
            <Mountain className="h-3.5 w-3.5 shrink-0" />
            <span className="font-sans text-xs font-medium">{trail.distance_km} km</span>
          </div>
          <div className="flex items-center gap-1 text-forest/60">
            <ArrowUp className="h-3.5 w-3.5 shrink-0" />
            <span className="font-sans text-xs font-medium">+{trail.elevation_gain_m} m</span>
          </div>
          <div className="flex items-center gap-1 text-forest/60">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="font-sans text-xs font-medium">{formatDuration(trail.duration_hours)}</span>
          </div>
        </div>

        {/* Rating */}
        <div className="mb-3">
          <StarRatingDisplay rating={trail.rating} count={trail.review_count} />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {trail.tags.map((tag) => (
            <span
              key={tag}
              className="font-sans text-[11px] font-medium px-2 py-0.5 rounded-full bg-mist text-forest"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-auto">
          <Link
            href={`/hikes/${trail.id}`}
            className="block w-full text-center font-sans text-sm font-semibold bg-forest text-white rounded-xl py-2.5 hover:bg-sage transition-colors duration-200"
          >
            View Trail
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

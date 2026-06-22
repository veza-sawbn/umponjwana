'use client'
import { useState } from 'react'
import Link from 'next/link'
import { SlidersHorizontal, X } from 'lucide-react'
import Footer from '@/components/layout/Footer'

const HIKES = [
  { id: 'h1', title: 'Tugela Falls Circuit', location: 'Royal Natal National Park', distance: 14, elevation: 1200, difficulty: 'Hard', rating: 4.9, reviews: 203, duration: '7–9 h', img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80', permit: true },
  { id: 'h2', title: 'Amphitheatre via Chain Ladder', location: 'Royal Natal, Northern Berg', distance: 8, elevation: 780, difficulty: 'Moderate', rating: 4.7, reviews: 145, duration: '4–5 h', img: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80', permit: true },
  { id: 'h3', title: 'Cathedral Peak Summit', location: 'Cathedral Peak, Central Berg', distance: 16, elevation: 1500, difficulty: 'Hard', rating: 4.8, reviews: 98, duration: '8 h', img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80', permit: true },
  { id: 'h4', title: 'Fairy Glen Waterfall Walk', location: 'Champagne Valley', distance: 5, elevation: 240, difficulty: 'Easy', rating: 4.5, reviews: 67, duration: '2 h', img: 'https://images.unsplash.com/photo-1542587222-e14b891ee40b?w=800&q=80', permit: false },
  { id: 'h5', title: "Monk's Cowl Circuit", location: 'Central Drakensberg', distance: 10, elevation: 620, difficulty: 'Moderate', rating: 4.6, reviews: 82, duration: '5–6 h', img: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=800&q=80', permit: true },
  { id: 'h6', title: 'Giants Castle Hike', location: 'Giants Castle Game Reserve', distance: 12, elevation: 900, difficulty: 'Moderate', rating: 4.7, reviews: 54, duration: '6 h', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80', permit: true },
]

const DIFF_COLOR: Record<string, string> = { Easy: '#4A7251', Moderate: '#C9A96E', Hard: '#c0392b' }
const DIFF_OPTS = ['All', 'Easy', 'Moderate', 'Hard']

export default function HikesPage() {
  const [diff, setDiff] = useState('All')
  const [maxDist, setMaxDist] = useState(20)

  const filtered = HIKES.filter((h) =>
    (diff === 'All' || h.difficulty === diff) && h.distance <= maxDist
  )

  return (
    <main className="bg-mist min-h-screen pt-16">
      {/* Header */}
      <section className="bg-forest text-white py-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-3">On foot</p>
          <h1 className="font-display text-5xl lg:text-6xl text-white leading-none mb-4">Hikes & Trails</h1>
          <p className="font-sans text-sm text-white/50">From gentle valley walks to multi-day escarpment routes</p>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          {/* Difficulty pills */}
          <div className="flex gap-2">
            {DIFF_OPTS.map((d) => (
              <button key={d} onClick={() => setDiff(d)}
                className={`font-sans text-xs px-4 py-2 border transition-colors ${diff === d ? 'bg-forest border-forest text-white' : 'bg-white border-black/15 text-forest/60 hover:border-forest'}`}>
                {d}
              </button>
            ))}
          </div>
          {/* Distance */}
          <div className="flex items-center gap-3 ml-auto">
            <span className="font-sans text-xs text-forest/40">Max {maxDist} km</span>
            <input type="range" min={3} max={20} step={1} value={maxDist}
              onChange={(e) => setMaxDist(Number(e.target.value))}
              className="w-28 accent-forest" />
          </div>
          <p className="font-sans text-sm text-forest/50">
            <span className="text-forest font-medium">{filtered.length}</span> trails
          </p>
        </div>

        {/* Table-style list */}
        <div className="bg-white border border-black/8 divide-y divide-black/6 mb-10">
          {filtered.map((h) => (
            <Link key={h.id} href={`/hikes/${h.id}`}
              className="group flex items-center gap-6 px-6 py-5 hover:bg-mist transition-colors">
              <div className="w-20 h-14 shrink-0 overflow-hidden hidden sm:block">
                <img src={h.img} alt={h.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg text-forest group-hover:text-sage transition-colors">{h.title}</h3>
                <p className="font-sans text-xs text-forest/40 mt-0.5">{h.location}</p>
              </div>
              <div className="hidden md:flex items-center gap-8 shrink-0">
                <div className="text-center">
                  <p className="font-display text-base text-forest">{h.distance} km</p>
                  <p className="font-sans text-[10px] text-forest/35 uppercase tracking-wide">Distance</p>
                </div>
                <div className="text-center">
                  <p className="font-display text-base text-forest">+{h.elevation} m</p>
                  <p className="font-sans text-[10px] text-forest/35 uppercase tracking-wide">Elevation</p>
                </div>
                <div className="text-center">
                  <p className="font-sans text-xs font-medium" style={{ color: DIFF_COLOR[h.difficulty] }}>{h.difficulty}</p>
                  <p className="font-sans text-[10px] text-forest/35 uppercase tracking-wide">{h.duration}</p>
                </div>
                <div className="text-center">
                  <p className="font-sans text-sm text-forest">★ {h.rating}</p>
                  <p className="font-sans text-[10px] text-forest/35">({h.reviews})</p>
                </div>
                {h.permit && (
                  <span className="font-sans text-[10px] border border-gold text-gold px-2 py-0.5 uppercase tracking-wide">Permit</span>
                )}
              </div>
              <span className="text-forest/20 group-hover:text-gold transition-colors shrink-0">→</span>
            </Link>
          ))}
        </div>

        {/* Card grid */}
        <div className="h-px bg-black/8 mb-10" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
          {filtered.map((h) => (
            <Link key={h.id} href={`/hikes/${h.id}`} className="group block">
              <div className="relative overflow-hidden aspect-[4/3] mb-4">
                <img src={h.img} alt={h.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <span
                  className="absolute bottom-3 left-3 font-sans text-[10px] px-2.5 py-1 uppercase tracking-wide"
                  style={{ background: DIFF_COLOR[h.difficulty] + 'dd', color: '#fff' }}
                >
                  {h.difficulty}
                </span>
              </div>
              <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{h.location}</p>
              <h3 className="font-display text-xl text-forest leading-snug mb-2 group-hover:text-sage transition-colors">{h.title}</h3>
              <p className="font-sans text-xs text-forest/40">{h.distance} km · +{h.elevation} m · {h.duration}</p>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </main>
  )
}

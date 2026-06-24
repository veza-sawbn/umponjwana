'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import { getTrails, type Trail } from '@/lib/trails'

const DIFF_COLOR: Record<string, string> = { Easy: '#4A7251', Moderate: '#C9A96E', Strenuous: '#c0392b' }
const DIFF_OPTS = ['All', 'Easy', 'Moderate', 'Strenuous']

function parseKm(distance: string): number {
  const m = distance.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : 0
}

export default function HikesPage() {
  const [trails, setTrails] = useState<Trail[]>([])
  const [diff, setDiff] = useState('All')
  const [maxDist, setMaxDist] = useState(250)

  useEffect(() => {
    getTrails().then(all => setTrails(all.filter(t => t.status === 'published')))
  }, [])

  const filtered = trails.filter(t =>
    (diff === 'All' || t.difficulty === diff) && parseKm(t.distance) <= maxDist
  )

  const allKms = trails.map(t => parseKm(t.distance))
  const sliderMax = allKms.length ? Math.max(...allKms) : 250

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
          <div className="flex gap-2">
            {DIFF_OPTS.map((d) => (
              <button key={d} onClick={() => setDiff(d)}
                className={`font-sans text-xs px-4 py-2 border transition-colors ${diff === d ? 'bg-forest border-forest text-white' : 'bg-white border-black/15 text-forest/60 hover:border-forest'}`}>
                {d}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <span className="font-sans text-xs text-forest/40">Max {maxDist} km</span>
            <input type="range" min={1} max={sliderMax} step={1} value={maxDist}
              onChange={(e) => setMaxDist(Number(e.target.value))}
              className="w-28 accent-forest" />
          </div>
          <p className="font-sans text-sm text-forest/50">
            <span className="text-forest font-medium">{filtered.length}</span> trails
          </p>
        </div>

        {trails.length === 0 ? (
          <div className="py-20 text-center font-sans text-sm text-forest/30">Loading trails…</div>
        ) : (
          <>
            {/* Table-style list */}
            <div className="bg-white border border-black/8 divide-y divide-black/6 mb-10">
              {filtered.map((t) => (
                <Link key={t.id} href={`/hikes/${t.id}`}
                  className="group flex items-center gap-6 px-6 py-5 hover:bg-mist transition-colors">
                  <div className="w-20 h-14 shrink-0 overflow-hidden hidden sm:block">
                    <img src={t.image} alt={t.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg text-forest group-hover:text-sage transition-colors">{t.name}</h3>
                    <p className="font-sans text-xs text-forest/40 mt-0.5">{t.region}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-8 shrink-0">
                    <div className="text-center">
                      <p className="font-display text-base text-forest">{t.distance}</p>
                      <p className="font-sans text-[10px] text-forest/35 uppercase tracking-wide">Distance</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display text-base text-forest">{t.elevation}</p>
                      <p className="font-sans text-[10px] text-forest/35 uppercase tracking-wide">Elevation</p>
                    </div>
                    <div className="text-center">
                      <p className="font-sans text-xs font-medium" style={{ color: DIFF_COLOR[t.difficulty] }}>{t.difficulty}</p>
                      <p className="font-sans text-[10px] text-forest/35 uppercase tracking-wide">{t.duration}</p>
                    </div>
                    {t.permit_required && (
                      <span className="font-sans text-[10px] border border-gold text-gold px-2 py-0.5 uppercase tracking-wide">Permit</span>
                    )}
                  </div>
                  <span className="text-forest/20 group-hover:text-gold transition-colors shrink-0">→</span>
                </Link>
              ))}
              {filtered.length === 0 && (
                <div className="px-6 py-12 text-center font-sans text-sm text-forest/30">No trails match your filters</div>
              )}
            </div>

            {/* Card grid */}
            <div className="h-px bg-black/8 mb-10" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
              {filtered.map((t) => (
                <Link key={t.id} href={`/hikes/${t.id}`} className="group block">
                  <div className="relative overflow-hidden aspect-[4/3] mb-4">
                    <img src={t.image} alt={t.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <span
                      className="absolute bottom-3 left-3 font-sans text-[10px] px-2.5 py-1 uppercase tracking-wide"
                      style={{ background: DIFF_COLOR[t.difficulty] + 'dd', color: '#fff' }}
                    >
                      {t.difficulty}
                    </span>
                  </div>
                  <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{t.region}</p>
                  <h3 className="font-display text-xl text-forest leading-snug mb-2 group-hover:text-sage transition-colors">{t.name}</h3>
                  <p className="font-sans text-xs text-forest/40">{t.distance} · {t.elevation} · {t.duration}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
      <Footer />
    </main>
  )
}

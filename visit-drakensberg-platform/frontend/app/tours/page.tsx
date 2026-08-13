'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import EditablePageHeader from '@/components/editor/EditablePageHeader'
import { Mountain, Users, Star } from 'lucide-react'
import { getTours, type Tour } from '@/lib/tours'
import { regionsMatch } from '@/lib/regions'

// Tours are the evergreen, bookable product layer — created once by a
// supplier and reused across scheduled departures (see lib/departures.ts).
// A departure expiring never removes the tour itself, which is the point:
// this listing and /tours/[id] accumulate long-term search authority the
// way individual dated /experiences/[id] pages cannot. See
// docs/destination-graph/PHASE_A.md "Tours" and PHASE_B.md.

const DIFF_COLOR: Record<string, string> = { Easy: '#4A7251', Moderate: '#C9A96E', Strenuous: '#c0392b', Extreme: '#7f1d1d' }

const DIFF_OPTS = ['All', 'Easy', 'Moderate', 'Strenuous', 'Extreme']

export default function ToursPage() {
  const [tours, setTours] = useState<Tour[]>([])
  const [loading, setLoading] = useState(true)
  const [difficulty, setDifficulty] = useState('All')
  const [region, setRegion] = useState('All')

  useEffect(() => {
    getTours()
      .then(all => setTours(all.filter(t => t.status === 'active')))
      .finally(() => setLoading(false))
  }, [])

  const regionOpts = ['All', ...Array.from(new Set(tours.map(t => t.trailName).filter(Boolean)))]

  const filtered = tours.filter(t =>
    (difficulty === 'All' || t.difficulty === difficulty) &&
    (region === 'All' || regionsMatch(t.trailName, region) || t.trailName === region)
  )

  return (
    <main className="bg-mist min-h-screen pt-16">
      <EditablePageHeader section="tours_page" />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex gap-2 flex-wrap">
            {DIFF_OPTS.map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`font-sans text-xs px-4 py-2 border transition-colors ${difficulty === d ? 'bg-forest border-forest text-white' : 'bg-white border-black/15 text-forest/60 hover:border-forest'}`}>
                {d}
              </button>
            ))}
          </div>
          {regionOpts.length > 2 && (
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="font-sans text-xs border border-black/15 bg-white px-3 py-2 text-forest/70 focus:outline-none hover:border-forest transition-colors"
              aria-label="Filter by trail"
            >
              {regionOpts.map(r => <option key={r} value={r}>{r === 'All' ? 'All trails' : r}</option>)}
            </select>
          )}
          <p className="font-sans text-sm text-forest/50 ml-auto">
            <span className="text-forest font-medium">{filtered.length}</span> tour{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center font-sans text-sm text-forest/30">Loading tours…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display italic text-2xl text-forest/30 mb-2">No tours match your filters</p>
            <p className="font-sans text-sm text-forest/50">
              Browse <Link href="/hikes" className="text-forest underline hover:text-gold">hiking trails</Link> or{' '}
              <Link href="/guides" className="text-forest underline hover:text-gold">find a guide</Link> to request a custom trip.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
            {filtered.map(t => (
              <Link key={t.id} href={`/tours/${t.id}`} className="group block">
                <div className="relative overflow-hidden aspect-[4/3] mb-4 bg-[#2d6a4f]/10 flex items-center justify-center">
                  <Mountain className="w-10 h-10 text-forest/20" />
                  {t.featured && (
                    <span className="absolute top-3 left-3 font-sans text-[10px] tracking-[0.15em] uppercase bg-gold text-forest px-2.5 py-1">
                      Featured
                    </span>
                  )}
                  <span
                    className="absolute bottom-3 left-3 font-sans text-[10px] px-2.5 py-1 uppercase tracking-wide text-white"
                    style={{ background: (DIFF_COLOR[t.difficulty] || '#2d6a4f') + 'dd' }}
                  >
                    {t.difficulty}
                  </span>
                </div>
                <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">
                  {t.trailName || 'Drakensberg'}{t.days ? ` · ${t.days} day${t.days !== 1 ? 's' : ''}` : ''}
                </p>
                <h3 className="font-display text-xl text-forest leading-snug mb-2 group-hover:text-sage transition-colors">{t.name}</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 font-sans text-xs text-forest/40">
                    {t.maxGroup ? <span className="flex items-center gap-1"><Users size={11} /> up to {t.maxGroup}</span> : null}
                    {t.rating ? (
                      <span className="flex items-center gap-1"><Star size={11} className="text-gold fill-gold" /> {t.rating}</span>
                    ) : null}
                  </div>
                  <span>
                    <span className="font-display text-lg text-forest">R{t.pricePerPerson.toLocaleString()}</span>
                    <span className="font-sans text-xs text-forest/40"> pp</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  )
}

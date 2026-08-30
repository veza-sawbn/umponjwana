'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import EditablePageHeader from '@/components/editor/EditablePageHeader'
import { Users, Star } from 'lucide-react'
import { getTours, type Tour } from '@/lib/tours'
import { getTrails, type Trail } from '@/lib/trails'
import { getOperators, type OperatorProfile } from '@/lib/operators'
import { regionsMatch } from '@/lib/regions'
import { formatMoney } from '@/lib/allocation'
import ExploreCard from '@/components/trails/ExploreCard'
import SupplierCarousel from '@/components/tours/SupplierCarousel'

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
  const [trails, setTrails] = useState<Trail[]>([])
  const [operators, setOperators] = useState<OperatorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [difficulty, setDifficulty] = useState('All')
  const [region, setRegion] = useState('All')

  useEffect(() => {
    getTours()
      .then(all => setTours(all.filter(t => t.status === 'active')))
      .finally(() => setLoading(false))
    // Each tour is built on a Trail (lib/trails.ts) — fetched here so its
    // card can show the trail's real photo and route artwork, the same
    // image and design /hikes' trail cards show for that trail.
    getTrails().then(all => setTrails(all)).catch(() => setTrails([]))
    getOperators().then(all => setOperators(all)).catch(() => setOperators([]))
  }, [])

  const trailById = new Map(trails.map(t => [t.id, t]))

  // Only operators actually running one of the tours listed here — the
  // "Explore by Supplier" strip is a glimpse of who guests would be
  // booking with, not the whole cross-platform directory.
  const tourSupplierIds = new Set(tours.map(t => t.supplierId))
  const tourSuppliers = operators.filter(o => tourSupplierIds.has(o.supplierId))

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
            {filtered.map(t => {
              const trail = trailById.get(t.trailId)
              return (
                <ExploreCard
                  key={t.id}
                  href={`/tours/${t.id}`}
                  image={trail?.image}
                  imageAlt={t.name}
                  eyebrow={`${t.trailName || 'Drakensberg'}${t.days ? ` · ${t.days} day${t.days !== 1 ? 's' : ''}` : ''}`}
                  title={t.name}
                  difficultyLabel={t.difficulty}
                  difficultyColor={DIFF_COLOR[t.difficulty] || '#2d6a4f'}
                  topLeftBadge={t.featured ? 'Featured' : undefined}
                  routeArtworkTrail={trail}
                  meta={
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 font-sans text-xs text-forest/40">
                        {t.maxGroup ? <span className="flex items-center gap-1"><Users size={11} /> up to {t.maxGroup}</span> : null}
                        {t.rating ? (
                          <span className="flex items-center gap-1"><Star size={11} className="text-gold fill-gold" /> {t.rating}</span>
                        ) : null}
                      </div>
                      <span>
                        <span className="font-display text-lg text-forest">{formatMoney(t.pricePerPerson)}</span>
                        <span className="font-sans text-xs text-forest/40"> pp</span>
                      </span>
                    </div>
                  }
                />
              )
            })}
          </div>
        )}

        {/* Explore by supplier — a glimpse of each operator's profile,
            auto-sliding on the mobile shell; opens their full profile. */}
        {tourSuppliers.length > 0 && (
          <div className="mt-16">
            <div className="h-px bg-black/8 mb-10" />
            <div className="mb-8">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-2">Meet the Operators</p>
              <h2 className="font-display text-3xl text-forest leading-none mb-2">Explore by Supplier</h2>
              <p className="font-sans text-sm text-forest/50">
                Every guided tour above is run by one of these verified Drakensberg operators — open a profile to see their full team, certifications and track record.
              </p>
            </div>
            <SupplierCarousel operators={tourSuppliers} />
          </div>
        )}
      </div>
      <Footer />
    </main>
  )
}

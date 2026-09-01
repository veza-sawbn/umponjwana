'use client'
import { useState, useEffect, useRef } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import EditablePageHeader from '@/components/editor/EditablePageHeader'
import { getProperties, type Property, PROPERTY_TYPES, propertyTypeFromSlug } from '@/lib/properties'
import { getRoomsByProperty } from '@/lib/rooms'
import { DEFAULT_REGIONS, getRegions, regionsMatch, type Region } from '@/lib/regions'
import { formatMoney } from '@/lib/allocation'
import StayCarousel, { type StayCard } from '@/components/stays/StayCarousel'

function propToCard(p: Property, minPrice = 0): StayCard {
  const amenityMap: Record<string, string> = {
    'Swimming Pool': 'pool', 'Wi-Fi': 'wifi', 'Braai Facilities': 'braai',
    'Hiking Trails Access': 'hiking', 'Restaurant': 'restaurant', 'Spa': 'spa',
  }
  return {
    id: p.id,
    title: p.name,
    location: p.region || p.address,
    price: minPrice,
    category: p.type,
    amenities: p.amenities.map(a => amenityMap[a] ?? a.toLowerCase()),
    img: p.photos[0] || undefined,
  }
}

// Display label for each accommodation type's section heading / pill — kept
// as an explicit map (rather than naively appending "s") since a couple of
// PROPERTY_TYPES (lib/properties.ts) pluralize irregularly ("Backpackers",
// "Glamping" are already plural/uncountable).
const TYPE_LABELS: Record<string, string> = {
  Lodge: 'Lodges',
  Guesthouse: 'Guesthouses',
  Hotel: 'Hotels',
  'Self-catering Cottage': 'Self-catering Cottages',
  Campsite: 'Campsites',
  Backpackers: 'Backpackers',
  'Boutique Hotel': 'Boutique Hotels',
  Resort: 'Resorts',
  Glamping: 'Glamping',
  'Farm Stay': 'Farm Stays',
}

function regionImage(region: Region, index: number) {
  return region.heroImage || DEFAULT_REGIONS[index % DEFAULT_REGIONS.length]?.heroImage || DEFAULT_REGIONS[0].heroImage
}

const AMENITY_OPTS = ['pool', 'wifi', 'braai', 'hiking']
const SORT_OPTS = ['Recommended', 'Price: Low to High', 'Price: High to Low', 'Rating']
const pillCls = (active: boolean) =>
  `font-sans text-xs px-3 py-1.5 border transition-colors ${active ? 'bg-forest border-forest text-white' : 'bg-white border-black/15 text-forest/60 hover:border-forest/40'}`

export default function StaysPage() {
  const [sortBy, setSortBy] = useState('Recommended')
  const [maxPrice, setMaxPrice] = useState(5000)
  const [amenities, setAmenities] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [liveProperties, setLiveProperties] = useState<StayCard[]>([])
  const [regionFilter, setRegionFilter] = useState('')
  // '' = All types. Pre-filled from ?type=<slug> — the Stay nav menu's
  // per-type sub-items (lib/destination-ia.ts) link in this way, e.g.
  // Stay ▸ Lodges → /stays?type=lodge.
  const [typeFilter, setTypeFilter] = useState('')
  const [regions, setRegions] = useState<Region[]>(DEFAULT_REGIONS)
  // The region picker lives at the bottom of the page but filters the
  // sections above it — scroll there so picking a region visibly does
  // something instead of updating a list the visitor has already scrolled past.
  const resultsTopRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const regionParam = params.get('region')
    if (regionParam) setRegionFilter(regionParam)
    const typeParam = params.get('type')
    if (typeParam) {
      const resolved = propertyTypeFromSlug(typeParam)
      if (resolved) setTypeFilter(resolved)
    }

    getProperties().then(async props => {
      const active = props.filter(p => p.status === 'active')
      const cards = await Promise.all(active.map(async p => {
        const rooms = await getRoomsByProperty(p.id)
        const minPrice = rooms.length > 0 ? Math.min(...rooms.map(r => r.basePrice)) : 0
        return propToCard(p, minPrice)
      }))
      setLiveProperties(cards)
    })
    getRegions().then(setRegions).catch(() => {})
  }, [])

  const toggleAmenity = (a: string) =>
    setAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a])

  const hasActiveFilters = Boolean(typeFilter || regionFilter || amenities.length || maxPrice < 5000)

  const filtered = liveProperties
    .filter((s) =>
      (!s.price || s.price <= maxPrice) &&
      (!amenities.length || amenities.every((a) => s.amenities.includes(a))) &&
      (!regionFilter || regionsMatch(s.location, regionFilter)) &&
      (!typeFilter || s.category === typeFilter)
    )
    .sort((a, b) => {
      if (sortBy === 'Price: Low to High') return a.price - b.price
      if (sortBy === 'Price: High to Low') return b.price - a.price
      if (sortBy === 'Rating') return (b.rating ?? 0) - (a.rating ?? 0)
      return 0
    })

  // Sections by accommodation type, in PROPERTY_TYPES order, skipping any
  // type with no matching stays — a selected typeFilter naturally collapses
  // this to a single section since `filtered` already excludes every other
  // type. Order within each group is inherited from the sort above.
  const sections = PROPERTY_TYPES
    .map(type => ({ type, stays: filtered.filter(s => s.category === type) }))
    .filter(g => g.stays.length > 0)
  // Any stay whose type isn't in PROPERTY_TYPES (a legacy/custom value) still
  // needs to render somewhere rather than silently vanishing from the page.
  const knownTypes = new Set(PROPERTY_TYPES)
  const otherStays = filtered.filter(s => !knownTypes.has(s.category))

  return (
    <main className="bg-mist min-h-screen pt-16">
      {/* Header */}
      <EditablePageHeader section="stays_page" />

      <div ref={resultsTopRef} className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p className="font-sans text-sm text-forest/50">
            <span className="text-forest font-medium">{filtered.length}</span> stays
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`relative flex items-center gap-2 font-sans text-sm border px-4 py-2 transition-colors ${
                showFilters ? 'border-forest bg-forest text-white' : 'border-black/15 bg-white hover:border-forest'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-gold" />}
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="font-sans text-sm border border-black/15 bg-white px-4 py-2 focus:outline-none hover:border-forest transition-colors"
            >
              {SORT_OPTS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Active filter summary — the type/region pickers below live behind
            the Filters toggle and the region carousel further down, so this
            keeps whatever's applied visible without opening either. */}
        {(typeFilter || regionFilter) && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="font-sans text-xs text-forest/40">Showing:</span>
            {typeFilter && (
              <button onClick={() => setTypeFilter('')} className="inline-flex items-center gap-1.5 font-sans text-xs bg-forest text-white px-3 py-1.5">
                {TYPE_LABELS[typeFilter] ?? typeFilter} <X className="w-3 h-3" />
              </button>
            )}
            {regionFilter && (
              <button onClick={() => setRegionFilter('')} className="inline-flex items-center gap-1.5 font-sans text-xs bg-forest text-white px-3 py-1.5">
                {regionFilter} <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-white border border-black/8 p-6 mb-8 space-y-6">
            <div>
              <p className="font-sans text-xs tracking-[0.15em] uppercase text-forest/40 mb-3">Property type</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setTypeFilter('')} className={pillCls(!typeFilter)}>All types</button>
                {PROPERTY_TYPES.map((t) => (
                  <button key={t} onClick={() => setTypeFilter(t)} className={pillCls(typeFilter === t)}>
                    {TYPE_LABELS[t] ?? t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="font-sans text-xs tracking-[0.15em] uppercase text-forest/40 mb-3">Max price / night</p>
                <div className="flex items-center justify-between font-sans text-sm text-forest mb-2">
                  <span>{formatMoney(0)}</span><span className="font-medium">{formatMoney(maxPrice)}</span>
                </div>
                <input type="range" min={0} max={5000} step={100} value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-forest" />
              </div>
              <div>
                <p className="font-sans text-xs tracking-[0.15em] uppercase text-forest/40 mb-3">Amenities</p>
                <div className="space-y-2">
                  {AMENITY_OPTS.map((a) => (
                    <label key={a} className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={amenities.includes(a)} onChange={() => toggleAmenity(a)}
                        className="accent-forest w-3.5 h-3.5" />
                      <span className="font-sans text-sm text-forest/70 capitalize">{a}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-2 flex items-end">
                <button onClick={() => { setAmenities([]); setMaxPrice(5000); setTypeFilter(''); setRegionFilter('') }}
                  className="font-sans text-xs text-forest/40 hover:text-forest transition-colors inline-flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sections, grouped by accommodation type — each a horizontally
            scrollable row so browsing every category doesn't mean scrolling
            through the whole page vertically. */}
        {filtered.length === 0 && (
          <p className="font-sans text-sm text-forest/40 py-16 text-center">No stays match these filters yet.</p>
        )}
        <div className="space-y-14">
          {sections.map(({ type, stays }) => (
            <section key={type}>
              {!typeFilter && (
                <h2 className="font-display text-2xl text-forest mb-5">{TYPE_LABELS[type] ?? type}</h2>
              )}
              <StayCarousel stays={stays} />
            </section>
          ))}
          {otherStays.length > 0 && (
            <section>
              {!typeFilter && <h2 className="font-display text-2xl text-forest mb-5">Other Stays</h2>}
              <StayCarousel stays={otherStays} />
            </section>
          )}
        </div>
      </div>

      {/* Browse by region */}
      <section className="bg-white border-t border-black/8 py-16 mt-14">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="mb-8">
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">Or start from a place</p>
            <h2 className="font-display text-3xl text-forest">Select stays by region</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {regions.map((r, i) => {
              const active = regionsMatch(r.name, regionFilter)
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setRegionFilter(active ? '' : r.name)
                    resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={`group relative aspect-[4/5] overflow-hidden text-left transition-all ${active ? 'ring-2 ring-forest' : ''}`}
                >
                  <img
                    src={regionImage(r, i)}
                    alt={r.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className={`absolute inset-0 ${active ? 'bg-forest/50' : 'bg-black/35 group-hover:bg-black/45'} transition-colors`} />
                  <span className="absolute inset-x-0 bottom-0 p-3 font-sans text-sm text-white leading-snug">
                    {r.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

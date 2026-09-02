'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay } from 'swiper/modules'
import 'swiper/css'
import { getRegions, DEFAULT_REGIONS, type Region } from '@/lib/regions'

function regionImage(region: Region, index: number) {
  return region.heroImage || DEFAULT_REGIONS[index % DEFAULT_REGIONS.length]?.heroImage || DEFAULT_REGIONS[0].heroImage
}

/**
 * Same card design as the homepage's "By region" section (see
 * regionsSection/RegionCardBody in app/page.tsx) — image, tagline, name,
 * overview — but backed by the real Region catalogue (lib/regions.ts)
 * instead of the homepage's cosmetic home_cards.regions, since a click here
 * has to actually filter trails rather than just look right.
 *
 * Left-clicking a card filters this same page in place, exactly as if the
 * region's ?region= query param had been there on load — the same outcome
 * as the "View Hikes" button on /regions#<slug> — via onSelect, without a
 * page reload. The href is real too (a genuine /hikes?region=… URL), so a
 * modified click (new tab, middle click, copy link) still behaves like a
 * normal link.
 */
function RegionCard({ region: r, index, onSelect }: { region: Region; index: number; onSelect: (name: string) => void }) {
  function handleClick(e: React.MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    onSelect(r.name)
    window.history.replaceState(null, '', `/hikes?region=${encodeURIComponent(r.name)}`)
  }

  return (
    <Link href={`/hikes?region=${encodeURIComponent(r.name)}`} onClick={handleClick} className="group block">
      <div className="relative overflow-hidden aspect-[4/3] mb-4">
        <img loading="lazy" decoding="async"
          src={regionImage(r, index)}
          alt={r.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          style={{ willChange: 'transform' }}
        />
      </div>
      <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{r.tagline || 'Drakensberg region'}</p>
      <h3 className="font-display text-2xl text-forest mb-2">{r.name}</h3>
      <p className="font-sans text-sm text-forest/55 leading-relaxed line-clamp-3">{r.overview || r.seoDescription}</p>
    </Link>
  )
}

/** Mobile-only carousel counterpart — same cadence as the homepage's. */
function RegionsCarousel({ regions, onSelect }: { regions: Region[]; onSelect: (name: string) => void }) {
  const canLoop = regions.length > 2
  return (
    <Swiper
      modules={[Autoplay]}
      loop={canLoop}
      speed={700}
      autoplay={regions.length < 2 ? false : { delay: 6000, disableOnInteraction: false, pauseOnMouseEnter: true }}
      slidesPerView={1.15}
      spaceBetween={12}
      grabCursor
      className="!pb-1"
    >
      {regions.map((r, index) => (
        <SwiperSlide key={r.id} className="h-auto self-stretch">
          <RegionCard region={r} index={index} onSelect={onSelect} />
        </SwiperSlide>
      ))}
    </Swiper>
  )
}

/**
 * Replaces the old table-style trail list on /hikes: browse trails by
 * region instead of scanning a flat list, using the same card layout as
 * the homepage's "By region" section.
 */
export default function HikesRegionExplorer({ onSelectRegion }: { onSelectRegion: (name: string) => void }) {
  const [regions, setRegions] = useState<Region[]>([])

  useEffect(() => {
    getRegions().then(setRegions).catch(() => setRegions(DEFAULT_REGIONS))
  }, [])

  if (regions.length === 0) return null

  return (
    <div>
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">By region</p>
          <h2 className="font-display text-4xl text-forest">Explore hikes by region</h2>
        </div>
        <Link href="/regions" className="hidden sm:flex items-center gap-2 font-sans text-sm text-forest/50 hover:text-forest transition-colors">
          All regions <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Tablet/desktop: static grid */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-6">
        {regions.map((r, index) => (
          <RegionCard key={r.id} region={r} index={index} onSelect={onSelectRegion} />
        ))}
      </div>

      {/* Mobile: swipeable carousel */}
      <div className="sm:hidden">
        <RegionsCarousel regions={regions} onSelect={onSelectRegion} />
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { MapPin, Mountain, Zap, Home, ArrowRight, ChevronRight, Clock, Navigation } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { getRegions, regionsMatch, type Region } from '@/lib/regions'
import { getProperties, type Property } from '@/lib/properties'
import { getRoomsByProperty } from '@/lib/rooms'
import { getTrails, trailStartPoint, type Trail } from '@/lib/trails'
import { getActivities, type Activity } from '@/lib/activities'
import { StayDistance } from '@/lib/stay-distance'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIFF_COLOR: Record<string, string> = {
  Easy: 'text-green-600 bg-green-50',
  Moderate: 'text-yellow-700 bg-yellow-50',
  Strenuous: 'text-orange-700 bg-orange-50',
  Extreme: 'text-red-700 bg-red-50',
}

const FALLBACK = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80'

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <span className="text-[#2d6a4f]">{icon}</span>
        <h2 className="font-display italic text-3xl text-[#000000]">{label}</h2>
      </div>
      <span className="font-sans text-sm text-gray-400">{count} listed</span>
    </div>
  )
}

// ── Stay card ─────────────────────────────────────────────────────────────────

function StayCard({ prop, minPrice }: { prop: Property; minPrice: number | null }) {
  return (
    <Link
      href={`/stays/${prop.id}`}
      className="group bg-white border border-gray-200 overflow-hidden hover:border-[#2d6a4f] transition-colors flex flex-col"
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={prop.photos[0] || FALLBACK}
          alt={prop.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <span className="absolute top-3 left-3 bg-white/90 font-sans text-[10px] tracking-[0.12em] uppercase px-2.5 py-1 text-gray-600">
          {prop.type}
        </span>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-[#C9A96E] mb-1 flex items-center gap-1">
          <MapPin size={9} /> {prop.region || prop.address}
        </p>
        <h3 className="font-display italic text-xl text-[#000000] leading-tight mb-2 group-hover:text-[#2d6a4f] transition-colors">
          {prop.name}
        </h3>
        <p className="font-sans text-xs text-gray-400 line-clamp-2 mb-3 flex-1">{prop.description}</p>
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          {minPrice ? (
            <p className="font-display italic text-[#2d6a4f]">
              R {minPrice.toLocaleString()} <span className="font-sans text-xs text-gray-400">/night</span>
            </p>
          ) : (
            <p className="font-sans text-xs text-gray-400">Contact for rates</p>
          )}
          <StayDistance lat={prop.gpsLat} lng={prop.gpsLng} />
        </div>
      </div>
    </Link>
  )
}

// ── Trail card ────────────────────────────────────────────────────────────────

function TrailCard({ trail }: { trail: Trail }) {
  const start = trailStartPoint(trail)
  return (
    <Link
      href={`/hikes/${trail.id}`}
      className="group bg-white border border-gray-200 overflow-hidden hover:border-[#2d6a4f] transition-colors flex gap-0"
    >
      <div className="relative w-28 shrink-0 overflow-hidden">
        <img
          src={trail.image || FALLBACK}
          alt={trail.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-4 flex flex-col justify-between flex-1 min-w-0">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`font-sans text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 ${DIFF_COLOR[trail.difficulty] || 'text-gray-500 bg-gray-50'}`}>
              {trail.difficulty}
            </span>
          </div>
          <h3 className="font-display italic text-lg text-[#000000] leading-tight group-hover:text-[#2d6a4f] transition-colors truncate">
            {trail.name}
          </h3>
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="font-sans text-[10px] text-gray-400 flex items-center gap-1">
            <Navigation size={9} /> {trail.distance}
          </span>
          <span className="font-sans text-[10px] text-gray-400 flex items-center gap-1">
            <Clock size={9} /> {trail.duration}
          </span>
          {start && <StayDistance lat={start.lat} lng={start.lng} />}
        </div>
      </div>
    </Link>
  )
}

// ── Activity card ─────────────────────────────────────────────────────────────

function ActivityCard({ activity }: { activity: Activity }) {
  return (
    <Link
      href={`/activities/${activity.id}`}
      className="group bg-white border border-gray-200 overflow-hidden hover:border-[#C9A96E] transition-colors flex gap-0"
    >
      <div className="relative w-28 shrink-0 overflow-hidden">
        <img
          src={activity.photos?.[0] || FALLBACK}
          alt={activity.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-4 flex flex-col justify-between flex-1 min-w-0">
        <div>
          <p className="font-sans text-[9px] tracking-[0.12em] uppercase text-[#C9A96E] mb-1">{activity.category}</p>
          <h3 className="font-display italic text-lg text-[#000000] leading-tight group-hover:text-[#C9A96E] transition-colors truncate">
            {activity.name}
          </h3>
        </div>
        <div className="flex items-center justify-between mt-2">
          {activity.pricePerPerson ? (
            <p className="font-display italic text-[#2d6a4f] text-sm">
              R {activity.pricePerPerson.toLocaleString()} <span className="font-sans text-[10px] text-gray-400">pp</span>
            </p>
          ) : (
            <p className="font-sans text-[10px] text-gray-400">Contact for rates</p>
          )}
          <StayDistance lat={activity.gpsLat} lng={activity.gpsLng} />
        </div>
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type StayWithPrice = { prop: Property; minPrice: number | null }

export default function RegionPage() {
  const { slug } = useParams() as { slug: string }
  const [region, setRegion] = useState<Region | null>(null)
  const [stays, setStays] = useState<StayWithPrice[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getRegions(),
      getProperties(),
      getTrails(),
      getActivities(),
    ]).then(async ([regions, properties, allTrails, allActivities]) => {
      const r = regions.find(r => r.slug === slug || r.id === slug)
      setRegion(r ?? null)

      if (r) {
        // Stays in this region with min room price
        const regionProps = properties.filter(
          p => p.status === 'active' && regionsMatch(p.region, r.name)
        )
        const staysWithPrice: StayWithPrice[] = await Promise.all(
          regionProps.map(async prop => {
            const rooms = await getRoomsByProperty(prop.id).catch(() => [])
            const minPrice = rooms.length > 0 ? Math.min(...rooms.map(rm => rm.basePrice)) : null
            return { prop, minPrice }
          })
        )
        setStays(staysWithPrice)

        // Trails & activities for this region
        setTrails(allTrails.filter(t => t.status === 'published' && regionsMatch(t.region, r.name)))
        setActivities(allActivities.filter(a => a.status === 'active' && regionsMatch(a.region, r.name)))
      }

      setLoading(false)
    })
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-mist pt-16 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!region) {
    return (
      <div className="min-h-screen bg-mist pt-16 flex flex-col items-center justify-center gap-4">
        <p className="font-display italic text-3xl text-gray-300">Region not found</p>
        <Link href="/regions" className="font-sans text-sm text-[#2d6a4f] hover:underline">← All regions</Link>
      </div>
    )
  }

  const heroImg = region.heroImage || FALLBACK

  return (
    <main className="bg-[#F7F5F2]">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative h-[70vh] min-h-[480px] overflow-hidden">
        <img src={heroImg} alt={region.name} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />

        {/* Breadcrumb */}
        <div className="absolute top-20 left-0 right-0 px-6 lg:px-12">
          <nav className="flex items-center gap-2 font-sans text-[11px] text-white/50 max-w-[1440px] mx-auto">
            <Link href="/" className="hover:text-white/80 transition-colors">Home</Link>
            <ChevronRight size={12} />
            <Link href="/regions" className="hover:text-white/80 transition-colors">Regions</Link>
            <ChevronRight size={12} />
            <span className="text-white/80">{region.name}</span>
          </nav>
        </div>

        {/* Caption */}
        <div className="absolute bottom-0 left-0 right-0 px-6 lg:px-12 pb-12 max-w-[1440px] mx-auto">
          <p className="font-sans text-[11px] tracking-[0.22em] uppercase text-[#C9A96E] mb-3">Drakensberg Region</p>
          <h1 className="font-display italic text-5xl lg:text-7xl text-white leading-none mb-3">{region.name}</h1>
          {region.tagline && (
            <p className="font-sans text-base text-white/60 max-w-lg">{region.tagline}</p>
          )}
        </div>
      </section>

      {/* ── Overview + quick stats ────────────────────────────────────────── */}
      <section className="bg-white py-14">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-[2fr_1fr] gap-12 items-start">
            <div>
              <p className="font-sans text-base text-forest/70 leading-relaxed mb-8">
                {region.overview || region.seoDescription}
              </p>
              {region.highlights.length > 0 && (
                <div>
                  <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-3">Highlights</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {region.highlights.map(h => (
                      <li key={h} className="flex items-center gap-3 font-sans text-sm text-forest/70">
                        <span className="w-1 h-1 rounded-full bg-[#C9A96E] shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="space-y-0">
              <div className="bg-[#F7F5F2] p-5 border-b border-white">
                <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-1">Stays Available</p>
                <p className="font-display italic text-3xl text-[#2d6a4f]">{stays.length}</p>
              </div>
              <div className="bg-[#F7F5F2] p-5 border-b border-white">
                <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-1">Hikes & Trails</p>
                <p className="font-display italic text-3xl text-[#2d6a4f]">{trails.length}</p>
              </div>
              <div className="bg-[#F7F5F2] p-5">
                <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gray-400 mb-1">Activities</p>
                <p className="font-display italic text-3xl text-[#2d6a4f]">{activities.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stays ─────────────────────────────────────────────────────────── */}
      {stays.length > 0 && (
        <section className="py-16 bg-[#F7F5F2]">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
            <SectionHeading
              icon={<Home size={20} />}
              label={`Stay in ${region.name}`}
              count={stays.length}
            />
            <p className="font-sans text-sm text-gray-400 mb-8 -mt-2">
              Pick a stay first — distance chips on trails and activities below will update to show how far each is from your chosen lodge.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {stays.map(({ prop, minPrice }) => (
                <StayCard key={prop.id} prop={prop} minPrice={minPrice} />
              ))}
            </div>
            <div className="mt-6">
              <Link
                href={`/stays?region=${encodeURIComponent(region.name)}`}
                className="inline-flex items-center gap-2 font-sans text-sm text-[#2d6a4f] hover:underline"
              >
                Browse all stays in {region.name} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Trails & Hikes ────────────────────────────────────────────────── */}
      {trails.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
            <SectionHeading
              icon={<Mountain size={20} />}
              label="Trails & Hikes"
              count={trails.length}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trails.map(trail => (
                <TrailCard key={trail.id} trail={trail} />
              ))}
            </div>
            <div className="mt-6">
              <Link
                href={`/hikes?region=${encodeURIComponent(region.name)}`}
                className="inline-flex items-center gap-2 font-sans text-sm text-[#2d6a4f] hover:underline"
              >
                All hikes in {region.name} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Activities ────────────────────────────────────────────────────── */}
      {activities.length > 0 && (
        <section className="py-16 bg-[#F7F5F2]">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
            <SectionHeading
              icon={<Zap size={20} />}
              label="Activities & Experiences"
              count={activities.length}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activities.map(activity => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
            <div className="mt-6">
              <Link
                href={`/activities?region=${encodeURIComponent(region.name)}`}
                className="inline-flex items-center gap-2 font-sans text-sm text-[#C9A96E] hover:underline"
              >
                All activities in {region.name} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {stays.length === 0 && trails.length === 0 && activities.length === 0 && (
        <section className="py-24">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-12 text-center">
            <p className="font-display italic text-3xl text-gray-300 mb-3">Coming soon</p>
            <p className="font-sans text-sm text-gray-400 mb-6">
              Stays, trails and activities for {region.name} are being added — check back soon.
            </p>
            <Link href="/stays" className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">
              Browse all stays
            </Link>
          </div>
        </section>
      )}

      {/* ── Subregions ───────────────────────────────────────────────────── */}
      {region.subregions && region.subregions.length > 0 && (
        <section className="py-16 bg-forest">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
            <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-white/30 mb-3">Explore within {region.name}</p>
            <h2 className="font-display italic text-4xl text-white mb-8">Subregions</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {region.subregions.map(s => (
                <div key={s.id} className="border border-white/10 p-5 hover:border-gold/40 transition-colors">
                  <h3 className="font-display italic text-xl text-white mb-2">{s.name}</h3>
                  {s.description && (
                    <p className="font-sans text-sm text-white/50 leading-relaxed">{s.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA strip ─────────────────────────────────────────────────────── */}
      <section className="bg-[#C9A96E] py-12">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-display italic text-2xl text-white">Ready to explore {region.name}?</p>
            <p className="font-sans text-sm text-white/70 mt-1">Book a stay and let us recommend trails and activities nearby.</p>
          </div>
          <Link
            href={`/stays?region=${encodeURIComponent(region.name)}`}
            className="shrink-0 bg-white text-[#2d6a4f] px-8 py-3 font-sans text-sm font-semibold hover:bg-[#F7F5F2] transition-colors inline-flex items-center gap-2"
          >
            Find a Stay <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* ── Back to all regions ───────────────────────────────────────────── */}
      <div className="bg-white border-t border-gray-100 py-6">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <Link href="/regions" className="font-sans text-sm text-gray-400 hover:text-[#2d6a4f] transition-colors flex items-center gap-2">
            ← Back to all regions
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  )
}

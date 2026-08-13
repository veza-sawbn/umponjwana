'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import EditablePageHeader from '@/components/editor/EditablePageHeader'
import { getActivities, type Activity } from '@/lib/activities'
import { StayDistance } from '@/lib/stay-distance'
import { regionsMatch } from '@/lib/regions'

const CATEGORIES = [
  { label: 'All', slug: '' },
  { label: 'Adventure', slug: 'Adventure' },
  { label: 'Wildlife', slug: 'Wildlife' },
  { label: 'Cultural', slug: 'Cultural' },
  { label: 'Family', slug: 'Family' },
  { label: 'Wellness', slug: 'Wellness' },
]

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [regionFilter, setRegionFilter] = useState('')

  useEffect(() => {
    const regionParam = new URLSearchParams(window.location.search).get('region')
    if (regionParam) setRegionFilter(regionParam)
    getActivities()
      .then(items => setActivities(items.filter(a => a.status === 'active')))
      .finally(() => setLoading(false))
  }, [])

  const filtered = activities.filter(a =>
    (!category || a.category.toLowerCase() === category.toLowerCase()) &&
    (!regionFilter || regionsMatch(a.region, regionFilter))
  )

  return (
    <main className="bg-mist min-h-screen pt-16">
      <EditablePageHeader section="activities_page" />

      <section className="bg-white border-b border-black/8 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto flex gap-8 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              onClick={() => setCategory(c.slug)}
              className={`font-sans text-sm py-4 border-b-2 transition-all whitespace-nowrap ${
                category === c.slug
                  ? 'text-forest border-forest'
                  : 'text-forest/50 border-transparent hover:text-forest hover:border-forest'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        {loading ? (
          <p className="font-sans text-sm text-forest/50">Loading activities…</p>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-display italic text-2xl text-forest/30 mb-2">No activities {category ? `in ${category}` : 'yet'}</p>
            <p className="font-sans text-sm text-forest/50">
              {category ? 'Try another category, or ' : 'New experiences are added as suppliers publish them. '}
              <Link href="/search" className="text-forest underline hover:text-gold">browse everything</Link>.
            </p>
          </div>
        ) : (
          <>
            <p className="font-sans text-sm text-forest/50 mb-8">
              <span className="text-forest font-medium">{filtered.length}</span> experience{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {filtered.map((a) => {
                const durationLabel = [a.durationH && `${a.durationH}h`, a.durationM && `${a.durationM}m`].filter(Boolean).join(' ') || ''
                return (
                  <Link key={a.id} href={`/activities/${a.id}`} className="group block">
                    <div className="relative overflow-hidden aspect-square mb-4 bg-[#1a1a2e]">
                      {a.photos?.[0] && (
                        <img
                          src={a.photos[0]}
                          alt={a.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                      <span className="absolute top-3 left-3 font-sans text-[10px] tracking-[0.1em] uppercase bg-white/90 text-forest px-2.5 py-1">
                        {a.category}
                      </span>
                    </div>
                    <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">
                      {a.meetingPoint || 'Drakensberg'}{durationLabel ? ` · ${durationLabel}` : ''}
                    </p>
                    <StayDistance lat={a.gpsLat} lng={a.gpsLng} className="mb-1" />
                    <h3 className="font-display text-lg text-forest leading-snug mb-2 group-hover:text-sage transition-colors">{a.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="font-sans text-xs text-forest/40">{a.difficulty}</span>
                      <span className="font-display text-base text-forest">
                        R{a.pricePerPerson.toLocaleString()}<span className="font-sans text-xs text-forest/40"> /p</span>
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
      <Footer />
    </main>
  )
}

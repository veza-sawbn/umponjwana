'use client'
import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { PROPERTY_TYPES, propertyTypeSlug } from '@/lib/properties'
import { DEFAULT_REGIONS } from '@/lib/regions'
import { ROUTE_TYPES } from '@/lib/gpx'
import type { Trail } from '@/lib/trails'

/* ─── Trip-planning tools ───────────────────────────────────────────────────
   Homepage accordion of existing browse paths. Nothing here searches or books
   on its own: every link lands on an existing listing page, pre-filtered via a
   query parameter that page already reads (stays: ?type= / ?region=; hikes:
   ?category= / ?region= / ?difficulty= / ?route_type=; activities: ?region=).
   Where a page has a working form (the /search date search, the /shuttles
   transfer quote) the row links to it rather than duplicating it here. */

// The three canonical region names — the same values /regions passes as
// ?region= to /stays, /hikes and /activities.
const REGION_NAMES = DEFAULT_REGIONS.map(r => r.name)

// Mirrors the hikes listing's own tabs/filters (app/hikes/page.tsx).
const HIKE_CATEGORIES = [
  { value: 'day_hike', label: 'Day Hikes' },
  { value: 'multi_day_hike', label: 'Multi-Day Hikes' },
  { value: 'speciality_walk', label: 'Speciality Walks' },
]
const HIKE_DIFFICULTIES: Trail['difficulty'][] = ['Easy', 'Moderate', 'Strenuous', 'Extreme']

type LinkItem = { label: string; href: string }
type LinkGroup = { title: string; links: LinkItem[] }
type ToolRow = { id: string; title: string; summary: string; groups: LinkGroup[]; primary: LinkItem[] }

const ROWS: ToolRow[] = [
  {
    id: 'stays',
    title: 'Find a Stay',
    summary: 'Browse accommodation by type or region.',
    groups: [
      {
        title: 'Accommodation type',
        links: PROPERTY_TYPES.map(t => ({ label: t, href: `/stays?type=${propertyTypeSlug(t)}` })),
      },
      {
        title: 'By region',
        links: REGION_NAMES.map(name => ({ label: name, href: `/stays?region=${encodeURIComponent(name)}` })),
      },
    ],
    primary: [
      { label: 'All accommodation', href: '/stays' },
      { label: 'Search with dates & guests', href: '/search' },
    ],
  },
  {
    id: 'hikes',
    title: 'Hikes & Trails',
    summary: 'Filter trails by type, difficulty, route and region.',
    groups: [
      {
        title: 'Trail type',
        links: HIKE_CATEGORIES.map(c => ({ label: c.label, href: `/hikes?category=${c.value}` })),
      },
      {
        title: 'Difficulty',
        links: HIKE_DIFFICULTIES.map(d => ({ label: d, href: `/hikes?difficulty=${encodeURIComponent(d)}` })),
      },
      {
        title: 'Route',
        links: ROUTE_TYPES.map(r => ({ label: r, href: `/hikes?route_type=${encodeURIComponent(r)}` })),
      },
      {
        title: 'By region',
        links: REGION_NAMES.map(name => ({ label: name, href: `/hikes?region=${encodeURIComponent(name)}` })),
      },
    ],
    primary: [{ label: 'All hikes', href: '/hikes' }],
  },
  {
    id: 'activities',
    title: 'Activities & Tours',
    summary: 'Guided experiences, tours and events.',
    groups: [
      {
        title: 'Things to do',
        links: [
          { label: 'Activities', href: '/activities' },
          { label: 'Guided Tours', href: '/tours' },
          { label: 'Events', href: '/events' },
        ],
      },
      {
        title: 'Activities by region',
        links: REGION_NAMES.map(name => ({ label: name, href: `/activities?region=${encodeURIComponent(name)}` })),
      },
    ],
    primary: [{ label: 'All activities', href: '/activities' }],
  },
  {
    id: 'transport',
    title: 'Transport & Transfers',
    summary: 'Shuttle quotes and fixed-price routes.',
    groups: [
      {
        title: 'Getting around',
        links: [
          { label: 'Get a transfer quote', href: '/shuttles' },
          { label: 'Shuttle routes', href: '/transport' },
        ],
      },
    ],
    primary: [{ label: 'Plan a transfer', href: '/shuttles' }],
  },
  {
    id: 'packages',
    title: 'Packages & Itineraries',
    summary: 'Multi-day packages and trip planning.',
    groups: [
      {
        title: 'Ready-made',
        links: [
          { label: 'Curated Journeys', href: '/packages' },
          { label: 'Guided Tours', href: '/tours' },
        ],
      },
      {
        title: 'Build your own',
        links: [{ label: 'Trip Planner', href: '/plan' }],
      },
    ],
    primary: [{ label: 'All packages', href: '/packages' }],
  },
]

// Same pill anatomy as the /stays and /hikes filter pills.
const pillCls =
  'inline-block font-sans text-xs px-3 py-1.5 border bg-white border-black/15 text-forest/70 hover:border-forest hover:text-forest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest'

export default function TripPlanningTools() {
  const baseId = useId()
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const headerRefs = useRef<(HTMLButtonElement | null)[]>([])

  const toggle = (id: string) =>
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // WAI-ARIA accordion pattern: arrow keys / Home / End move between headers.
  function onHeaderKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = ROWS.length - 1
    const target =
      e.key === 'ArrowDown' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowUp' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (target === null) return
    e.preventDefault()
    headerRefs.current[target]?.focus()
  }

  return (
    <section aria-labelledby={`${baseId}-heading`} className="bg-white">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20">
        <div className="mb-10">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">Plan your trip</p>
          <h2 id={`${baseId}-heading`} className="font-display text-4xl text-forest">Trip-planning tools</h2>
        </div>

        <div className="border-t border-black/8">
          {ROWS.map((row, index) => {
            const isOpen = open.has(row.id)
            const headerId = `${baseId}-${row.id}-header`
            const panelId = `${baseId}-${row.id}-panel`
            return (
              <div key={row.id} className="border-b border-black/8">
                <h3>
                  <button
                    ref={el => { headerRefs.current[index] = el }}
                    id={headerId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(row.id)}
                    onKeyDown={e => onHeaderKeyDown(e, index)}
                    className="group w-full flex items-center justify-between gap-6 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest"
                  >
                    <span className="min-w-0">
                      <span className="block font-display text-2xl text-forest group-hover:text-sage transition-colors">{row.title}</span>
                      <span className="block font-sans text-sm text-forest/50 mt-1">{row.summary}</span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`w-5 h-5 shrink-0 text-forest/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </h3>
                <div id={panelId} role="region" aria-labelledby={headerId} hidden={!isOpen} className="pb-8">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    {row.groups.map(group => (
                      <div key={group.title}>
                        <p className="font-sans text-xs tracking-[0.15em] uppercase text-forest/40 mb-3">{group.title}</p>
                        <ul className="flex flex-wrap gap-2">
                          {group.links.map(link => (
                            <li key={link.href}>
                              <Link href={link.href} className={pillCls}>{link.label}</Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-5">
                    {row.primary.map(link => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="inline-flex items-center gap-2 font-sans text-sm text-forest/60 hover:text-forest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                      >
                        {link.label} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Loader2, Save, CheckCircle, ChevronUp, ChevronDown,
  ExternalLink, AlertTriangle, AlertCircle, TrendingUp,
} from 'lucide-react'
import { getTrails } from '@/lib/trails'
import { getProperties } from '@/lib/properties'
import { getActivities } from '@/lib/activities'
import { getRegions } from '@/lib/regions'
import { computeSeoHealth, scoreColor } from '@/lib/seo-health'
import { getSiteContent, setSiteContent } from '@/lib/site-content'

// ── Types ────────────────────────────────────────────────────────────────────

type KindKey = 'trail' | 'property' | 'activity' | 'region'

type EntityRow = {
  kind: KindKey
  kindLabel: string
  id: string
  name: string
  slug: string | undefined
  editPath: string
  score: number
  badge: string
  status: string
  isIndexable: boolean
  missingTitle: boolean
  missingDesc: boolean
  hasRelations: boolean
}

// Static-page SEO override types (existing functionality, kept as-is)
const STATIC_PAGES = [
  { id: 'home', label: 'Homepage', path: '/' },
  { id: 'stays', label: 'Stays Listing', path: '/stays' },
  { id: 'hikes', label: 'Hikes & Trails', path: '/hikes' },
  { id: 'activities', label: 'Activities', path: '/activities' },
  { id: 'events', label: 'Events', path: '/events' },
  { id: 'guides', label: 'Guides Directory', path: '/guides' },
  { id: 'mydrakensberg', label: 'MyDrakensberg', path: '/mydrakensberg' },
]

type PageSEO = { meta_title: string; meta_description: string; og_title: string; og_description: string; canonical: string }
type SEOOverrides = Record<string, PageSEO>
const EMPTY_PAGE: PageSEO = { meta_title: '', meta_description: '', og_title: '', og_description: '', canonical: '' }

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

type SortKey = 'score' | 'name' | 'kind'
type SortDir = 'asc' | 'desc'

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronUp size={12} className="text-gray-300 opacity-50" />
  return dir === 'asc'
    ? <ChevronUp size={12} className="text-[#2d6a4f]" />
    : <ChevronDown size={12} className="text-[#2d6a4f]" />
}

function ScoreBadge({ score, badge }: { score: number; badge: string }) {
  return (
    <span className={`font-sans text-[10px] font-semibold px-2 py-0.5 tabular-nums ${badge}`}>
      {score}/100
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'overview' | 'index' | 'overrides'

export default function AdminSEOPage() {
  const [tab, setTab] = useState<Tab>('overview')

  // Entity data
  const [rows, setRows] = useState<EntityRow[]>([])
  const [loading, setLoading] = useState(true)

  // Entity index controls
  const [kindFilter, setKindFilter] = useState<KindKey | 'all'>('all')
  const [bandFilter, setBandFilter] = useState<'all' | 'good' | 'warning' | 'critical'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Page overrides state (existing)
  const [activePage, setActivePage] = useState('home')
  const [seoOverrides, setSeoOverrides] = useState<SEOOverrides>({})
  const [overridesSaving, setOverridesSaving] = useState(false)
  const [overridesSaved, setOverridesSaved] = useState(false)
  const [overridesError, setOverridesError] = useState<string | null>(null)
  const [overridesLoading, setOverridesLoading] = useState(true)

  // Load all entities and compute scores
  useEffect(() => {
    async function load() {
      try {
        const [trails, properties, activities, regions] = await Promise.all([
          getTrails().catch(() => []),
          getProperties().catch(() => []),
          getActivities().catch(() => []),
          getRegions().catch(() => []),
        ])

        const built: EntityRow[] = [
          ...trails.map(t => {
            const health = computeSeoHealth({
              seoTitle: t.seoTitle,
              seoDescription: t.seoDescription,
              slug: t.slug,
              hasImage: !!t.image,
              contentLength: t.description?.length ?? 0,
              status: t.status,
              robotsIndex: t.robotsIndex,
            })
            const { badge } = scoreColor(health.score)
            return {
              kind: 'trail' as KindKey,
              kindLabel: 'Trail',
              id: t.id,
              name: t.name,
              slug: t.slug,
              editPath: '/admin/trails',
              score: health.score,
              badge,
              status: t.status ?? 'draft',
              isIndexable: t.robotsIndex !== false && t.status === 'published',
              missingTitle: !t.seoTitle,
              missingDesc: !t.seoDescription,
              hasRelations: !!(
                (t.relatedPropertyIds?.length ?? 0) > 0 ||
                (t.relatedActivityIds?.length ?? 0) > 0 ||
                (t.relatedTrailIds?.length ?? 0) > 0
              ),
            }
          }),
          ...properties.map(p => {
            const health = computeSeoHealth({
              seoTitle: p.seoTitle,
              seoDescription: p.seoDescription,
              slug: p.slug,
              hasImage: (p.photos?.length ?? 0) > 0,
              contentLength: p.description?.length ?? 0,
              status: p.status === 'active' ? 'published' : 'draft',
              robotsIndex: p.robotsIndex,
            })
            const { badge } = scoreColor(health.score)
            return {
              kind: 'property' as KindKey,
              kindLabel: 'Stay',
              id: p.id,
              name: p.name,
              slug: p.slug,
              editPath: '/admin/listings',
              score: health.score,
              badge,
              status: p.status ?? 'draft',
              isIndexable: p.robotsIndex !== false && p.status === 'active',
              missingTitle: !p.seoTitle,
              missingDesc: !p.seoDescription,
              hasRelations: !!(
                (p.relatedTrailIds?.length ?? 0) > 0 ||
                (p.relatedActivityIds?.length ?? 0) > 0
              ),
            }
          }),
          ...activities.map(a => {
            const health = computeSeoHealth({
              seoTitle: a.seoTitle,
              seoDescription: a.seoDescription,
              slug: a.slug,
              hasImage: (a.photos?.length ?? 0) > 0,
              contentLength: a.description?.length ?? 0,
              status: a.status === 'active' ? 'published' : 'draft',
              robotsIndex: a.robotsIndex,
            })
            const { badge } = scoreColor(health.score)
            return {
              kind: 'activity' as KindKey,
              kindLabel: 'Activity',
              id: a.id,
              name: a.name,
              slug: a.slug,
              editPath: '/admin/listings',
              score: health.score,
              badge,
              status: a.status ?? 'draft',
              isIndexable: a.robotsIndex !== false && a.status === 'active',
              missingTitle: !a.seoTitle,
              missingDesc: !a.seoDescription,
              hasRelations: !!(
                (a.relatedTrailIds?.length ?? 0) > 0 ||
                (a.relatedPropertyIds?.length ?? 0) > 0
              ),
            }
          }),
          ...regions.map(r => {
            const health = computeSeoHealth({
              seoTitle: r.seoTitle,
              seoDescription: r.seoDescription,
              slug: r.slug,
              hasImage: !!r.heroImage,
              contentLength: r.overview?.length ?? 0,
              status: 'published',
            })
            const { badge } = scoreColor(health.score)
            return {
              kind: 'region' as KindKey,
              kindLabel: 'Region',
              id: r.id,
              name: r.name,
              slug: r.slug,
              editPath: '/admin/regions',
              score: health.score,
              badge,
              status: 'published',
              isIndexable: true,
              missingTitle: !r.seoTitle,
              missingDesc: !r.seoDescription,
              hasRelations: false, // regions link outward, not inward via explicit edges
            }
          }),
        ]

        setRows(built)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Load static page overrides
  useEffect(() => {
    getSiteContent('seo_overrides')
      .then(data => setSeoOverrides((data as SEOOverrides) ?? {}))
      .catch(() => setOverridesError('Failed to load page overrides'))
      .finally(() => setOverridesLoading(false))
  }, [])

  // Derived stats
  const stats = useMemo(() => {
    const total = rows.length
    const good = rows.filter(r => r.score >= 75).length
    const warning = rows.filter(r => r.score >= 50 && r.score < 75).length
    const critical = rows.filter(r => r.score < 50).length
    const missingTitle = rows.filter(r => r.missingTitle).length
    const missingDesc = rows.filter(r => r.missingDesc).length
    const noRelations = rows.filter(r => !r.hasRelations && r.kind === 'trail').length
    const noSlug = rows.filter(r => !r.slug).length
    return { total, good, warning, critical, missingTitle, missingDesc, noRelations, noSlug }
  }, [rows])

  // Filtered + sorted entity index
  const filteredRows = useMemo(() => {
    let out = rows
    if (kindFilter !== 'all') out = out.filter(r => r.kind === kindFilter)
    if (bandFilter === 'good') out = out.filter(r => r.score >= 75)
    if (bandFilter === 'warning') out = out.filter(r => r.score >= 50 && r.score < 75)
    if (bandFilter === 'critical') out = out.filter(r => r.score < 50)

    return [...out].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'score') cmp = a.score - b.score
      else if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'kind') cmp = a.kindLabel.localeCompare(b.kindLabel)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, kindFilter, bandFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  // Page overrides save
  async function saveOverrides() {
    setOverridesSaving(true)
    setOverridesError(null)
    try {
      await setSiteContent('seo_overrides', seoOverrides as any)
      setOverridesSaved(true)
      setTimeout(() => setOverridesSaved(false), 2000)
    } catch {
      setOverridesError('Failed to save — check your connection and try again.')
    } finally {
      setOverridesSaving(false)
    }
  }

  const currentOverride: PageSEO =
    (seoOverrides[activePage] as PageSEO | undefined) ?? EMPTY_PAGE

  function updateOverride(field: keyof PageSEO, value: string) {
    setSeoOverrides(prev => ({
      ...prev,
      [activePage]: { ...currentOverride, [field]: value },
    }))
  }

  const KIND_LABELS: Record<KindKey, string> = {
    trail: 'Trail', property: 'Stay', activity: 'Activity', region: 'Region',
  }

  return (
    <div className="p-8 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
        <h1 className="font-display italic text-3xl text-[#000000]">SEO Dashboard</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-200 mb-8">
        {([
          ['overview', 'Overview'],
          ['index', 'Entity Index'],
          ['overrides', 'Page Overrides'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 font-sans text-sm border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-[#2d6a4f] text-[#2d6a4f]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-8">
          {loading ? (
            <div className="flex items-center gap-3 text-gray-400 font-sans text-sm py-12">
              <Loader2 size={16} className="animate-spin" /> Loading entity data…
            </div>
          ) : (
            <>
              {/* Health distribution bar */}
              <div>
                <p className={labelCls}>SEO Health Distribution — {stats.total} entities</p>
                <div className="flex h-3 rounded overflow-hidden bg-gray-100 mb-2">
                  {stats.total > 0 && (
                    <>
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${(stats.good / stats.total) * 100}%` }}
                      />
                      <div
                        className="bg-amber-400 h-full transition-all"
                        style={{ width: `${(stats.warning / stats.total) * 100}%` }}
                      />
                      <div
                        className="bg-red-400 h-full transition-all"
                        style={{ width: `${(stats.critical / stats.total) * 100}%` }}
                      />
                    </>
                  )}
                </div>
                <div className="flex gap-6 font-sans text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Good ≥75 ({stats.good})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Warning 50–74 ({stats.warning})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Critical &lt;50 ({stats.critical})</span>
                </div>
              </div>

              {/* Opportunity tiles */}
              <div>
                <p className={labelCls}>Opportunities</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Missing SEO Title',
                      value: stats.missingTitle,
                      icon: AlertCircle,
                      color: 'text-red-500',
                      bg: 'bg-red-50 border-red-100',
                      action: () => { setTab('index'); setBandFilter('critical') },
                    },
                    {
                      label: 'Missing Meta Description',
                      value: stats.missingDesc,
                      icon: AlertCircle,
                      color: 'text-amber-500',
                      bg: 'bg-amber-50 border-amber-100',
                      action: () => { setTab('index'); setBandFilter('critical') },
                    },
                    {
                      label: 'Trails with No Links',
                      value: stats.noRelations,
                      icon: AlertTriangle,
                      color: 'text-amber-600',
                      bg: 'bg-amber-50 border-amber-100',
                      action: () => { setTab('index'); setKindFilter('trail'); setBandFilter('all') },
                    },
                    {
                      label: 'Entities without Slug',
                      value: stats.noSlug,
                      icon: AlertTriangle,
                      color: 'text-amber-600',
                      bg: 'bg-amber-50 border-amber-100',
                      action: () => { setTab('index'); setBandFilter('all') },
                    },
                  ].map(tile => {
                    const Icon = tile.icon
                    return (
                      <button
                        key={tile.label}
                        onClick={tile.action}
                        className={`border p-4 text-left hover:opacity-90 transition-opacity ${tile.bg}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Icon size={16} className={tile.color} />
                          <span className={`font-sans text-2xl font-bold tabular-nums ${tile.value > 0 ? tile.color : 'text-emerald-600'}`}>
                            {tile.value}
                          </span>
                        </div>
                        <p className="font-sans text-xs text-gray-600">{tile.label}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Entity counts */}
              <div>
                <p className={labelCls}>Entity Counts</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['trail', 'property', 'activity', 'region'] as KindKey[]).map(kind => {
                    const count = rows.filter(r => r.kind === kind).length
                    const goodCount = rows.filter(r => r.kind === kind && r.score >= 75).length
                    return (
                      <button
                        key={kind}
                        onClick={() => { setTab('index'); setKindFilter(kind); setBandFilter('all') }}
                        className="bg-white border border-gray-200 p-4 text-left hover:border-[#2d6a4f] transition-colors"
                      >
                        <p className="font-display italic text-2xl">{count}</p>
                        <p className={labelCls + ' mb-0 mt-1'}>{KIND_LABELS[kind]}s</p>
                        <p className="font-sans text-[11px] text-gray-400 mt-1">
                          {goodCount} of {count} good health
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Orphan detector CTA */}
              <div className="bg-white border border-gray-200 p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-display italic text-lg text-[#000000] mb-0.5">Orphan Page Detector</p>
                  <p className="font-sans text-sm text-gray-500">
                    Find entities with few or no inbound links — the first signal that a page is hard to discover.
                  </p>
                </div>
                <Link
                  href="/admin/seo/orphans"
                  className="shrink-0 border border-[#2d6a4f] text-[#2d6a4f] px-5 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
                >
                  View orphan report →
                </Link>
              </div>

              {/* Score list — bottom 10 */}
              <div>
                <p className={labelCls}>Lowest-scoring entities</p>
                <div className="bg-white border border-gray-200 overflow-hidden">
                  {rows
                    .filter(r => r.isIndexable)
                    .sort((a, b) => a.score - b.score)
                    .slice(0, 10)
                    .map((r, i) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0 text-sm"
                      >
                        <span className="font-sans text-gray-300 tabular-nums w-5 text-right">{i + 1}</span>
                        <ScoreBadge score={r.score} badge={r.badge} />
                        <span className="font-sans text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500">{r.kindLabel}</span>
                        <span className="font-sans text-sm text-gray-800 flex-1 truncate">{r.name}</span>
                        <a
                          href={r.editPath}
                          className="font-sans text-[11px] text-[#2d6a4f] hover:underline flex items-center gap-1"
                        >
                          Edit <ExternalLink size={11} />
                        </a>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ENTITY INDEX TAB ──────────────────────────────────────────────── */}
      {tab === 'index' && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            <select
              value={kindFilter}
              onChange={e => setKindFilter(e.target.value as any)}
              className="border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2] focus:outline-none focus:border-[#2d6a4f]"
            >
              <option value="all">All types</option>
              {(['trail', 'property', 'activity', 'region'] as KindKey[]).map(k => (
                <option key={k} value={k}>{KIND_LABELS[k]}s</option>
              ))}
            </select>
            <select
              value={bandFilter}
              onChange={e => setBandFilter(e.target.value as any)}
              className="border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2] focus:outline-none focus:border-[#2d6a4f]"
            >
              <option value="all">All scores</option>
              <option value="good">Good ≥75</option>
              <option value="warning">Warning 50–74</option>
              <option value="critical">Critical &lt;50</option>
            </select>
            <span className="font-sans text-xs text-gray-400 self-center ml-auto">
              {filteredRows.length} of {rows.length} entities
            </span>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 text-gray-400 font-sans text-sm py-12">
              <Loader2 size={16} className="animate-spin" /> Loading entities…
            </div>
          ) : (
            <div className="bg-white border border-gray-200 overflow-x-auto">
              <table className="w-full font-sans text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-[#F7F5F2]">
                    <th className="text-left px-4 py-3">
                      <button
                        onClick={() => toggleSort('kind')}
                        className="flex items-center gap-1 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 hover:text-gray-600"
                      >
                        Type <SortIndicator active={sortKey === 'kind'} dir={sortDir} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3">
                      <button
                        onClick={() => toggleSort('name')}
                        className="flex items-center gap-1 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 hover:text-gray-600"
                      >
                        Name <SortIndicator active={sortKey === 'name'} dir={sortDir} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3">
                      <button
                        onClick={() => toggleSort('score')}
                        className="flex items-center gap-1 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 hover:text-gray-600"
                      >
                        Score <SortIndicator active={sortKey === 'score'} dir={sortDir} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Slug</th>
                    <th className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Gaps</th>
                    <th className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(r => (
                    <tr key={`${r.kind}:${r.id}`} className="border-b border-gray-100 last:border-0 hover:bg-[#F7F5F2] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-sans text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600">{r.kindLabel}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate">{r.name}</td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={r.score} badge={r.badge} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs max-w-[140px] truncate">
                        {r.slug ?? <span className="text-red-400 italic">missing</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {r.missingTitle && (
                            <span className="font-sans text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5">No title</span>
                          )}
                          {r.missingDesc && (
                            <span className="font-sans text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5">No desc</span>
                          )}
                          {!r.hasRelations && r.kind === 'trail' && (
                            <span className="font-sans text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5">No links</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-sans text-[10px] px-2 py-0.5 ${
                          r.isIndexable ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {r.isIndexable ? 'Indexable' : r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={r.editPath}
                          className="font-sans text-[11px] text-[#2d6a4f] hover:underline flex items-center gap-1 justify-end"
                        >
                          Edit <ExternalLink size={11} />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center font-sans text-sm text-gray-400">
                        No entities match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PAGE OVERRIDES TAB ───────────────────────────────────────────── */}
      {tab === 'overrides' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="font-sans text-sm text-gray-500">
              Static meta overrides for listing and hub pages. Entity detail pages use their own SEO fields set in each entity's editor.
            </p>
            <button
              onClick={saveOverrides}
              disabled={overridesSaving || overridesLoading}
              className={`inline-flex items-center gap-2 px-5 py-2.5 font-sans text-sm transition-colors disabled:opacity-50 ${
                overridesSaved
                  ? 'bg-[#2d6a4f] text-white'
                  : 'bg-[#C9A96E] text-[#1a1a1a] hover:bg-[#b8935e]'
              }`}
            >
              {overridesSaving
                ? <Loader2 size={15} className="animate-spin" />
                : overridesSaved
                ? <CheckCircle size={15} />
                : <Save size={15} />}
              {overridesSaving ? 'Saving…' : overridesSaved ? 'Saved' : 'Save Changes'}
            </button>
          </div>

          {overridesError && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 font-sans text-sm">
              {overridesError}
            </div>
          )}

          {overridesLoading ? (
            <div className="flex items-center gap-3 text-gray-400 font-sans text-sm py-12">
              <Loader2 size={16} className="animate-spin" /> Loading overrides…
            </div>
          ) : (
            <div className="flex gap-8">
              {/* Page selector */}
              <aside className="w-48 shrink-0">
                <div className="bg-white border border-gray-200 overflow-hidden">
                  {STATIC_PAGES.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setActivePage(p.id)}
                      className={`w-full text-left px-4 py-3 font-sans text-sm border-b border-gray-100 last:border-0 transition-colors ${
                        activePage === p.id
                          ? 'bg-[#2d6a4f] text-white'
                          : 'text-gray-600 hover:bg-[#F7F5F2]'
                      }`}
                    >
                      <p>{p.label}</p>
                      <p className={`text-xs mt-0.5 ${activePage === p.id ? 'text-white/50' : 'text-gray-400'}`}>
                        {p.path}
                      </p>
                    </button>
                  ))}
                </div>
              </aside>

              {/* Override form */}
              <div className="flex-1 space-y-6">
                <div className="bg-white border border-gray-200 p-6">
                  <h2 className="font-display italic text-xl mb-5">Meta Tags</h2>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className={labelCls} style={{ marginBottom: 0 }}>Meta Title</label>
                        <span className={`font-sans text-[10px] tabular-nums ${currentOverride.meta_title.length > 60 ? 'text-red-400' : 'text-gray-400'}`}>
                          {currentOverride.meta_title.length}/60
                        </span>
                      </div>
                      <input
                        value={currentOverride.meta_title}
                        onChange={e => updateOverride('meta_title', e.target.value)}
                        maxLength={70}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className={labelCls} style={{ marginBottom: 0 }}>Meta Description</label>
                        <span className={`font-sans text-[10px] tabular-nums ${currentOverride.meta_description.length > 160 ? 'text-red-400' : 'text-gray-400'}`}>
                          {currentOverride.meta_description.length}/160
                        </span>
                      </div>
                      <textarea
                        value={currentOverride.meta_description}
                        onChange={e => updateOverride('meta_description', e.target.value)}
                        maxLength={200}
                        rows={3}
                        className={`${inputCls} resize-none`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Canonical URL</label>
                      <input
                        value={currentOverride.canonical}
                        onChange={e => updateOverride('canonical', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-6">
                  <h2 className="font-display italic text-xl mb-5">Open Graph (Social)</h2>
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>OG Title</label>
                      <input
                        value={currentOverride.og_title}
                        onChange={e => updateOverride('og_title', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>OG Description</label>
                      <textarea
                        value={currentOverride.og_description}
                        onChange={e => updateOverride('og_description', e.target.value)}
                        rows={3}
                        className={`${inputCls} resize-none`}
                      />
                    </div>
                  </div>
                </div>

                {/* SERP preview */}
                <div className="bg-white border border-gray-200 p-6">
                  <h2 className="font-display italic text-xl mb-4">Search Preview</h2>
                  <div className="border border-gray-100 p-4 bg-[#F7F5F2] rounded">
                    <p className="font-sans text-xs text-[#006621] mb-1 truncate">
                      {currentOverride.canonical || `https://visitdrakensberg.com${STATIC_PAGES.find(p => p.id === activePage)?.path}`}
                    </p>
                    <p className="font-sans text-base text-[#1a0dab] mb-1 truncate">
                      {currentOverride.meta_title || 'Page title'}
                    </p>
                    <p className="font-sans text-sm text-gray-600 leading-relaxed line-clamp-2">
                      {currentOverride.meta_description || 'Page description will appear here.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

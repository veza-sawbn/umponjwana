'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Loader2, ChevronUp, ChevronDown, ExternalLink,
  GitBranch, LayoutList, Search,
} from 'lucide-react'
import { getTrails } from '@/lib/trails'
import type { Trail } from '@/lib/trails'
import { getProperties } from '@/lib/properties'
import type { Property } from '@/lib/properties'
import { getActivities } from '@/lib/activities'
import type { Activity } from '@/lib/activities'
import { getRegions, regionsMatch } from '@/lib/regions'
import type { Region } from '@/lib/regions'
import { computeSeoHealth, scoreColor } from '@/lib/seo-health'

// ── Types ─────────────────────────────────────────────────────────────────────

type KindKey = 'trail' | 'property' | 'activity' | 'region'
type ViewTab = 'tree' | 'index'
type SortKey = 'name' | 'kind' | 'score' | 'inbound'
type SortDir = 'asc' | 'desc'

type EntityNode = {
  kind: KindKey
  kindLabel: string
  id: string
  name: string
  slug: string | undefined
  region: string | undefined
  status: string
  score: number
  badge: string
  editPath: string
  isIndexable: boolean
  relatedTrailIds: string[]
  relatedPropertyIds: string[]
  relatedActivityIds: string[]
  explicitInbound: number
  structuralInbound: number
  totalInbound: number
}

type TreeSection = {
  label: string
  count?: number
  children?: string[]
  overflow?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

const KIND_LABELS: Record<KindKey, string> = {
  trail: 'Trail', property: 'Stay', activity: 'Activity', region: 'Region',
}

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

function buildTreeSections(
  selected: EntityNode,
  nodeById: Map<string, EntityNode>,
  regionChildren: { trails: EntityNode[]; properties: EntityNode[]; activities: EntityNode[] },
): TreeSection[] {
  if (selected.kind === 'region') {
    return [
      {
        label: 'Trails',
        count: regionChildren.trails.length,
        children: regionChildren.trails.slice(0, 5).map(t => t.name),
        overflow: regionChildren.trails.length > 5
          ? `… and ${regionChildren.trails.length - 5} more`
          : undefined,
      },
      { label: 'Stays', count: regionChildren.properties.length },
      { label: 'Activities', count: regionChildren.activities.length },
    ]
  }

  const sections: TreeSection[] = [
    { label: `Region: ${selected.region ?? '— none —'}` },
  ]

  if (selected.relatedTrailIds.length > 0) {
    const children = selected.relatedTrailIds.slice(0, 3)
      .map(id => nodeById.get(id)?.name ?? id)
    sections.push({
      label: 'Related Trails',
      count: selected.relatedTrailIds.length,
      children,
      overflow: selected.relatedTrailIds.length > 3
        ? `… and ${selected.relatedTrailIds.length - 3} more`
        : undefined,
    })
  }

  if (selected.relatedPropertyIds.length > 0) {
    const children = selected.relatedPropertyIds.slice(0, 3)
      .map(id => nodeById.get(id)?.name ?? id)
    sections.push({
      label: 'Related Stays',
      count: selected.relatedPropertyIds.length,
      children,
      overflow: selected.relatedPropertyIds.length > 3
        ? `… and ${selected.relatedPropertyIds.length - 3} more`
        : undefined,
    })
  }

  if (selected.relatedActivityIds.length > 0) {
    const children = selected.relatedActivityIds.slice(0, 3)
      .map(id => nodeById.get(id)?.name ?? id)
    sections.push({
      label: 'Related Activities',
      count: selected.relatedActivityIds.length,
      children,
      overflow: selected.relatedActivityIds.length > 3
        ? `… and ${selected.relatedActivityIds.length - 3} more`
        : undefined,
    })
  }

  return sections
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SeoGraphPage() {
  const [view, setView] = useState<ViewTab>('tree')
  const [nodes, setNodes] = useState<EntityNode[]>([])
  const [loading, setLoading] = useState(true)

  // Tree view state
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<KindKey | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Index view state
  const [idxKind, setIdxKind] = useState<KindKey | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('inbound')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    async function load() {
      try {
        const [trails, properties, activities, regions] = await Promise.all([
          getTrails().catch(() => [] as Trail[]),
          getProperties().catch(() => [] as Property[]),
          getActivities().catch(() => [] as Activity[]),
          getRegions().catch(() => [] as Region[]),
        ])

        // Build explicit inbound counts (same logic as orphan page)
        const inbound: Record<string, number> = {}
        function bump(ids: string[] | undefined) {
          for (const id of ids ?? []) {
            inbound[id] = (inbound[id] ?? 0) + 1
          }
        }
        for (const t of trails) {
          bump(t.relatedTrailIds)
          bump(t.relatedPropertyIds)
          bump(t.relatedActivityIds)
          bump(t.relatedTourIds)
        }
        for (const p of properties) {
          bump(p.relatedTrailIds)
          bump(p.relatedActivityIds)
        }
        for (const a of activities) {
          bump(a.relatedTrailIds)
          bump(a.relatedPropertyIds)
        }

        const built: EntityNode[] = [
          ...trails.map(t => {
            const health = computeSeoHealth({
              seoTitle: t.seoTitle, seoDescription: t.seoDescription, slug: t.slug,
              hasImage: !!t.image, contentLength: t.description?.length ?? 0,
              status: t.status, robotsIndex: t.robotsIndex,
            })
            const { badge } = scoreColor(health.score)
            const explicit = inbound[t.id] ?? 0
            const structural = (t.status === 'published' ? 1 : 0) + (t.region ? 1 : 0)
            return {
              kind: 'trail' as KindKey, kindLabel: 'Trail',
              id: t.id, name: t.name, slug: t.slug, region: t.region,
              status: t.status ?? 'draft', score: health.score, badge,
              editPath: '/admin/trails',
              isIndexable: t.robotsIndex !== false && t.status === 'published',
              relatedTrailIds: t.relatedTrailIds ?? [],
              relatedPropertyIds: t.relatedPropertyIds ?? [],
              relatedActivityIds: t.relatedActivityIds ?? [],
              explicitInbound: explicit, structuralInbound: structural,
              totalInbound: explicit + structural,
            }
          }),
          ...properties.map(p => {
            const health = computeSeoHealth({
              seoTitle: p.seoTitle, seoDescription: p.seoDescription, slug: p.slug,
              hasImage: (p.photos?.length ?? 0) > 0, contentLength: p.description?.length ?? 0,
              status: p.status === 'active' ? 'published' : 'draft', robotsIndex: p.robotsIndex,
            })
            const { badge } = scoreColor(health.score)
            const explicit = inbound[p.id] ?? 0
            const structural = (p.status === 'active' ? 1 : 0) + (p.region ? 1 : 0)
            return {
              kind: 'property' as KindKey, kindLabel: 'Stay',
              id: p.id, name: p.name, slug: p.slug, region: p.region,
              status: p.status ?? 'draft', score: health.score, badge,
              editPath: '/admin/listings',
              isIndexable: p.robotsIndex !== false && p.status === 'active',
              relatedTrailIds: p.relatedTrailIds ?? [],
              relatedPropertyIds: [],
              relatedActivityIds: p.relatedActivityIds ?? [],
              explicitInbound: explicit, structuralInbound: structural,
              totalInbound: explicit + structural,
            }
          }),
          ...activities.map(a => {
            const health = computeSeoHealth({
              seoTitle: a.seoTitle, seoDescription: a.seoDescription, slug: a.slug,
              hasImage: (a.photos?.length ?? 0) > 0, contentLength: a.description?.length ?? 0,
              status: a.status === 'active' ? 'published' : 'draft', robotsIndex: a.robotsIndex,
            })
            const { badge } = scoreColor(health.score)
            const explicit = inbound[a.id] ?? 0
            const structural = (a.status === 'active' ? 1 : 0) + (a.region ? 1 : 0)
            return {
              kind: 'activity' as KindKey, kindLabel: 'Activity',
              id: a.id, name: a.name, slug: a.slug, region: a.region,
              status: a.status ?? 'draft', score: health.score, badge,
              editPath: '/admin/listings',
              isIndexable: a.robotsIndex !== false && a.status === 'active',
              relatedTrailIds: a.relatedTrailIds ?? [],
              relatedPropertyIds: a.relatedPropertyIds ?? [],
              relatedActivityIds: [],
              explicitInbound: explicit, structuralInbound: structural,
              totalInbound: explicit + structural,
            }
          }),
          ...regions.map(r => {
            const health = computeSeoHealth({
              seoTitle: r.seoTitle, seoDescription: r.seoDescription, slug: r.slug,
              hasImage: !!r.heroImage, contentLength: r.overview?.length ?? 0, status: 'published',
            })
            const { badge } = scoreColor(health.score)
            return {
              kind: 'region' as KindKey, kindLabel: 'Region',
              id: r.id, name: r.name, slug: r.slug, region: undefined,
              status: 'published', score: health.score, badge,
              editPath: '/admin/regions', isIndexable: true,
              relatedTrailIds: [], relatedPropertyIds: [], relatedActivityIds: [],
              explicitInbound: 0, structuralInbound: 2, totalInbound: 2,
            }
          }),
        ]

        setNodes(built)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Fast ID lookup
  const nodeById = useMemo(() => {
    const m = new Map<string, EntityNode>()
    for (const n of nodes) m.set(n.id, n)
    return m
  }, [nodes])

  // Filtered entity list for the tree sidebar
  const treeList = useMemo(() => {
    let out = nodes
    if (kindFilter !== 'all') out = out.filter(n => n.kind === kindFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(n => n.name.toLowerCase().includes(q))
    }
    return [...out].sort((a, b) => a.name.localeCompare(b.name))
  }, [nodes, kindFilter, search])

  const selected = selectedId ? nodeById.get(selectedId) : null

  // Entities that explicitly link TO the selected entity
  const inboundEntities = useMemo(() => {
    if (!selected) return []
    return nodes.filter(n =>
      n.relatedTrailIds.includes(selected.id) ||
      n.relatedPropertyIds.includes(selected.id) ||
      n.relatedActivityIds.includes(selected.id)
    )
  }, [nodes, selected])

  // For a selected region: entities whose region field matches this region
  const regionChildren = useMemo(() => {
    if (!selected || selected.kind !== 'region') {
      return { trails: [] as EntityNode[], properties: [] as EntityNode[], activities: [] as EntityNode[] }
    }
    return {
      trails: nodes.filter(n => n.kind === 'trail' && regionsMatch(n.region, selected.name)),
      properties: nodes.filter(n => n.kind === 'property' && regionsMatch(n.region, selected.name)),
      activities: nodes.filter(n => n.kind === 'activity' && regionsMatch(n.region, selected.name)),
    }
  }, [nodes, selected])

  const treeSections = useMemo(
    () => selected ? buildTreeSections(selected, nodeById, regionChildren) : [],
    [selected, nodeById, regionChildren],
  )

  // Index sort
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const indexRows = useMemo(() => {
    let out = nodes
    if (idxKind !== 'all') out = out.filter(n => n.kind === idxKind)
    return [...out].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'kind') cmp = a.kindLabel.localeCompare(b.kindLabel)
      else if (sortKey === 'score') cmp = a.score - b.score
      else cmp = a.totalInbound - b.totalInbound
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [nodes, idxKind, sortKey, sortDir])

  return (
    <div className="p-8 min-h-screen">

      {/* Breadcrumb + header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/admin/seo"
            className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 hover:text-[#2d6a4f] transition-colors"
          >
            SEO Dashboard
          </Link>
          <span className="text-gray-300 text-xs">›</span>
          <span className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-500">
            Relationship Graph
          </span>
        </div>
        <h1 className="font-display italic text-3xl text-[#000000]">Relationship Graph</h1>
        <p className="font-sans text-sm text-gray-500 mt-1">
          Explore entity connections and find pages with few inbound links.
        </p>
      </div>

      {/* View tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-8">
        {([
          ['tree', 'Relationship Tree', GitBranch],
          ['index', 'Entity Index', LayoutList],
        ] as [ViewTab, string, typeof GitBranch][]).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setView(key as ViewTab)}
            className={`flex items-center gap-2 px-5 py-2.5 font-sans text-sm border-b-2 -mb-px transition-colors ${
              view === key
                ? 'border-[#2d6a4f] text-[#2d6a4f]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-400 font-sans text-sm py-12">
          <Loader2 size={16} className="animate-spin" /> Building relationship graph…
        </div>
      ) : (
        <>
          {/* ── RELATIONSHIP TREE ────────────────────────────────────────────── */}
          {view === 'tree' && (
            <div className="flex gap-6" style={{ minHeight: '560px' }}>

              {/* Entity picker sidebar */}
              <aside className="w-64 shrink-0">
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search entities…"
                      className="w-full border border-gray-200 pl-8 pr-3 py-2 font-sans text-sm bg-[#F7F5F2] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                  <select
                    value={kindFilter}
                    onChange={e => setKindFilter(e.target.value as KindKey | 'all')}
                    className="border border-gray-200 px-2 py-2 font-sans text-xs bg-[#F7F5F2] focus:outline-none focus:border-[#2d6a4f]"
                  >
                    <option value="all">All</option>
                    {(['trail', 'property', 'activity', 'region'] as KindKey[]).map(k => (
                      <option key={k} value={k}>{KIND_LABELS[k]}s</option>
                    ))}
                  </select>
                </div>

                <div className="bg-white border border-gray-200 overflow-y-auto" style={{ maxHeight: '620px' }}>
                  {treeList.length === 0 ? (
                    <p className="px-4 py-8 text-center font-sans text-xs text-gray-400">No entities match</p>
                  ) : treeList.map(n => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedId(n.id)}
                      className={`w-full text-left px-4 py-2.5 border-b border-gray-100 last:border-0 transition-colors ${
                        selectedId === n.id
                          ? 'bg-[#2d6a4f] text-white'
                          : 'text-gray-700 hover:bg-[#F7F5F2]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-sans text-sm truncate">{n.name}</span>
                        <span className={`font-sans text-[10px] px-1.5 py-0.5 shrink-0 ${
                          selectedId === n.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {n.kindLabel}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              {/* Tree panel */}
              <div className="flex-1">
                {!selected ? (
                  <div className="border border-gray-200 bg-white h-full flex items-center justify-center text-center p-12">
                    <div>
                      <GitBranch size={32} className="text-gray-200 mx-auto mb-3" />
                      <p className="font-sans text-sm text-gray-400">Select an entity to view its relationship tree</p>
                      <p className="font-sans text-xs text-gray-300 mt-1">
                        Use the index tab to find entities sorted by inbound links
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 p-6">

                    {/* Entity header */}
                    <div className="flex items-start justify-between gap-4 mb-6 pb-5 border-b border-gray-100">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-sans text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600">{selected.kindLabel}</span>
                          <ScoreBadge score={selected.score} badge={selected.badge} />
                          <span className={`font-sans text-[10px] px-2 py-0.5 ${
                            selected.isIndexable ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {selected.isIndexable ? 'Indexable' : selected.status}
                          </span>
                        </div>
                        <h2 className="font-display italic text-2xl text-[#000000]">{selected.name}</h2>
                        {selected.slug && (
                          <p className="font-mono text-xs text-gray-400 mt-0.5">/{selected.slug}</p>
                        )}
                      </div>
                      <a
                        href={selected.editPath}
                        className="shrink-0 border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2 font-sans text-xs hover:bg-[#2d6a4f] hover:text-white transition-colors flex items-center gap-1.5"
                      >
                        Edit <ExternalLink size={12} />
                      </a>
                    </div>

                    {/* Text tree */}
                    <div className="space-y-0.5 mb-6">
                      <p className="font-mono text-sm font-semibold text-gray-800 mb-2">
                        {selected.name.toUpperCase()}
                        <span className="font-normal text-gray-400 ml-2">({selected.kindLabel})</span>
                      </p>

                      {treeSections.length === 0 ? (
                        <p className="font-sans text-xs text-gray-400 italic pl-4">
                          No outgoing relationships recorded yet.
                        </p>
                      ) : treeSections.map((sec, i) => {
                        const isLast = i === treeSections.length - 1
                        const connector = isLast ? '└──' : '├──'
                        const childRail = isLast ? ' ' : '│'

                        return (
                          <div key={i}>
                            <div className="font-mono text-sm leading-6">
                              <span className="text-gray-300 select-none">{connector} </span>
                              <span className="text-gray-700">{sec.label}</span>
                              {sec.count !== undefined && (
                                <span className="text-gray-400"> ({sec.count})</span>
                              )}
                            </div>

                            {sec.children?.map((child, j) => {
                              const childIsLast = j === (sec.children!.length - 1) && !sec.overflow
                              const childConnector = childIsLast ? '└──' : '├──'
                              return (
                                <div key={j} className="font-mono text-sm leading-6">
                                  <span className="text-gray-300 select-none">
                                    {childRail}{'   '}{childConnector}{' '}
                                  </span>
                                  <span className="text-gray-600">{child}</span>
                                </div>
                              )
                            })}

                            {sec.overflow && (
                              <div className="font-mono text-sm leading-6">
                                <span className="text-gray-300 select-none">
                                  {childRail}{'   └── '}
                                </span>
                                <span className="text-gray-400 italic">{sec.overflow}</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Inbound links */}
                    <div className="pt-5 border-t border-gray-100">
                      <div className="flex items-center gap-3 mb-3">
                        <p className={labelCls} style={{ marginBottom: 0 }}>Inbound Links</p>
                        <span className={`font-sans text-xs font-semibold tabular-nums ${
                          selected.totalInbound === 0 ? 'text-red-500'
                          : selected.totalInbound <= 2 ? 'text-amber-600'
                          : 'text-emerald-700'
                        }`}>
                          {selected.totalInbound} total
                        </span>
                        <span className="font-sans text-[11px] text-gray-400">
                          {selected.explicitInbound} explicit · {selected.structuralInbound} structural
                        </span>
                      </div>

                      {inboundEntities.length > 0 ? (
                        <div className="space-y-0.5">
                          {inboundEntities.slice(0, 8).map((n, i) => {
                            const isLast = i === Math.min(7, inboundEntities.length - 1) && inboundEntities.length <= 8
                            return (
                              <div key={n.id} className="font-mono text-sm leading-6">
                                <span className="text-gray-300 select-none">{isLast ? '└── ' : '├── '}</span>
                                <span className="text-gray-700">{n.name}</span>
                                <span className="text-gray-400 text-xs ml-1">({n.kindLabel})</span>
                              </div>
                            )
                          })}
                          {inboundEntities.length > 8 && (
                            <div className="font-mono text-sm leading-6">
                              <span className="text-gray-300 select-none">└── </span>
                              <span className="text-gray-400 italic">… and {inboundEntities.length - 8} more</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="font-sans text-xs text-gray-400 italic">
                          No explicit inbound links yet — only structural (listing page + region parent).
                          {selected.kind !== 'region' && (
                            <> Use the <a href="/admin/trails" className="underline hover:text-[#2d6a4f]">trail editor</a> or the <a href="/admin/seo/orphans" className="underline hover:text-[#2d6a4f]">orphan report</a> to add links.</>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ENTITY INDEX ─────────────────────────────────────────────────── */}
          {view === 'index' && (
            <div>
              <div className="flex flex-wrap gap-3 mb-5 items-center">
                <select
                  value={idxKind}
                  onChange={e => setIdxKind(e.target.value as KindKey | 'all')}
                  className="border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2] focus:outline-none focus:border-[#2d6a4f]"
                >
                  <option value="all">All types</option>
                  {(['trail', 'property', 'activity', 'region'] as KindKey[]).map(k => (
                    <option key={k} value={k}>{KIND_LABELS[k]}s</option>
                  ))}
                </select>
                <span className="font-sans text-xs text-gray-400 ml-auto">
                  {indexRows.length} entities — click any row to view its tree
                </span>
              </div>

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
                      <th className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">
                        Slug
                      </th>
                      <th className="text-left px-4 py-3">
                        <button
                          onClick={() => toggleSort('score')}
                          className="flex items-center gap-1 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 hover:text-gray-600"
                        >
                          Health <SortIndicator active={sortKey === 'score'} dir={sortDir} />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3">
                        <button
                          onClick={() => toggleSort('inbound')}
                          className="flex items-center gap-1 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 hover:text-gray-600"
                        >
                          Inbound <SortIndicator active={sortKey === 'inbound'} dir={sortDir} />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">
                        Status
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {indexRows.map(n => (
                      <tr
                        key={`${n.kind}:${n.id}`}
                        className="border-b border-gray-100 last:border-0 hover:bg-[#F7F5F2] transition-colors cursor-pointer"
                        onClick={() => { setView('tree'); setSelectedId(n.id); setSearch('') }}
                      >
                        <td className="px-4 py-3">
                          <span className="font-sans text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600">
                            {n.kindLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate">{n.name}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs max-w-[140px] truncate">
                          {n.slug ?? <span className="text-red-400 italic">missing</span>}
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBadge score={n.score} badge={n.badge} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-sans text-sm tabular-nums font-semibold ${
                            n.totalInbound === 0 ? 'text-red-500'
                            : n.totalInbound <= 2 ? 'text-amber-600'
                            : 'text-emerald-700'
                          }`}>
                            {n.totalInbound}
                          </span>
                          {n.explicitInbound > 0 && (
                            <span className="font-sans text-[10px] text-gray-400 ml-1.5">
                              ({n.explicitInbound} explicit)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-sans text-[10px] px-2 py-0.5 ${
                            n.isIndexable ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {n.isIndexable ? 'Indexable' : n.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={n.editPath}
                            onClick={e => e.stopPropagation()}
                            className="font-sans text-[11px] text-[#2d6a4f] hover:underline flex items-center gap-1 justify-end"
                          >
                            Edit <ExternalLink size={11} />
                          </a>
                        </td>
                      </tr>
                    ))}
                    {indexRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center font-sans text-sm text-gray-400">
                          No entities match the selected filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

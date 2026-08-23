'use client'

/**
 * Tool 7 — Orphan Page Detector
 *
 * Builds a two-layer inbound-link graph from the entity store:
 *
 *   Explicit  — another entity carries this entity's ID in a related*Ids[]
 *               field (admin-curated graph edges written by Phase 8).
 *
 *   Structural — the entity appears on a listing page (/hikes, /stays,
 *               /activities) when published (+1), and has a region set so
 *               the region detail page links to it (+1). These are weak
 *               but real; the first run would be uniformly red without them.
 *
 * Tiers:
 *   Orphan      — 0 explicit + 0 structural
 *   Near-orphan — 0–1 explicit and (explicit + structural) ≤ 2
 *   No parent   — trail / stay / activity with no region set
 *   No outgoing — 0 outgoing explicit edges (no related*Ids[] populated)
 *
 * Each entity can appear in multiple tiers. The "Orphans" tab is the
 * primary worklist — every entity there needs at least one explicit link
 * added via the entity editor (Phase 8's RelationshipPicker).
 */

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, AlertTriangle,
  CheckCircle, ExternalLink,
} from 'lucide-react'
import { getTrails } from '@/lib/trails'
import { getProperties } from '@/lib/properties'
import { getActivities } from '@/lib/activities'
import { getRegions } from '@/lib/regions'

// ── Types ─────────────────────────────────────────────────────────────────────

type KindKey = 'trail' | 'property' | 'activity' | 'region'

type OrphanRow = {
  kind: KindKey
  kindLabel: string
  id: string
  name: string
  slug: string | undefined
  region: string | undefined
  editPath: string
  status: string
  /** Links *to* this entity from other entities' related*Ids[] */
  explicitInbound: number
  /** Region membership + listing-page membership (weak structural links) */
  structuralInbound: number
  totalInbound: number
  /** Non-empty related*Ids[] on this entity pointing outward */
  explicitOutgoing: number
}

type Tier = 'all' | 'orphan' | 'near-orphan' | 'no-parent' | 'no-outgoing'

const labelCls = 'font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400'

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OrphansPage() {
  const [rows, setRows] = useState<OrphanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<Tier>('orphan')

  useEffect(() => {
    async function load() {
      try {
        const [trails, properties, activities, regions] = await Promise.all([
          getTrails().catch(() => []),
          getProperties().catch(() => []),
          getActivities().catch(() => []),
          getRegions().catch(() => []),
        ])

        // ── Build explicit inbound-link map ────────────────────────────────
        // key = entity id, value = number of other entities that reference it
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
          bump(p.relatedPropertyIds)
          bump(p.relatedActivityIds)
        }
        for (const a of activities) {
          bump(a.relatedTrailIds)
          bump(a.relatedPropertyIds)
          bump(a.relatedActivityIds)
        }
        // Regions: not inbound-linked via explicit IDs in the current graph

        // ── Build rows ────────────────────────────────────────────────────
        const built: OrphanRow[] = []

        for (const t of trails) {
          const explicit = inbound[t.id] ?? 0
          // Structural: +1 if listed (published), +1 if region set
          const structural =
            (t.status === 'published' ? 1 : 0) +
            (t.region ? 1 : 0)
          const outgoing =
            (t.relatedTrailIds?.length ?? 0) +
            (t.relatedPropertyIds?.length ?? 0) +
            (t.relatedActivityIds?.length ?? 0) +
            (t.relatedTourIds?.length ?? 0)

          built.push({
            kind: 'trail',
            kindLabel: 'Trail',
            id: t.id,
            name: t.name,
            slug: t.slug,
            region: t.region,
            editPath: '/admin/trails',
            status: t.status ?? 'draft',
            explicitInbound: explicit,
            structuralInbound: structural,
            totalInbound: explicit + structural,
            explicitOutgoing: outgoing,
          })
        }

        for (const p of properties) {
          const explicit = inbound[p.id] ?? 0
          const structural =
            (p.status === 'active' ? 1 : 0) +
            (p.region ? 1 : 0)
          const outgoing =
            (p.relatedTrailIds?.length ?? 0) +
            (p.relatedPropertyIds?.length ?? 0) +
            (p.relatedActivityIds?.length ?? 0)

          built.push({
            kind: 'property',
            kindLabel: 'Stay',
            id: p.id,
            name: p.name,
            slug: p.slug,
            region: p.region,
            editPath: '/admin/listings',
            status: p.status ?? 'draft',
            explicitInbound: explicit,
            structuralInbound: structural,
            totalInbound: explicit + structural,
            explicitOutgoing: outgoing,
          })
        }

        for (const a of activities) {
          const explicit = inbound[a.id] ?? 0
          const structural =
            (a.status === 'active' ? 1 : 0) +
            (a.region ? 1 : 0)
          const outgoing =
            (a.relatedTrailIds?.length ?? 0) +
            (a.relatedPropertyIds?.length ?? 0) +
            (a.relatedActivityIds?.length ?? 0)

          built.push({
            kind: 'activity',
            kindLabel: 'Activity',
            id: a.id,
            name: a.name,
            slug: a.slug,
            region: a.region,
            editPath: '/admin/listings',
            status: a.status ?? 'draft',
            explicitInbound: explicit,
            structuralInbound: structural,
            totalInbound: explicit + structural,
            explicitOutgoing: outgoing,
          })
        }

        for (const r of regions) {
          // Regions are hub pages — they inherently link outward to their
          // entities. Inbound links come from trails/stays/activities listing
          // pages and from the global navigation (always ≥ 2 structural).
          built.push({
            kind: 'region',
            kindLabel: 'Region',
            id: r.id,
            name: r.name,
            slug: r.slug,
            region: undefined,
            editPath: '/admin/regions',
            status: 'published',
            explicitInbound: inbound[r.id] ?? 0,
            structuralInbound: 2, // nav + listing hub
            totalInbound: (inbound[r.id] ?? 0) + 2,
            explicitOutgoing: 0, // regions link outward structurally, not via explicit IDs
          })
        }

        setRows(built)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Derived tiers ──────────────────────────────────────────────────────────

  const tierRows = useMemo(() => {
    switch (tier) {
      case 'orphan':
        return rows.filter(r => r.explicitInbound === 0 && r.structuralInbound === 0)
      case 'near-orphan':
        return rows.filter(r => r.totalInbound > 0 && r.totalInbound <= 2 && r.explicitInbound <= 1)
      case 'no-parent':
        return rows.filter(r => r.kind !== 'region' && !r.region)
      case 'no-outgoing':
        return rows.filter(r => r.explicitOutgoing === 0 && r.kind !== 'region')
      default:
        return rows
    }
  }, [rows, tier])

  const counts = useMemo(() => ({
    orphan: rows.filter(r => r.explicitInbound === 0 && r.structuralInbound === 0).length,
    nearOrphan: rows.filter(r => r.totalInbound > 0 && r.totalInbound <= 2 && r.explicitInbound <= 1).length,
    noParent: rows.filter(r => r.kind !== 'region' && !r.region).length,
    noOutgoing: rows.filter(r => r.explicitOutgoing === 0 && r.kind !== 'region').length,
    total: rows.length,
  }), [rows])

  // ── UI helpers ─────────────────────────────────────────────────────────────

  function InboundBadge({ explicit, structural }: { explicit: number; structural: number }) {
    const total = explicit + structural
    if (total === 0) return (
      <span className="font-sans text-[10px] px-2 py-0.5 bg-red-50 text-red-500">orphan</span>
    )
    return (
      <span className="font-sans text-xs tabular-nums text-gray-700">
        <span className="font-semibold">{explicit}</span>
        <span className="text-gray-400"> explicit</span>
        {structural > 0 && (
          <span className="text-gray-400"> + {structural} structural</span>
        )}
      </span>
    )
  }

  const TIER_TABS: { key: Tier; label: string; count: number; icon: typeof AlertCircle }[] = [
    { key: 'orphan', label: 'Orphans', count: counts.orphan, icon: AlertCircle },
    { key: 'near-orphan', label: 'Near-orphans', count: counts.nearOrphan, icon: AlertTriangle },
    { key: 'no-parent', label: 'No parent region', count: counts.noParent, icon: AlertTriangle },
    { key: 'no-outgoing', label: 'No outgoing links', count: counts.noOutgoing, icon: AlertTriangle },
    { key: 'all', label: 'All entities', count: counts.total, icon: CheckCircle },
  ]

  return (
    <div className="p-8 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/seo"
          className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> SEO Dashboard
        </Link>
        <p className={labelCls + ' mb-1'}>Admin Console · SEO</p>
        <h1 className="font-display italic text-3xl text-[#000000]">Orphan Page Detector</h1>
        <p className="font-sans text-sm text-gray-500 mt-1 max-w-xl">
          Entities with few or no inbound links receive less PageRank and are harder for search engines to discover.
          Explicit links (set in each entity&apos;s editor) are stronger than structural links from listing pages.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-400 font-sans text-sm py-16">
          <Loader2 size={16} className="animate-spin" /> Building link graph…
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'True orphans', value: counts.orphan, color: counts.orphan > 0 ? 'text-red-500' : 'text-emerald-600', bg: 'border-red-100 bg-red-50' },
              { label: 'Near-orphans', value: counts.nearOrphan, color: counts.nearOrphan > 0 ? 'text-amber-500' : 'text-emerald-600', bg: 'border-amber-100 bg-amber-50' },
              { label: 'Missing region', value: counts.noParent, color: counts.noParent > 0 ? 'text-amber-600' : 'text-emerald-600', bg: 'border-amber-100 bg-amber-50' },
              { label: 'No outgoing links', value: counts.noOutgoing, color: counts.noOutgoing > 0 ? 'text-amber-600' : 'text-emerald-600', bg: 'border-gray-100 bg-gray-50' },
            ].map(t => (
              <div key={t.label} className={`border p-4 ${t.bg}`}>
                <p className={`font-sans text-3xl font-bold tabular-nums ${t.color}`}>{t.value}</p>
                <p className="font-sans text-xs text-gray-600 mt-1">{t.label}</p>
              </div>
            ))}
          </div>

          {/* Tier tabs */}
          <div className="flex flex-wrap gap-0 border-b border-gray-200 mb-6">
            {TIER_TABS.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => setTier(t.key)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 font-sans text-sm border-b-2 -mb-px transition-colors ${
                    tier === t.key
                      ? 'border-[#2d6a4f] text-[#2d6a4f]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={13} />
                  {t.label}
                  <span className={`font-sans text-[11px] px-1.5 py-0.5 tabular-nums ${
                    tier === t.key ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {t.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Legend */}
          {tier === 'orphan' && (
            <div className="mb-5 px-4 py-3 bg-[#F7F5F2] border border-gray-200 font-sans text-xs text-gray-600">
              <strong>True orphans</strong> have zero explicit inbound links and are not structurally reachable via listing pages.
              Fix: open the entity editor and add explicit links via the Related Content section, or verify the entity has a region set and is published.
            </div>
          )}
          {tier === 'near-orphan' && (
            <div className="mb-5 px-4 py-3 bg-[#F7F5F2] border border-gray-200 font-sans text-xs text-gray-600">
              <strong>Near-orphans</strong> have at most 1 explicit inbound link. They are reachable but lightly linked.
              Structural links (listing pages, region hubs) partially compensate, but explicit curator links are stronger signals.
            </div>
          )}
          {tier === 'no-outgoing' && (
            <div className="mb-5 px-4 py-3 bg-[#F7F5F2] border border-gray-200 font-sans text-xs text-gray-600">
              <strong>Entities with no outgoing explicit links</strong> don't pass PageRank to any related entity.
              Open the editor and use the Related Content pickers to link accommodation, activities, or trails.
            </div>
          )}

          {/* Entity table */}
          {tierRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle size={32} className="text-emerald-500 mb-3" />
              <p className="font-display italic text-xl text-gray-700">No entities in this tier</p>
              <p className="font-sans text-sm text-gray-400 mt-1">
                {tier === 'orphan' && 'Every entity has at least one structural or explicit inbound link.'}
                {tier === 'near-orphan' && 'All entities have more than 2 inbound links.'}
                {tier === 'no-parent' && 'Every entity has a region set.'}
                {tier === 'no-outgoing' && 'Every entity has at least one explicit outgoing link.'}
                {tier === 'all' && 'No entities loaded.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 overflow-x-auto">
              <table className="w-full font-sans text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-[#F7F5F2]">
                    <th className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Type</th>
                    <th className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Name</th>
                    <th className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Inbound links</th>
                    <th className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Outgoing</th>
                    <th className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Region</th>
                    <th className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {tierRows.map(r => (
                    <tr
                      key={`${r.kind}:${r.id}`}
                      className="border-b border-gray-100 last:border-0 hover:bg-[#F7F5F2] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-sans text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600">
                          {r.kindLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium max-w-[180px] truncate">
                        {r.name}
                      </td>
                      <td className="px-4 py-3">
                        <InboundBadge explicit={r.explicitInbound} structural={r.structuralInbound} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 tabular-nums text-xs">
                        {r.explicitOutgoing === 0
                          ? <span className="text-amber-500">none</span>
                          : r.explicitOutgoing}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">
                        {r.region ?? <span className="text-red-400 italic">missing</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-sans text-[10px] px-2 py-0.5 ${
                          r.status === 'published' || r.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={r.editPath}
                          className="font-sans text-[11px] text-[#2d6a4f] hover:underline inline-flex items-center gap-1"
                        >
                          Edit <ExternalLink size={11} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-gray-100 bg-[#F7F5F2]">
                <p className="font-sans text-[11px] text-gray-400">
                  {tierRows.length} {tierRows.length === 1 ? 'entity' : 'entities'} · Explicit links are set in each entity&apos;s editor under &ldquo;Related Content&rdquo;
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

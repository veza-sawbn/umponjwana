'use client'

/**
 * Tool 8: Cannibalisation Detector — /admin/seo/overlap
 *
 * Loads all indexable entities client-side, computes pairwise Jaccard
 * similarity over their SEO text, and surfaces pairs that likely compete for
 * the same search intent.  Also surfaces topic-map conflicts (explicit
 * admin-declared collisions from Tool 9).
 *
 * Actions per pair:
 *   Redirect A → B  — navigates to /admin/seo/redirects with query params
 *   Set canonical   — navigates to /admin/seo/topics
 *   Keep separate   — locally dismisses the pair (localStorage)
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2, ChevronDown, ChevronUp, AlertTriangle,
  Info, RotateCcw, X, ExternalLink,
} from 'lucide-react'
import { getTrails } from '@/lib/trails'
import { getProperties } from '@/lib/properties'
import { getActivities } from '@/lib/activities'
import { getRegions } from '@/lib/regions'
import { computeSeoHealth, scoreColor } from '@/lib/seo-health'
import { getTopicMap, detectTopicConflicts } from '@/lib/topic-map'
import {
  type OverlapEntity,
  type OverlapPair,
  detectOverlaps,
  overlapsFromTopicConflicts,
  mergeOverlapPairs,
  getDismissedPairKeys,
  dismissPairKey,
  undismissPairKey,
} from '@/lib/cannibalization'

// ── Constants ─────────────────────────────────────────────────────────────────

const THRESHOLD_DEFAULT = 0.30
const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSeoText(fields: (string | undefined | null)[]): string {
  return fields.filter(Boolean).join(' ')
}

function confidenceBadge(level: OverlapPair['confidenceLevel']): string {
  if (level === 'high') return 'bg-red-100 text-red-700 border border-red-200'
  if (level === 'medium') return 'bg-amber-100 text-amber-700 border border-amber-200'
  return 'bg-sky-100 text-sky-700 border border-sky-200'
}

function confidenceLabel(level: OverlapPair['confidenceLevel']): string {
  if (level === 'high') return 'High conflict'
  if (level === 'medium') return 'Medium conflict'
  return 'Low conflict'
}

function KindPill({ kind }: { kind: string }) {
  const map: Record<string, string> = {
    trail: 'bg-emerald-50 text-emerald-700',
    property: 'bg-violet-50 text-violet-700',
    activity: 'bg-sky-50 text-sky-700',
    region: 'bg-amber-50 text-amber-700',
  }
  const cls = map[kind] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`font-sans text-[10px] tracking-wide uppercase px-2 py-0.5 font-semibold ${cls}`}>
      {kind}
    </span>
  )
}

function EntityCard({ entity }: { entity: OverlapEntity }) {
  const { score, badge } = { score: entity.score, badge: scoreColor(entity.score) }
  return (
    <div className="flex-1 min-w-0 bg-[#F7F5F2] border border-gray-200 p-4">
      <div className="flex items-start gap-2 mb-2">
        <KindPill kind={entity.kind} />
        <span className={`font-sans text-[10px] font-semibold px-2 py-0.5 tabular-nums ${badge}`}>
          {score}/100
        </span>
      </div>
      <p className="font-display italic text-base text-gray-900 leading-snug mb-1 truncate">
        {entity.name}
      </p>
      <p className="font-sans text-[11px] text-gray-400 truncate mb-2">{entity.path}</p>
      <Link
        href={entity.editPath}
        className="font-sans text-[11px] text-[#2d6a4f] hover:underline inline-flex items-center gap-1"
      >
        Edit <ExternalLink size={10} />
      </Link>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type KindFilter = 'all' | 'trail' | 'property' | 'activity' | 'region'
type SourceFilter = 'all' | 'text-similarity' | 'topic-conflict'

export default function OverlapPage() {
  const router = useRouter()

  // ── Loading state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [allPairs, setAllPairs] = useState<OverlapPair[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [showDismissed, setShowDismissed] = useState(false)

  // ── Filters ────────────────────────────────────────────────────────────────
  const [threshold, setThreshold] = useState(THRESHOLD_DEFAULT)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  // ── Expanded detail rows ───────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  // ── Data fetch + compute ───────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [trails, properties, activities, regions, topicEntries] =
          await Promise.all([
            getTrails(),
            getProperties(),
            getActivities(),
            getRegions(),
            getTopicMap(),
          ])

        const entities: OverlapEntity[] = []

        // Trails (published + robotsIndex not explicitly false)
        for (const t of trails) {
          if (t.status !== 'published' || t.robotsIndex === false) continue
          const { score } = computeSeoHealth({
            seoTitle: t.seoTitle,
            seoDescription: t.seoDescription,
            slug: t.slug,
            hasImage: !!t.image,
            contentLength: t.description?.length ?? 0,
            status: t.status,
            robotsIndex: t.robotsIndex,
          })
          entities.push({
            id: t.id,
            kind: 'trail',
            kindLabel: 'Trail',
            name: t.name,
            seoText: buildSeoText([
              t.name,
              t.seoTitle,
              t.seoDescription,
              t.region,
              t.trail_type,
              t.description,
            ]),
            path: `/hikes/${t.slug ?? t.id}`,
            score,
            editPath: `/admin/trails/${t.id}`,
          })
        }

        // Properties (active + robotsIndex not explicitly false)
        for (const p of properties) {
          if (p.status !== 'active' || p.robotsIndex === false) continue
          const { score } = computeSeoHealth({
            seoTitle: p.seoTitle,
            seoDescription: p.seoDescription,
            slug: p.slug,
            hasImage: (p.photos?.length ?? 0) > 0,
            contentLength: p.description?.length ?? 0,
            status: p.status,
            robotsIndex: p.robotsIndex,
          })
          entities.push({
            id: p.id,
            kind: 'property',
            kindLabel: 'Stay',
            name: p.name,
            seoText: buildSeoText([
              p.name,
              p.seoTitle,
              p.seoDescription,
              p.region,
              p.type,
              p.description,
            ]),
            path: `/stays/${p.slug ?? p.id}`,
            score,
            editPath: `/admin/properties/${p.id}`,
          })
        }

        // Activities (active + robotsIndex not explicitly false)
        for (const a of activities) {
          if (a.status !== 'active' || a.robotsIndex === false) continue
          const { score } = computeSeoHealth({
            seoTitle: a.seoTitle,
            seoDescription: a.seoDescription,
            slug: a.slug,
            hasImage: (a.photos?.length ?? 0) > 0,
            contentLength: a.description?.length ?? 0,
            status: a.status,
            robotsIndex: a.robotsIndex,
          })
          entities.push({
            id: a.id,
            kind: 'activity',
            kindLabel: 'Activity',
            name: a.name,
            seoText: buildSeoText([
              a.name,
              a.seoTitle,
              a.seoDescription,
              a.region,
              a.category,
              a.description,
            ]),
            path: `/activities/${a.slug ?? a.id}`,
            score,
            editPath: `/admin/activities/${a.id}`,
          })
        }

        // Regions (always indexable — no status/robotsIndex field on Region)
        for (const r of regions) {
          const { score } = computeSeoHealth({
            seoTitle: r.seoTitle,
            seoDescription: r.seoDescription,
            slug: r.slug,
            hasImage: !!r.heroImage,
            contentLength: r.overview?.length ?? 0,
          })
          entities.push({
            id: r.id,
            kind: 'region',
            kindLabel: 'Region',
            name: r.name,
            seoText: buildSeoText([
              r.name,
              r.seoTitle,
              r.seoDescription,
              r.overview,
            ]),
            path: `/regions/${r.slug}`,
            score,
            editPath: `/admin/regions/${r.id}`,
          })
        }

        // Compute pairs
        const textPairs = detectOverlaps(entities, THRESHOLD_DEFAULT)

        const entityLookup = new Map(entities.map(e => [e.id, e]))
        const conflicts = detectTopicConflicts(topicEntries)
        const topicPairs = overlapsFromTopicConflicts(conflicts, entityLookup)

        const merged = mergeOverlapPairs(textPairs, topicPairs)
        setAllPairs(merged)
      } catch (err) {
        console.error('Failed to load overlap data', err)
      } finally {
        setLoading(false)
      }
    }

    load()
    setDismissed(getDismissedPairKeys())
  }, [])

  // ── Filtered view ──────────────────────────────────────────────────────────
  const visiblePairs = useMemo(() => {
    return allPairs.filter(p => {
      if (!showDismissed && dismissed.has(p.pairKey)) return false
      if (p.confidence < threshold && p.source !== 'topic-conflict') return false
      if (kindFilter !== 'all') {
        if (p.entityA.kind !== kindFilter && p.entityB.kind !== kindFilter) return false
      }
      if (sourceFilter !== 'all' && p.source !== sourceFilter) return false
      return true
    })
  }, [allPairs, dismissed, showDismissed, threshold, kindFilter, sourceFilter])

  const dismissedCount = useMemo(
    () => allPairs.filter(p => dismissed.has(p.pairKey)).length,
    [allPairs, dismissed],
  )

  // ── Dismiss helpers ────────────────────────────────────────────────────────
  const dismiss = useCallback((key: string) => {
    dismissPairKey(key)
    setDismissed(prev => new Set([...prev, key]))
  }, [])

  const undismiss = useCallback((key: string) => {
    undismissPairKey(key)
    setDismissed(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  // ── Redirect to action pages with pre-filled state via query params ────────
  const goRedirect = useCallback((from: OverlapEntity, to: OverlapEntity) => {
    const params = new URLSearchParams({
      from: from.path,
      to: to.path,
    })
    router.push(`/admin/seo/redirects?${params.toString()}`)
  }, [router])

  const goTopics = useCallback(() => {
    router.push('/admin/seo/topics')
  }, [router])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/seo" className="font-sans text-xs text-gray-400 hover:text-gray-600">
              ← SEO Console
            </Link>
          </div>
          <h1 className="font-display italic text-2xl text-gray-900">Cannibalisation Detector</h1>
          <p className="font-sans text-sm text-gray-500 mt-0.5">
            Entity pairs that compete for the same search intent — ranked by confidence.
          </p>
        </div>
        {dismissedCount > 0 && (
          <button
            onClick={() => setShowDismissed(v => !v)}
            className="font-sans text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
          >
            <RotateCcw size={14} />
            {showDismissed ? 'Hide' : 'Show'} {dismissedCount} dismissed
          </button>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Filters */}
        <div className="bg-white border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
          {/* Confidence threshold */}
          <div className="flex-1 min-w-40">
            <label className={labelCls}>
              Min confidence — {Math.round(threshold * 100)}%
            </label>
            <input
              type="range"
              min={0.20}
              max={0.80}
              step={0.05}
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full accent-[#2d6a4f]"
            />
            <div className="flex justify-between font-sans text-[10px] text-gray-400 mt-0.5">
              <span>20%</span>
              <span>80%</span>
            </div>
          </div>

          {/* Kind filter */}
          <div>
            <label className={labelCls}>Entity type</label>
            <select
              value={kindFilter}
              onChange={e => setKindFilter(e.target.value as KindFilter)}
              className="font-sans text-sm border border-gray-200 bg-[#F7F5F2] px-3 py-2 focus:outline-none focus:border-[#2d6a4f]"
            >
              <option value="all">All types</option>
              <option value="trail">Trails</option>
              <option value="property">Stays</option>
              <option value="activity">Activities</option>
              <option value="region">Regions</option>
            </select>
          </div>

          {/* Source filter */}
          <div>
            <label className={labelCls}>Signal source</label>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value as SourceFilter)}
              className="font-sans text-sm border border-gray-200 bg-[#F7F5F2] px-3 py-2 focus:outline-none focus:border-[#2d6a4f]"
            >
              <option value="all">All signals</option>
              <option value="text-similarity">Text similarity</option>
              <option value="topic-conflict">Topic conflict</option>
            </select>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="font-sans text-sm">Analysing entities…</span>
          </div>
        ) : visiblePairs.length === 0 ? (
          <div className="bg-white border border-gray-200 p-12 text-center">
            <p className="font-display italic text-lg text-gray-400 mb-1">No conflicts found</p>
            <p className="font-sans text-sm text-gray-400">
              {allPairs.length === 0
                ? 'No entity pairs exceed the minimum confidence threshold.'
                : 'All detected pairs have been dismissed or filtered out.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className={labelCls}>
              {visiblePairs.length} pair{visiblePairs.length !== 1 ? 's' : ''} · sorted by confidence
            </p>

            {visiblePairs.map(pair => {
              const isDismissed = dismissed.has(pair.pairKey)
              const isExpanded = expanded.has(pair.pairKey)

              return (
                <div
                  key={pair.pairKey}
                  className={`bg-white border ${isDismissed ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}
                >
                  {/* Pair header row */}
                  <button
                    onClick={() => toggle(pair.pairKey)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    {/* Confidence badge */}
                    <span className={`font-sans text-[10px] font-semibold px-2 py-0.5 whitespace-nowrap tabular-nums ${confidenceBadge(pair.confidenceLevel)}`}>
                      {confidenceLabel(pair.confidenceLevel)} · {Math.round(pair.confidence * 100)}%
                    </span>

                    {/* Source pill */}
                    {pair.source === 'topic-conflict' && (
                      <span className="font-sans text-[10px] font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
                        Topic conflict
                      </span>
                    )}

                    {/* Entity names */}
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="font-sans text-sm text-gray-800 font-medium truncate">
                        {pair.entityA.name}
                      </span>
                      <span className="font-sans text-xs text-gray-400">vs</span>
                      <span className="font-sans text-sm text-gray-800 font-medium truncate">
                        {pair.entityB.name}
                      </span>
                    </div>

                    {/* Shared terms preview */}
                    <span className="font-sans text-[11px] text-gray-400 hidden md:block shrink-0">
                      {pair.sharedTerms.slice(0, 3).join(', ')}
                      {pair.sharedTerms.length > 3 ? ` +${pair.sharedTerms.length - 3}` : ''}
                    </span>

                    {isExpanded
                      ? <ChevronUp size={14} className="text-gray-400 shrink-0" />
                      : <ChevronDown size={14} className="text-gray-400 shrink-0" />
                    }
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 space-y-4">

                      {/* Entity cards */}
                      <div className="flex gap-3 flex-wrap">
                        <EntityCard entity={pair.entityA} />
                        <EntityCard entity={pair.entityB} />
                      </div>

                      {/* Shared terms */}
                      <div>
                        <p className={labelCls}>Competing terms ({pair.sharedTerms.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {pair.sharedTerms.map(t => (
                            <span key={t} className="font-sans text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Topic conflict callout */}
                      {pair.source === 'topic-conflict' && pair.topic && (
                        <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200">
                          <AlertTriangle size={14} className="text-purple-600 mt-0.5 shrink-0" />
                          <p className="font-sans text-sm text-purple-800">
                            Both entities are mapped as canonical for the topic{' '}
                            <span className="font-semibold italic">"{pair.topic}"</span>.
                            Only one entity should own a topic phrase.
                          </p>
                        </div>
                      )}

                      {/* Action row */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={() => goRedirect(pair.entityA, pair.entityB)}
                          className="font-sans text-sm border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2 hover:bg-[#2d6a4f] hover:text-white transition-colors"
                          title="Redirect A to B — higher-scoring entity wins the keyword"
                        >
                          Redirect{' '}
                          <span className="font-medium truncate" style={{ maxWidth: '8rem', display: 'inline-block', verticalAlign: 'bottom' }}>
                            {pair.entityA.name}
                          </span>
                          {' '}→{' '}
                          <span className="font-medium truncate" style={{ maxWidth: '8rem', display: 'inline-block', verticalAlign: 'bottom' }}>
                            {pair.entityB.name}
                          </span>
                        </button>
                        <button
                          onClick={goTopics}
                          className="font-sans text-sm border border-gray-300 text-gray-600 px-4 py-2 hover:bg-gray-100 transition-colors"
                        >
                          Set canonical in Topic Map
                        </button>
                        {isDismissed ? (
                          <button
                            onClick={() => undismiss(pair.pairKey)}
                            className="font-sans text-sm text-gray-400 hover:text-gray-600 px-3 py-2 flex items-center gap-1.5"
                          >
                            <RotateCcw size={12} />
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => dismiss(pair.pairKey)}
                            className="font-sans text-sm text-gray-400 hover:text-gray-600 px-3 py-2 flex items-center gap-1.5"
                          >
                            <X size={12} />
                            Keep separate
                          </button>
                        )}
                      </div>

                      {/* Info note for low-confidence pairs */}
                      {pair.confidenceLevel === 'low' && pair.source === 'text-similarity' && (
                        <div className="flex items-start gap-2 p-3 bg-sky-50 border border-sky-200">
                          <Info size={14} className="text-sky-600 mt-0.5 shrink-0" />
                          <p className="font-sans text-xs text-sky-800">
                            Low confidence — these entities share some terms but likely serve different intents.
                            Dismiss if they are correctly targeting different audiences.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Summary footer */}
        {!loading && allPairs.length > 0 && (
          <div className="bg-white border border-gray-200 p-4 flex flex-wrap gap-6">
            <div>
              <p className={labelCls}>Total pairs detected</p>
              <p className="font-sans text-2xl font-semibold tabular-nums text-gray-900">{allPairs.length}</p>
            </div>
            <div>
              <p className={labelCls}>High conflict</p>
              <p className="font-sans text-2xl font-semibold tabular-nums text-red-600">
                {allPairs.filter(p => p.confidenceLevel === 'high').length}
              </p>
            </div>
            <div>
              <p className={labelCls}>Topic conflicts</p>
              <p className="font-sans text-2xl font-semibold tabular-nums text-purple-600">
                {allPairs.filter(p => p.source === 'topic-conflict').length}
              </p>
            </div>
            <div>
              <p className={labelCls}>Dismissed</p>
              <p className="font-sans text-2xl font-semibold tabular-nums text-gray-400">{dismissedCount}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

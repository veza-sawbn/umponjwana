'use client'

/**
 * Tool 14: Page Quality Checklist — /admin/seo/quality
 *
 * Pick any entity, run automatic checks against its fields, and work through
 * the manual checklist items before publishing.
 *
 * Auto checks are deterministic (no DB writes). Manual check state is stored
 * in localStorage per entity — not in Supabase.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Loader2, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp,
  ClipboardList, ExternalLink, Search,
} from 'lucide-react'
import { getTrails } from '@/lib/trails'
import { getProperties } from '@/lib/properties'
import { getActivities } from '@/lib/activities'
import { getRegions } from '@/lib/regions'
import { computeSeoHealth, scoreColor } from '@/lib/seo-health'
import {
  type ChecklistEntity,
  type AutoCheck,
  type ManualCheck,
  type CheckCategory,
  runChecklist,
  getManualCheckState,
  setManualCheck,
} from '@/lib/quality-checklist'

// ── Helpers ───────────────────────────────────────────────────────────────────

const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

const CATEGORY_LABELS: Record<CheckCategory, string> = {
  content: 'Content',
  seo: 'SEO',
  technical: 'Technical',
  ux: 'User Experience',
}

const CATEGORY_ORDER: CheckCategory[] = ['content', 'seo', 'technical', 'ux']

function resultIcon(result: AutoCheck['result']) {
  if (result === 'pass') return <CheckCircle size={15} className="text-emerald-500 shrink-0" />
  if (result === 'warn') return <AlertCircle size={15} className="text-amber-500 shrink-0" />
  return <XCircle size={15} className="text-red-500 shrink-0" />
}

function resultBg(result: AutoCheck['result']) {
  if (result === 'pass') return 'bg-emerald-50 border-emerald-200'
  if (result === 'warn') return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

function ScoreRing({ score }: { score: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const colour = score >= 75 ? '#2d6a4f' : score >= 50 ? '#d97706' : '#dc2626'

  return (
    <svg width={88} height={88} viewBox="0 0 88 88">
      <circle cx={44} cy={44} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
      <circle
        cx={44} cy={44} r={r}
        fill="none"
        stroke={colour}
        strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.4s ease' }}
      />
      <text x={44} y={49} textAnchor="middle" fontSize={18} fontWeight={700} fill={colour}
        style={{ fontVariantNumeric: 'tabular-nums' }}>
        {score}
      </text>
    </svg>
  )
}

// ── Entity picker item ────────────────────────────────────────────────────────

type PickerItem = {
  id: string
  kind: ChecklistEntity['kind']
  kindLabel: string
  name: string
  region: string | undefined
  status: string
  entity: ChecklistEntity
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QualityChecklistPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<PickerItem[]>([])
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | ChecklistEntity['kind']>('all')
  const [selected, setSelected] = useState<PickerItem | null>(null)
  const [pickerOpen, setPickerOpen] = useState(true)
  const [manualState, setManualState] = useState<Record<string, boolean>>({})
  const [expandedCats, setExpandedCats] = useState<Set<CheckCategory>>(
    new Set(['content', 'seo', 'technical', 'ux']),
  )

  // ── Load all entities ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [trails, properties, activities, regions] = await Promise.all([
        getTrails(), getProperties(), getActivities(), getRegions(),
      ])

      const all: PickerItem[] = []

      for (const t of trails) {
        const { score } = computeSeoHealth({
          seoTitle: t.seoTitle, seoDescription: t.seoDescription, slug: t.slug,
          hasImage: !!t.image, contentLength: t.description?.length ?? 0,
          status: t.status, robotsIndex: t.robotsIndex,
        })
        const entity: ChecklistEntity = {
          id: t.id, kind: 'trail', name: t.name,
          slug: t.slug, status: t.status, description: t.description,
          region: t.region, hasImage: !!t.image,
          hasOgImage: !!(t as Record<string, unknown>).ogImage,
          seoTitle: t.seoTitle, seoDescription: t.seoDescription,
          robotsIndex: t.robotsIndex,
          relatedCount:
            ((t.relatedTrailIds?.length ?? 0) +
             (t.relatedPropertyIds?.length ?? 0) +
             (t.relatedActivityIds?.length ?? 0)),
          focusTopic: (t as Record<string, unknown>).focusTopic as string ?? null,
          editPath: `/admin/trails/${t.id}`,
        }
        all.push({ id: t.id, kind: 'trail', kindLabel: 'Trail', name: t.name, region: t.region ?? undefined, status: t.status, entity })
      }

      for (const p of properties) {
        const { score } = computeSeoHealth({
          seoTitle: p.seoTitle, seoDescription: p.seoDescription, slug: p.slug,
          hasImage: (p.photos?.length ?? 0) > 0,
          contentLength: p.description?.length ?? 0,
          status: p.status, robotsIndex: p.robotsIndex,
        })
        const entity: ChecklistEntity = {
          id: p.id, kind: 'property', name: p.name,
          slug: p.slug, status: p.status, description: p.description,
          region: p.region, hasImage: (p.photos?.length ?? 0) > 0,
          hasOgImage: !!(p as Record<string, unknown>).ogImage,
          seoTitle: p.seoTitle, seoDescription: p.seoDescription,
          robotsIndex: p.robotsIndex,
          relatedCount: (p.relatedTrailIds?.length ?? 0) + (p.relatedActivityIds?.length ?? 0),
          focusTopic: (p as Record<string, unknown>).focusTopic as string ?? null,
          editPath: `/admin/properties/${p.id}`,
        }
        all.push({ id: p.id, kind: 'property', kindLabel: 'Stay', name: p.name, region: p.region ?? undefined, status: p.status, entity })
      }

      for (const a of activities) {
        const { score } = computeSeoHealth({
          seoTitle: a.seoTitle, seoDescription: a.seoDescription, slug: a.slug,
          hasImage: (a.photos?.length ?? 0) > 0, contentLength: a.description?.length ?? 0,
          status: a.status, robotsIndex: a.robotsIndex,
        })
        const entity: ChecklistEntity = {
          id: a.id, kind: 'activity', name: a.name,
          slug: a.slug, status: a.status, description: a.description,
          region: a.region, hasImage: (a.photos?.length ?? 0) > 0,
          hasOgImage: !!(a as Record<string, unknown>).ogImage,
          seoTitle: a.seoTitle, seoDescription: a.seoDescription,
          robotsIndex: a.robotsIndex,
          relatedCount: (a.relatedTrailIds?.length ?? 0) + (a.relatedPropertyIds?.length ?? 0),
          focusTopic: (a as Record<string, unknown>).focusTopic as string ?? null,
          editPath: `/admin/activities/${a.id}`,
        }
        all.push({ id: a.id, kind: 'activity', kindLabel: 'Activity', name: a.name, region: a.region ?? undefined, status: a.status, entity })
      }

      for (const r of regions) {
        const { score } = computeSeoHealth({
          seoTitle: r.seoTitle, seoDescription: r.seoDescription, slug: r.slug,
          hasImage: !!r.heroImage, contentLength: r.overview?.length ?? 0,
          status: 'published', robotsIndex: undefined,
        })
        const entity: ChecklistEntity = {
          id: r.id, kind: 'region', name: r.name,
          slug: r.slug, status: 'published', description: r.overview,
          region: r.name, hasImage: !!r.heroImage,
          hasOgImage: !!(r as Record<string, unknown>).ogImage,
          seoTitle: r.seoTitle, seoDescription: r.seoDescription,
          robotsIndex: undefined,
          relatedCount: 0,
          focusTopic: (r as Record<string, unknown>).focusTopic as string ?? null,
          editPath: `/admin/regions/${r.id}`,
        }
        all.push({ id: r.id, kind: 'region', kindLabel: 'Region', name: r.name, region: undefined, status: 'published', entity })
      }

      all.sort((a, b) => a.name.localeCompare(b.name))
      setItems(all)
      setLoading(false)
    }
    load()
  }, [])

  // ── Picker filter ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter(item => {
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false
      if (q && !item.name.toLowerCase().includes(q) && !item.region?.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, search, kindFilter])

  // ── Select entity ──────────────────────────────────────────────────────────
  const select = useCallback((item: PickerItem) => {
    setSelected(item)
    setPickerOpen(false)
    setManualState(getManualCheckState(item.id))
  }, [])

  // ── Checklist result ───────────────────────────────────────────────────────
  const result = useMemo(
    () => selected ? runChecklist(selected.entity) : null,
    [selected],
  )

  // ── Manual check toggle ────────────────────────────────────────────────────
  const toggleManual = useCallback((checkId: string) => {
    if (!selected) return
    setManualState(prev => {
      const next = { ...prev, [checkId]: !prev[checkId] }
      setManualCheck(selected.id, checkId, next[checkId])
      return next
    })
  }, [selected])

  // ── Category expand ────────────────────────────────────────────────────────
  const toggleCat = useCallback((cat: CheckCategory) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }, [])

  // ── Aggregate manual completeness ──────────────────────────────────────────
  const manualDone = useMemo(
    () => result?.manual.filter(m => manualState[m.id]).length ?? 0,
    [result, manualState],
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/admin/seo" className="font-sans text-xs text-gray-400 hover:text-gray-600">
            ← SEO Console
          </Link>
        </div>
        <h1 className="font-display italic text-2xl text-gray-900">Page Quality Checklist</h1>
        <p className="font-sans text-sm text-gray-500 mt-0.5">
          Run automated checks + a manual review checklist before publishing any entity.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Entity picker */}
        <div className="bg-white border border-gray-200">
          <button
            onClick={() => setPickerOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ClipboardList size={16} className="text-[#2d6a4f]" />
              <span className="font-sans text-sm font-medium text-gray-800">
                {selected ? selected.name : 'Select an entity to check'}
              </span>
              {selected && (
                <span className="font-sans text-[10px] tracking-wide uppercase px-2 py-0.5 bg-gray-100 text-gray-500">
                  {selected.kindLabel}
                </span>
              )}
            </div>
            {pickerOpen
              ? <ChevronUp size={14} className="text-gray-400" />
              : <ChevronDown size={14} className="text-gray-400" />}
          </button>

          {pickerOpen && (
            <div className="border-t border-gray-100">
              {/* Search + kind filter */}
              <div className="flex gap-2 p-3 border-b border-gray-100">
                <div className="flex-1 flex items-center gap-2 border border-gray-200 bg-[#F7F5F2] px-3 py-2">
                  <Search size={13} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search by name or region…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 bg-transparent font-sans text-sm outline-none placeholder:text-gray-400"
                  />
                </div>
                <select
                  value={kindFilter}
                  onChange={e => setKindFilter(e.target.value as typeof kindFilter)}
                  className="font-sans text-sm border border-gray-200 bg-[#F7F5F2] px-3 py-2 focus:outline-none focus:border-[#2d6a4f]"
                >
                  <option value="all">All types</option>
                  <option value="trail">Trails</option>
                  <option value="property">Stays</option>
                  <option value="activity">Activities</option>
                  <option value="region">Regions</option>
                </select>
              </div>

              {/* List */}
              <div className="max-h-72 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="font-sans text-sm">Loading entities…</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="font-sans text-sm text-gray-400 text-center py-6">No entities match.</p>
                ) : (
                  filtered.map(item => (
                    <button
                      key={item.id}
                      onClick={() => select(item)}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0
                        ${selected?.id === item.id ? 'bg-emerald-50' : ''}`}
                    >
                      <span className={`font-sans text-[10px] tracking-wide uppercase px-2 py-0.5 font-semibold shrink-0
                        ${item.kind === 'trail' ? 'bg-emerald-50 text-emerald-700' :
                          item.kind === 'property' ? 'bg-violet-50 text-violet-700' :
                          item.kind === 'activity' ? 'bg-sky-50 text-sky-700' :
                          'bg-amber-50 text-amber-700'}`}>
                        {item.kindLabel}
                      </span>
                      <span className="font-sans text-sm text-gray-800 flex-1 truncate">{item.name}</span>
                      {item.region && (
                        <span className="font-sans text-[11px] text-gray-400 shrink-0 hidden sm:block truncate max-w-32">
                          {item.region}
                        </span>
                      )}
                      <span className={`font-sans text-[10px] px-2 py-0.5 shrink-0
                        ${item.status === 'published' || item.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {item.status}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Checklist */}
        {result && selected && (
          <>
            {/* Score + summary */}
            <div className="bg-white border border-gray-200 p-6 flex flex-wrap items-center gap-6">
              <ScoreRing score={result.score} />
              <div className="flex-1 min-w-0">
                <p className={labelCls}>Auto-check score</p>
                <p className="font-display italic text-lg text-gray-900 mb-1">
                  {result.readyToPublish
                    ? 'No blocking issues found'
                    : `${result.auto.filter(c => c.result === 'fail').length} item${result.auto.filter(c => c.result === 'fail').length !== 1 ? 's' : ''} need attention`}
                </p>
                <p className="font-sans text-sm text-gray-500">
                  {result.auto.filter(c => c.result === 'pass').length} passed ·{' '}
                  {result.auto.filter(c => c.result === 'warn').length} warnings ·{' '}
                  {result.auto.filter(c => c.result === 'fail').length} failed
                </p>
                <p className="font-sans text-sm text-gray-500 mt-1">
                  Manual checklist: {manualDone}/{result.manual.length} complete
                </p>
              </div>
              <Link
                href={selected.entity.editPath}
                className="shrink-0 border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors flex items-center gap-1.5"
              >
                Edit entity <ExternalLink size={12} />
              </Link>
            </div>

            {/* Checks by category */}
            {CATEGORY_ORDER.map(cat => {
              const autoInCat = result.auto.filter(c => c.category === cat)
              const manualInCat = result.manual.filter(m => m.category === cat)
              if (autoInCat.length === 0 && manualInCat.length === 0) return null
              const open = expandedCats.has(cat)
              const failCount = autoInCat.filter(c => c.result === 'fail').length
              const warnCount = autoInCat.filter(c => c.result === 'warn').length
              const manualLeft = manualInCat.filter(m => !manualState[m.id]).length

              return (
                <div key={cat} className="bg-white border border-gray-200">
                  <button
                    onClick={() => toggleCat(cat)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-sans text-sm font-semibold text-gray-800 flex-1 text-left">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    {failCount > 0 && (
                      <span className="font-sans text-[10px] font-semibold px-2 py-0.5 bg-red-100 text-red-700">
                        {failCount} failed
                      </span>
                    )}
                    {warnCount > 0 && (
                      <span className="font-sans text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700">
                        {warnCount} warn
                      </span>
                    )}
                    {manualLeft > 0 && (
                      <span className="font-sans text-[10px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-500">
                        {manualLeft} manual
                      </span>
                    )}
                    {open
                      ? <ChevronUp size={13} className="text-gray-400 shrink-0" />
                      : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
                  </button>

                  {open && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {/* Auto checks */}
                      {autoInCat.map(check => (
                        <div key={check.id} className={`flex items-start gap-3 px-5 py-3.5 border-l-4 ${resultBg(check.result)}`}>
                          <span className="mt-0.5">{resultIcon(check.result)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-sans text-sm text-gray-800">{check.label}</p>
                              {check.detail && (
                                <span className="font-sans text-[10px] tabular-nums text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5">
                                  {check.detail}
                                </span>
                              )}
                            </div>
                            <p className="font-sans text-xs text-gray-500 mt-0.5">{check.guidance}</p>
                          </div>
                          {check.result !== 'pass' && check.fixPath && (
                            <Link
                              href={check.fixPath}
                              className="font-sans text-[11px] text-[#2d6a4f] hover:underline shrink-0 mt-0.5"
                            >
                              Fix →
                            </Link>
                          )}
                        </div>
                      ))}

                      {/* Manual checks */}
                      {manualInCat.map(check => (
                        <label
                          key={check.id}
                          className="flex items-start gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!manualState[check.id]}
                            onChange={() => toggleManual(check.id)}
                            className="mt-1 accent-[#2d6a4f] w-4 h-4 shrink-0"
                          />
                          <div>
                            <p className={`font-sans text-sm ${manualState[check.id] ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                              {check.label}
                            </p>
                            <p className="font-sans text-xs text-gray-500 mt-0.5">{check.guidance}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Bottom action row */}
            <div className="bg-white border border-gray-200 p-5 flex flex-wrap gap-3 items-center">
              <p className="font-sans text-sm text-gray-600 flex-1">
                {result.readyToPublish && manualDone === result.manual.length
                  ? '✓ All checks complete — ready to publish.'
                  : result.readyToPublish
                  ? `Automated checks passed. ${result.manual.length - manualDone} manual item${result.manual.length - manualDone !== 1 ? 's' : ''} remaining.`
                  : 'Fix the failed items before publishing.'}
              </p>
              <Link href={selected.entity.editPath}
                className="font-sans text-sm border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2 hover:bg-[#2d6a4f] hover:text-white transition-colors">
                Edit entity →
              </Link>
              <Link href="/admin/seo"
                className="font-sans text-sm border border-gray-300 text-gray-600 px-4 py-2 hover:bg-gray-100 transition-colors">
                SEO dashboard →
              </Link>
            </div>
          </>
        )}

        {/* Empty state */}
        {!selected && !loading && (
          <div className="bg-white border border-gray-200 p-12 text-center">
            <ClipboardList size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="font-display italic text-lg text-gray-400 mb-1">Select an entity above</p>
            <p className="font-sans text-sm text-gray-400">
              Choose a trail, stay, activity, or region to run the pre-publish quality checklist.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

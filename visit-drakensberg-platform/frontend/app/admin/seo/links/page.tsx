'use client'

/**
 * Tool 3: Internal Link Suggestions — /admin/seo/links
 *
 * Pick a source entity, get a ranked list of entities that would make good
 * internal link targets. Signals: same region, fuzzy name match, topic overlap.
 *
 * "Accept" copies the suggested URL to clipboard. "Dismiss" hides it from
 * future suggestions for this source (localStorage). No DB writes.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Loader2, Search, Copy, Check, X, RotateCcw, ExternalLink,
  ChevronDown, ChevronUp, Link as LinkIcon,
} from 'lucide-react'
import { getTrails } from '@/lib/trails'
import { getProperties } from '@/lib/properties'
import { getActivities } from '@/lib/activities'
import { getRegions } from '@/lib/regions'
import {
  type SuggestionEntity,
  type LinkSuggestion,
  getSuggestedLinks,
  getDismissedForSource,
  dismissSuggestion,
  restoreSuggestion,
} from '@/lib/link-suggestions'

// ── Helpers ───────────────────────────────────────────────────────────────────

const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://visitdrakensberg.com'

function kindCls(kind: string) {
  return kind === 'trail'
    ? 'bg-emerald-50 text-emerald-700'
    : kind === 'property'
    ? 'bg-violet-50 text-violet-700'
    : kind === 'activity'
    ? 'bg-sky-50 text-sky-700'
    : 'bg-amber-50 text-amber-700'
}

function relevanceBadge(r: number) {
  if (r >= 0.65) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (r >= 0.40) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-gray-100 text-gray-500 border-gray-200'
}

function relevanceLabel(r: number) {
  if (r >= 0.65) return 'Strong match'
  if (r >= 0.40) return 'Good match'
  return 'Weak match'
}

function SignalChip({ signal }: { signal: LinkSuggestion['signals'][number] }) {
  const map: Record<string, string> = {
    'same-region': 'Same region',
    'name-match': 'Name similarity',
    'topic-overlap': 'Keyword overlap',
  }
  return (
    <span className="font-sans text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500">
      {map[signal] ?? signal}
    </span>
  )
}

// ── CopyButton — one-shot clipboard copy with tick feedback ───────────────────
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }, [text])
  return (
    <button
      onClick={copy}
      title={`Copy ${label}`}
      className="flex items-center gap-1.5 font-sans text-sm border border-[#2d6a4f] text-[#2d6a4f] px-3 py-1.5 hover:bg-[#2d6a4f] hover:text-white transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

// ── PickerItem type ───────────────────────────────────────────────────────────

type PickerItem = SuggestionEntity & { kindLabel: string }

// ── Main component ────────────────────────────────────────────────────────────

export default function LinkSuggestionsPage() {
  const [loading, setLoading] = useState(true)
  const [allEntities, setAllEntities] = useState<PickerItem[]>([])
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | SuggestionEntity['kind']>('all')
  const [source, setSource] = useState<PickerItem | null>(null)
  const [pickerOpen, setPickerOpen] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [showDismissed, setShowDismissed] = useState(false)

  // ── Load all entities ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [trails, properties, activities, regions] = await Promise.all([
        getTrails(), getProperties(), getActivities(), getRegions(),
      ])
      const items: PickerItem[] = []

      for (const t of trails) {
        items.push({
          id: t.id, kind: 'trail', kindLabel: 'Trail', name: t.name,
          slug: t.slug, region: t.region, status: t.status,
          seoTitle: t.seoTitle, seoDescription: t.seoDescription,
          focusTopic: (t as Record<string, unknown>).focusTopic as string ?? null,
          path: `/hikes/${t.slug ?? t.id}`,
          editPath: `/admin/trails/${t.id}`,
        })
      }
      for (const p of properties) {
        items.push({
          id: p.id, kind: 'property', kindLabel: 'Stay', name: p.name,
          slug: p.slug, region: p.region, status: p.status,
          seoTitle: p.seoTitle, seoDescription: p.seoDescription,
          focusTopic: (p as Record<string, unknown>).focusTopic as string ?? null,
          path: `/stays/${p.slug ?? p.id}`,
          editPath: `/admin/properties/${p.id}`,
        })
      }
      for (const a of activities) {
        items.push({
          id: a.id, kind: 'activity', kindLabel: 'Activity', name: a.name,
          slug: a.slug, region: a.region, status: a.status,
          seoTitle: a.seoTitle, seoDescription: a.seoDescription,
          focusTopic: (a as Record<string, unknown>).focusTopic as string ?? null,
          path: `/activities/${a.slug ?? a.id}`,
          editPath: `/admin/activities/${a.id}`,
        })
      }
      for (const r of regions) {
        items.push({
          id: r.id, kind: 'region', kindLabel: 'Region', name: r.name,
          slug: r.slug, region: r.name, status: r.status ?? 'active',
          seoTitle: r.seoTitle, seoDescription: r.seoDescription,
          focusTopic: (r as Record<string, unknown>).focusTopic as string ?? null,
          path: `/regions/${r.slug ?? r.id}`,
          editPath: `/admin/regions/${r.id}`,
        })
      }

      items.sort((a, b) => a.name.localeCompare(b.name))
      setAllEntities(items)
      setLoading(false)
    }
    load()
  }, [])

  // ── Picker filter ──────────────────────────────────────────────────────────
  const pickerFiltered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return allEntities.filter(e => {
      if (kindFilter !== 'all' && e.kind !== kindFilter) return false
      if (q && !e.name.toLowerCase().includes(q) && !e.region?.toLowerCase().includes(q)) return false
      return true
    })
  }, [allEntities, search, kindFilter])

  // ── Select source ──────────────────────────────────────────────────────────
  const selectSource = useCallback((item: PickerItem) => {
    setSource(item)
    setPickerOpen(false)
    setDismissed(getDismissedForSource(item.id))
  }, [])

  // ── Suggestions ────────────────────────────────────────────────────────────
  const suggestions = useMemo(() => {
    if (!source) return []
    return getSuggestedLinks(source, allEntities, 30)
  }, [source, allEntities])

  const visible = useMemo(() => {
    if (showDismissed) return suggestions
    return suggestions.filter(s => !dismissed.has(s.entity.id))
  }, [suggestions, dismissed, showDismissed])

  const dismissedCount = useMemo(
    () => suggestions.filter(s => dismissed.has(s.entity.id)).length,
    [suggestions, dismissed],
  )

  // ── Dismiss / restore ──────────────────────────────────────────────────────
  const dismiss = useCallback((candidateId: string) => {
    if (!source) return
    dismissSuggestion(source.id, candidateId)
    setDismissed(prev => new Set([...prev, candidateId]))
  }, [source])

  const restore = useCallback((candidateId: string) => {
    if (!source) return
    restoreSuggestion(source.id, candidateId)
    setDismissed(prev => { const n = new Set(prev); n.delete(candidateId); return n })
  }, [source])

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
        <h1 className="font-display italic text-2xl text-gray-900">Internal Link Suggestions</h1>
        <p className="font-sans text-sm text-gray-500 mt-0.5">
          Pick a page — get ranked suggestions for internal links based on region, name similarity, and keyword overlap.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Source entity picker */}
        <div className="bg-white border border-gray-200">
          <button
            onClick={() => setPickerOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LinkIcon size={15} className="text-[#2d6a4f]" />
              <span className="font-sans text-sm font-medium text-gray-800">
                {source ? source.name : 'Select a source page'}
              </span>
              {source && (
                <span className={`font-sans text-[10px] tracking-wide uppercase px-2 py-0.5 font-semibold ${kindCls(source.kind)}`}>
                  {source.kindLabel}
                </span>
              )}
            </div>
            {pickerOpen
              ? <ChevronUp size={14} className="text-gray-400" />
              : <ChevronDown size={14} className="text-gray-400" />}
          </button>

          {pickerOpen && (
            <div className="border-t border-gray-100">
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
              <div className="max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="font-sans text-sm">Loading…</span>
                  </div>
                ) : pickerFiltered.length === 0 ? (
                  <p className="font-sans text-sm text-gray-400 text-center py-6">No entities match.</p>
                ) : (
                  pickerFiltered.map(item => (
                    <button
                      key={item.id}
                      onClick={() => selectSource(item)}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${source?.id === item.id ? 'bg-emerald-50' : ''}`}
                    >
                      <span className={`font-sans text-[10px] tracking-wide uppercase px-2 py-0.5 font-semibold shrink-0 ${kindCls(item.kind)}`}>
                        {item.kindLabel}
                      </span>
                      <span className="font-sans text-sm text-gray-800 flex-1 truncate">{item.name}</span>
                      {item.region && (
                        <span className="font-sans text-[11px] text-gray-400 shrink-0 hidden sm:block truncate max-w-36">
                          {item.region}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {source && !loading && (
          <>
            {/* Source summary */}
            <div className="bg-white border border-gray-200 px-5 py-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className={labelCls}>Suggesting links for</p>
                <p className="font-display italic text-base text-gray-900">{source.name}</p>
                <p className="font-sans text-[11px] text-gray-400">{SITE_URL}{source.path}</p>
              </div>
              {dismissedCount > 0 && (
                <button
                  onClick={() => setShowDismissed(v => !v)}
                  className="font-sans text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  {showDismissed ? 'Hide' : 'Show'} {dismissedCount} dismissed
                </button>
              )}
              <Link href={source.editPath}
                className="font-sans text-sm border border-gray-300 text-gray-600 px-3 py-1.5 hover:bg-gray-100 transition-colors flex items-center gap-1.5">
                Edit page <ExternalLink size={12} />
              </Link>
            </div>

            {/* Suggestion list */}
            {visible.length === 0 ? (
              <div className="bg-white border border-gray-200 p-12 text-center">
                <p className="font-display italic text-lg text-gray-400 mb-1">No suggestions</p>
                <p className="font-sans text-sm text-gray-400">
                  {suggestions.length === 0
                    ? 'No other entities share enough region, name, or keyword overlap with this page.'
                    : 'All suggestions have been dismissed.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className={labelCls}>
                  {visible.length} suggestion{visible.length !== 1 ? 's' : ''} · sorted by relevance
                </p>
                {visible.map(s => {
                  const isDismissed = dismissed.has(s.entity.id)
                  const fullUrl = `${SITE_URL}${s.entity.path}`
                  return (
                    <div
                      key={s.entity.id}
                      className={`bg-white border border-gray-200 p-4 flex flex-wrap gap-4 items-start ${isDismissed ? 'opacity-50' : ''}`}
                    >
                      {/* Left: entity info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`font-sans text-[10px] tracking-wide uppercase px-2 py-0.5 font-semibold ${kindCls(s.entity.kind)}`}>
                            {s.entity.kindLabel}
                          </span>
                          <span className={`font-sans text-[10px] font-semibold px-2 py-0.5 border tabular-nums ${relevanceBadge(s.relevance)}`}>
                            {relevanceLabel(s.relevance)} · {Math.round(s.relevance * 100)}%
                          </span>
                        </div>
                        <p className="font-display italic text-base text-gray-900 leading-snug mb-0.5">{s.entity.name}</p>
                        <p className="font-sans text-[11px] text-gray-400 mb-2 break-all">{s.entity.path}</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {s.signals.map(sig => <SignalChip key={sig} signal={sig} />)}
                          <span className="font-sans text-[10px] text-gray-400 self-center">{s.reason}</span>
                        </div>
                        {s.entity.seoDescription && (
                          <p className="font-sans text-xs text-gray-500 line-clamp-2">{s.entity.seoDescription}</p>
                        )}
                      </div>

                      {/* Right: actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <CopyButton text={fullUrl} label="Copy URL" />
                        <CopyButton
                          text={`<a href="${s.entity.path}">${s.entity.name}</a>`}
                          label="Copy HTML"
                        />
                        <Link href={s.entity.editPath}
                          className="font-sans text-sm text-gray-400 hover:text-[#2d6a4f] flex items-center gap-1.5">
                          Edit <ExternalLink size={11} />
                        </Link>
                        {isDismissed ? (
                          <button onClick={() => restore(s.entity.id)}
                            className="font-sans text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            <RotateCcw size={11} /> Restore
                          </button>
                        ) : (
                          <button onClick={() => dismiss(s.entity.id)}
                            className="font-sans text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            <X size={11} /> Dismiss
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* How to use note */}
            <div className="bg-white border border-gray-200 p-4">
              <p className={labelCls}>How to use these suggestions</p>
              <ol className="font-sans text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Copy a URL or HTML link using the buttons above.</li>
                <li>Open the target entity's editor via the <span className="italic">Edit</span> link.</li>
                <li>Paste the link into the description or related-entities field.</li>
                <li>Dismiss suggestions you've already added or intentionally excluded.</li>
              </ol>
            </div>
          </>
        )}

        {/* Initial empty state */}
        {!source && !loading && (
          <div className="bg-white border border-gray-200 p-12 text-center">
            <LinkIcon size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="font-display italic text-lg text-gray-400 mb-1">Select a source page above</p>
            <p className="font-sans text-sm text-gray-400">
              Link suggestions are computed from region proximity, name similarity, and keyword overlap — no AI.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

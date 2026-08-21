'use client'

/**
 * Tool 4: Related Entity Manager — /admin/seo/related
 *
 * Pick any entity, see its current related entities, and add or remove
 * relationships across all kinds (trails, stays, activities). Changes write
 * directly to the entity's `relatedTrailIds`, `relatedPropertyIds`, and
 * `relatedActivityIds` fields via the entity-type-specific update functions.
 *
 * The existing Link Suggestions page (Tool 3) surfaces candidates to add;
 * this page is where those relationships are actually recorded.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Loader2, Search, Plus, X, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Link as LinkIcon, ExternalLink,
} from 'lucide-react'
import { getTrails, saveTrails } from '@/lib/trails'
import { getProperties, updateProperty } from '@/lib/properties'
import { getActivities, updateActivity } from '@/lib/activities'
import { getRegions } from '@/lib/regions'
import type { Trail } from '@/lib/trails'
import type { Property } from '@/lib/properties'
import type { Activity } from '@/lib/activities'

// ── Types ─────────────────────────────────────────────────────────────────────

type EntityKind = 'trail' | 'property' | 'activity' | 'region'

type EntityRef = {
  id: string
  kind: EntityKind
  kindLabel: string
  name: string
  slug: string | undefined | null
  region: string | undefined | null
  status: string
  path: string
  editPath: string
}

const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

function kindCls(kind: EntityKind) {
  return kind === 'trail'
    ? 'bg-emerald-50 text-emerald-700'
    : kind === 'property'
    ? 'bg-violet-50 text-violet-700'
    : kind === 'activity'
    ? 'bg-sky-50 text-sky-700'
    : 'bg-amber-50 text-amber-700'
}

// ── Entity data ───────────────────────────────────────────────────────────────

type LoadedData = {
  trails: Trail[]
  properties: Property[]
  activities: Activity[]
  refs: EntityRef[]
  refMap: Map<string, EntityRef>
}

// ── Patch helpers — write relatedXxxIds back to each entity type ──────────────

async function patchTrailRelated(
  id: string,
  trails: Trail[],
  patch: { relatedTrailIds?: string[]; relatedPropertyIds?: string[]; relatedActivityIds?: string[] },
): Promise<void> {
  const updated = trails.map(t =>
    t.id === id ? { ...t, ...patch } : t,
  )
  await saveTrails(updated)
}

async function patchPropertyRelated(
  id: string,
  patch: { relatedTrailIds?: string[]; relatedPropertyIds?: string[]; relatedActivityIds?: string[] },
): Promise<void> {
  await updateProperty(id, patch)
}

async function patchActivityRelated(
  id: string,
  patch: { relatedTrailIds?: string[]; relatedPropertyIds?: string[]; relatedActivityIds?: string[] },
): Promise<void> {
  await updateActivity(id, patch)
}

// ── Relationship group component ──────────────────────────────────────────────

function RelGroup({
  label,
  kindFilter,
  currentIds,
  allRefs,
  onAdd,
  onRemove,
  saving,
}: {
  label: string
  kindFilter: EntityKind
  currentIds: string[]
  allRefs: EntityRef[]
  onAdd: (ref: EntityRef) => void
  onRemove: (id: string) => void
  saving: boolean
}) {
  const [open, setOpen] = useState(true)
  const [search, setSearch] = useState('')

  const linked = useMemo(
    () => currentIds.map(id => allRefs.find(r => r.id === id)).filter(Boolean) as EntityRef[],
    [currentIds, allRefs],
  )

  const candidates = useMemo(() => {
    const q = search.toLowerCase().trim()
    return allRefs.filter(r => {
      if (r.kind !== kindFilter) return false
      if (currentIds.includes(r.id)) return false
      if (!q) return true
      return r.name.toLowerCase().includes(q) || r.region?.toLowerCase().includes(q)
    })
  }, [allRefs, kindFilter, currentIds, search])

  return (
    <div className="bg-white border border-gray-200">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`font-sans text-[10px] tracking-wide uppercase px-2 py-0.5 font-semibold ${kindCls(kindFilter)}`}>
            {label}
          </span>
          <span className="font-sans text-xs text-gray-500">{linked.length} linked</span>
        </div>
        {open ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Linked chips */}
          {linked.length > 0 && (
            <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-gray-50">
              {linked.map(ref => (
                <div
                  key={ref.id}
                  className="flex items-center gap-1.5 bg-[#F7F5F2] border border-gray-200 px-2.5 py-1"
                >
                  <span className="font-sans text-sm text-gray-700">{ref.name}</span>
                  <button
                    onClick={() => onRemove(ref.id)}
                    disabled={saving}
                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                    title={`Remove ${ref.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search + add */}
          <div className="px-5 py-3">
            <div className="flex items-center gap-2 border border-gray-200 bg-[#F7F5F2] px-3 py-2 mb-2">
              <Search size={12} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder={`Search ${label.toLowerCase()}…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent font-sans text-sm outline-none placeholder:text-gray-400"
              />
            </div>
            {search.trim() !== '' && (
              <div className="max-h-48 overflow-y-auto border border-gray-100 divide-y divide-gray-50">
                {candidates.length === 0 ? (
                  <p className="font-sans text-sm text-gray-400 text-center py-3">No matches.</p>
                ) : (
                  candidates.slice(0, 12).map(ref => (
                    <button
                      key={ref.id}
                      onClick={() => { onAdd(ref); setSearch('') }}
                      disabled={saving}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors disabled:opacity-40"
                    >
                      <Plus size={12} className="text-[#2d6a4f] shrink-0" />
                      <span className="font-sans text-sm text-gray-800 flex-1 truncate">{ref.name}</span>
                      {ref.region && (
                        <span className="font-sans text-[11px] text-gray-400 shrink-0 hidden sm:block">{ref.region}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RelatedEntityManagerPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LoadedData | null>(null)

  // Source entity picker
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerKind, setPickerKind] = useState<'all' | EntityKind>('all')
  const [pickerOpen, setPickerOpen] = useState(true)
  const [source, setSource] = useState<EntityRef | null>(null)

  // Working related IDs (draft before save)
  const [relTrail, setRelTrail] = useState<string[]>([])
  const [relProperty, setRelProperty] = useState<string[]>([])
  const [relActivity, setRelActivity] = useState<string[]>([])

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<'ok' | 'err' | null>(null)
  const [dirty, setDirty] = useState(false)

  // ── Load all entities ────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [trails, properties, activities, regions] = await Promise.all([
        getTrails(), getProperties(), getActivities(), getRegions(),
      ])
      const refs: EntityRef[] = []
      for (const t of trails) refs.push({
        id: t.id, kind: 'trail', kindLabel: 'Trail', name: t.name,
        slug: t.slug, region: t.region, status: t.status,
        path: `/hikes/${t.slug ?? t.id}`, editPath: `/admin/trails/${t.id}`,
      })
      for (const p of properties) refs.push({
        id: p.id, kind: 'property', kindLabel: 'Stay', name: p.name,
        slug: p.slug, region: p.region, status: p.status,
        path: `/stays/${p.slug ?? p.id}`, editPath: `/admin/properties/${p.id}`,
      })
      for (const a of activities) refs.push({
        id: a.id, kind: 'activity', kindLabel: 'Activity', name: a.name,
        slug: a.slug, region: a.region, status: a.status,
        path: `/activities/${a.slug ?? a.id}`, editPath: `/admin/activities/${a.id}`,
      })
      for (const r of regions) refs.push({
        id: r.id, kind: 'region', kindLabel: 'Region', name: r.name,
        slug: r.slug, region: r.name, status: 'published',
        path: `/regions/${r.slug ?? r.id}`, editPath: `/admin/regions/${r.id}`,
      })
      refs.sort((a, b) => a.name.localeCompare(b.name))
      const refMap = new Map(refs.map(r => [r.id, r]))
      setData({ trails, properties, activities, refs, refMap })
      setLoading(false)
    }
    load()
  }, [])

  // ── Picker filter ──────────────────────────────────────────────────────
  const pickerItems = useMemo(() => {
    if (!data) return []
    const q = pickerSearch.toLowerCase().trim()
    return data.refs.filter(r => {
      if (pickerKind !== 'all' && r.kind !== pickerKind) return false
      if (q && !r.name.toLowerCase().includes(q) && !r.region?.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, pickerSearch, pickerKind])

  // ── Select source ──────────────────────────────────────────────────────
  const selectSource = useCallback((ref: EntityRef) => {
    setSource(ref)
    setPickerOpen(false)
    setSaveResult(null)
    setDirty(false)

    // Seed working state from the actual entity
    if (!data) return
    if (ref.kind === 'trail') {
      const t = data.trails.find(x => x.id === ref.id)
      setRelTrail(t?.relatedTrailIds ?? [])
      setRelProperty(t?.relatedPropertyIds ?? [])
      setRelActivity(t?.relatedActivityIds ?? [])
    } else if (ref.kind === 'property') {
      const p = data.properties.find(x => x.id === ref.id)
      setRelTrail(p?.relatedTrailIds ?? [])
      setRelProperty(p?.relatedPropertyIds ?? [])
      setRelActivity(p?.relatedActivityIds ?? [])
    } else if (ref.kind === 'activity') {
      const a = data.activities.find(x => x.id === ref.id)
      setRelTrail(a?.relatedTrailIds ?? [])
      setRelProperty(a?.relatedPropertyIds ?? [])
      setRelActivity(a?.relatedActivityIds ?? [])
    } else {
      // Regions don't have explicit related-entity arrays yet
      setRelTrail([])
      setRelProperty([])
      setRelActivity([])
    }
  }, [data])

  // ── Add / remove helpers ───────────────────────────────────────────────
  const add = useCallback((kind: EntityKind, ref: EntityRef) => {
    if (kind === 'trail') setRelTrail(p => [...new Set([...p, ref.id])])
    else if (kind === 'property') setRelProperty(p => [...new Set([...p, ref.id])])
    else if (kind === 'activity') setRelActivity(p => [...new Set([...p, ref.id])])
    setDirty(true)
    setSaveResult(null)
  }, [])

  const remove = useCallback((kind: EntityKind, id: string) => {
    if (kind === 'trail') setRelTrail(p => p.filter(x => x !== id))
    else if (kind === 'property') setRelProperty(p => p.filter(x => x !== id))
    else if (kind === 'activity') setRelActivity(p => p.filter(x => x !== id))
    setDirty(true)
    setSaveResult(null)
  }, [])

  // ── Save ───────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!source || !data) return
    setSaving(true)
    setSaveResult(null)
    try {
      const patch = {
        relatedTrailIds: relTrail,
        relatedPropertyIds: relProperty,
        relatedActivityIds: relActivity,
      }
      if (source.kind === 'trail') {
        await patchTrailRelated(source.id, data.trails, patch)
        // Refresh local trails state
        setData(prev => prev ? {
          ...prev,
          trails: prev.trails.map(t => t.id === source.id ? { ...t, ...patch } : t),
        } : prev)
      } else if (source.kind === 'property') {
        await patchPropertyRelated(source.id, patch)
      } else if (source.kind === 'activity') {
        await patchActivityRelated(source.id, patch)
      }
      setSaveResult('ok')
      setDirty(false)
    } catch {
      setSaveResult('err')
    } finally {
      setSaving(false)
    }
  }, [source, data, relTrail, relProperty, relActivity])

  const totalLinked = relTrail.length + relProperty.length + relActivity.length

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/admin/seo" className="font-sans text-xs text-gray-400 hover:text-gray-600">
            ← SEO Console
          </Link>
        </div>
        <h1 className="font-display italic text-2xl text-gray-900">Related Entity Manager</h1>
        <p className="font-sans text-sm text-gray-500 mt-0.5">
          Add and remove explicit internal links between entities. These power the "Related trails", "Nearby stays", and "Activities" sections on public pages.
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* Source picker */}
        <div className="bg-white border border-gray-200">
          <button
            onClick={() => setPickerOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LinkIcon size={15} className="text-[#2d6a4f]" />
              <span className="font-sans text-sm font-medium text-gray-800">
                {source ? source.name : 'Select a page to manage'}
              </span>
              {source && (
                <span className={`font-sans text-[10px] tracking-wide uppercase px-2 py-0.5 font-semibold ${kindCls(source.kind)}`}>
                  {source.kindLabel}
                </span>
              )}
            </div>
            {pickerOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>

          {pickerOpen && (
            <div className="border-t border-gray-100">
              <div className="flex gap-2 p-3 border-b border-gray-100">
                <div className="flex-1 flex items-center gap-2 border border-gray-200 bg-[#F7F5F2] px-3 py-2">
                  <Search size={13} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search by name or region…"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    className="flex-1 bg-transparent font-sans text-sm outline-none placeholder:text-gray-400"
                  />
                </div>
                <select
                  value={pickerKind}
                  onChange={e => setPickerKind(e.target.value as typeof pickerKind)}
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
                ) : pickerItems.length === 0 ? (
                  <p className="font-sans text-sm text-gray-400 text-center py-6">No entities match.</p>
                ) : (
                  pickerItems.map(item => (
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
                        <span className="font-sans text-[11px] text-gray-400 shrink-0 hidden sm:block truncate max-w-36">{item.region}</span>
                      )}
                      <span className={`font-sans text-[10px] px-2 py-0.5 shrink-0 ${['active','published'].includes(item.status) ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                        {item.status}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Relationship editor */}
        {source && data && (
          <>
            {/* Source summary + save */}
            <div className="bg-white border border-gray-200 px-5 py-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className={labelCls}>Managing relationships for</p>
                <p className="font-display italic text-base text-gray-900">{source.name}</p>
                <p className="font-sans text-[11px] text-gray-400">{source.path} · {totalLinked} linked</p>
              </div>
              <Link href="/admin/seo/links"
                className="font-sans text-sm text-gray-400 hover:text-[#2d6a4f] flex items-center gap-1.5 shrink-0">
                Link suggestions <ExternalLink size={11} />
              </Link>
              <Link href={source.editPath}
                className="font-sans text-sm border border-gray-300 text-gray-600 px-3 py-1.5 hover:bg-gray-100 transition-colors flex items-center gap-1.5 shrink-0">
                Edit page <ExternalLink size={12} />
              </Link>
            </div>

            {/* Region note */}
            {source.kind === 'region' && (
              <div className="bg-amber-50 border border-amber-200 px-5 py-3 font-sans text-sm text-amber-800">
                Region pages currently use structural graph queries (same-region child entities) rather than explicit
                relatedXxxIds arrays. Edit relationships via trail/stay/activity pages instead.
              </div>
            )}

            {source.kind !== 'region' && (
              <>
                <RelGroup
                  label="Related Trails"
                  kindFilter="trail"
                  currentIds={relTrail}
                  allRefs={data.refs}
                  onAdd={ref => add('trail', ref)}
                  onRemove={id => remove('trail', id)}
                  saving={saving}
                />
                <RelGroup
                  label="Related Stays"
                  kindFilter="property"
                  currentIds={relProperty}
                  allRefs={data.refs}
                  onAdd={ref => add('property', ref)}
                  onRemove={id => remove('property', id)}
                  saving={saving}
                />
                <RelGroup
                  label="Related Activities"
                  kindFilter="activity"
                  currentIds={relActivity}
                  allRefs={data.refs}
                  onAdd={ref => add('activity', ref)}
                  onRemove={id => remove('activity', id)}
                  saving={saving}
                />

                {/* Save bar */}
                <div className="bg-white border border-gray-200 px-5 py-4 flex items-center gap-4 flex-wrap">
                  {saveResult === 'ok' && (
                    <div className="flex items-center gap-1.5 text-emerald-600 font-sans text-sm">
                      <CheckCircle size={14} /> Saved successfully
                    </div>
                  )}
                  {saveResult === 'err' && (
                    <div className="flex items-center gap-1.5 text-red-600 font-sans text-sm">
                      <AlertCircle size={14} /> Save failed — try again
                    </div>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={save}
                    disabled={saving || !dirty}
                    className="font-sans text-sm bg-[#2d6a4f] text-white px-5 py-2.5 hover:bg-[#245a42] transition-colors disabled:opacity-40 flex items-center gap-2"
                  >
                    {saving && <Loader2 size={13} className="animate-spin" />}
                    {saving ? 'Saving…' : 'Save relationships'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Empty state */}
        {!source && !loading && (
          <div className="bg-white border border-gray-200 p-12 text-center">
            <LinkIcon size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="font-display italic text-lg text-gray-400 mb-1">Select a page above</p>
            <p className="font-sans text-sm text-gray-400">
              Pick any trail, stay, or activity to add or remove its explicit internal links.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

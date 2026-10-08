'use client'

/**
 * Curate what each Grand Tour stage features beside its day tours:
 * activities and experiences, events and guided tours from the live
 * catalogue. Stored in vd_grand_tour_features
 * (supabase/migrations/20261009_grand_tour_features.sql); any VD Operations
 * employee may curate, with no per-supplier assignment needed.
 */

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Search, Trash2, Check } from 'lucide-react'
import { getActivities } from '@/lib/activities'
import { getTours } from '@/lib/tours'
import { getSupplierEntities } from '@/lib/supplier-entities'
import type { Event } from '@/lib/events'
import { isEventUpcoming } from '@/lib/upcoming'
import { formatMoney } from '@/lib/allocation'
import { GRAND_TOUR_STAGES } from '@/lib/grand-tour'
import {
  getGrandTourFeatures, addGrandTourFeature, removeGrandTourFeature, updateGrandTourFeature,
  activityItem, eventItem, tourItem,
  type GrandTourFeature, type CatalogueItem, type FeatureKind,
} from '@/lib/grand-tour-features'

const KIND_FILTERS: { key: 'all' | FeatureKind; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'activity', label: 'Activities & experiences' },
  { key: 'event', label: 'Events' },
  { key: 'tour', label: 'Guided tours' },
]

export default function StageFeaturesManager() {
  const [stageId, setStageId] = useState(GRAND_TOUR_STAGES[0].id)
  const [features, setFeatures] = useState<GrandTourFeature[]>([])
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | FeatureKind>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      getGrandTourFeatures(),
      getActivities().catch(() => []),
      getTours().catch(() => []),
      getSupplierEntities<Event>('events').catch(() => [] as Event[]),
    ]).then(([f, acts, tours, events]) => {
      setFeatures(f)
      setCatalogue([
        ...acts.map(activityItem),
        ...tours.map(tourItem),
        ...events
          .filter(e => (e.sessions ?? []).some(s => s.status === 'active' && isEventUpcoming(s)) || isEventUpcoming(e))
          .map(eventItem),
      ].filter(i => i.live))
    }).finally(() => setLoading(false))
  }, [])

  const stage = GRAND_TOUR_STAGES.find(s => s.id === stageId)!
  const byKey = useMemo(() => new Map(catalogue.map(i => [`${i.kind}:${i.id}`, i])), [catalogue])
  const onStage = features.filter(f => f.stageId === stageId).sort((a, b) => a.position - b.position)
  const featuredKeys = new Set(onStage.map(f => `${f.kind}:${f.entityId}`))

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalogue
      .filter(i => (kind === 'all' || i.kind === kind) && (!q || `${i.name} ${i.region ?? ''} ${i.detail ?? ''}`.toLowerCase().includes(q)))
      // This stage's own area first: a Southern Berg stage wants Southern Berg things.
      .sort((a, b) => Number(b.region === stage.area) - Number(a.region === stage.area) || a.name.localeCompare(b.name))
      .slice(0, 30)
  }, [catalogue, query, kind, stage.area])

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key)
    setError('')
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.') } finally { setBusy(null) }
  }

  const add = (item: CatalogueItem) => run(`add:${item.kind}:${item.id}`, async () => {
    const position = onStage.length ? Math.max(...onStage.map(f => f.position)) + 1 : 0
    const created = await addGrandTourFeature({ stageId, kind: item.kind, entityId: item.id, position })
    setFeatures(fs => [...fs, created])
  })

  const remove = (f: GrandTourFeature) => run(`rm:${f.id}`, async () => {
    await removeGrandTourFeature(f.id)
    setFeatures(fs => fs.filter(x => x.id !== f.id))
  })

  const move = (index: number, dir: -1 | 1) => run(`mv:${onStage[index].id}`, async () => {
    const a = onStage[index], b = onStage[index + dir]
    if (!b) return
    // Swap through distinct values so two rows never share a position.
    await updateGrandTourFeature(a.id, { position: b.position === a.position ? a.position + dir : b.position })
    await updateGrandTourFeature(b.id, { position: a.position })
    setFeatures(fs => fs.map(x =>
      x.id === a.id ? { ...x, position: b.position === a.position ? a.position + dir : b.position }
      : x.id === b.id ? { ...x, position: a.position } : x))
  })

  const saveNote = (f: GrandTourFeature, note: string) => {
    if ((f.note ?? '') === note.trim()) return
    run(`note:${f.id}`, async () => {
      await updateGrandTourFeature(f.id, { note: note.trim() || null })
      setFeatures(fs => fs.map(x => (x.id === f.id ? { ...x, note: note.trim() || null } : x)))
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* Stages */}
      <nav aria-label="Stages" className="lg:sticky lg:top-6 h-fit">
        <select value={stageId} onChange={e => setStageId(e.target.value)} className="lg:hidden w-full border border-gray-200 bg-white px-3 py-2 font-sans text-sm" aria-label="Stage">
          {GRAND_TOUR_STAGES.map(s => <option key={s.id} value={s.id}>{s.number}. {s.name}</option>)}
        </select>
        <ol className="hidden lg:block border border-gray-200 bg-white divide-y divide-gray-100">
          {GRAND_TOUR_STAGES.map(s => {
            const count = features.filter(f => f.stageId === s.id).length
            return (
              <li key={s.id}>
                <button onClick={() => setStageId(s.id)} className={`w-full text-left px-4 py-3 font-sans text-sm flex justify-between gap-2 ${s.id === stageId ? 'bg-[#2d6a4f]/8 text-[#2d6a4f] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <span>{s.number}. {s.name}</span>
                  {count > 0 && <span className="text-xs text-gray-400 tabular-nums">{count}</span>}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="space-y-6 min-w-0">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">{stage.area}</p>
          <h2 className="font-display italic text-2xl">{stage.name}</h2>
          <p className="font-sans text-sm text-gray-500 mt-1">
            Shown on /grand-tour as “Also at {stage.name}”, in this order, beside the stage’s day tours.
          </p>
        </div>

        {error && <p className="font-sans text-sm text-red-600" role="alert">{error}</p>}

        {/* Current features */}
        <section>
          <h3 className="font-sans text-[11px] tracking-wider uppercase text-gray-500 mb-2">Featured here ({onStage.length})</h3>
          {loading ? (
            <p className="font-sans text-sm text-gray-400">Loading…</p>
          ) : onStage.length === 0 ? (
            <p className="font-sans text-sm text-gray-500 bg-white border border-dashed border-gray-300 px-4 py-6 text-center">
              Nothing featured yet. Add activities, events or guided tours from the catalogue below.
            </p>
          ) : (
            <ul className="space-y-2">
              {onStage.map((f, i) => {
                const item = byKey.get(`${f.kind}:${f.entityId}`)
                return (
                  <li key={f.id} className="bg-white border border-gray-200 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-[10px] tracking-wider uppercase text-gray-400">{item?.kindLabel ?? f.kind}{item?.detail ? ` · ${item.detail}` : ''}</p>
                      <p className="font-sans text-sm text-gray-900 truncate">
                        {item?.name ?? <span className="text-amber-700">No longer live — hidden on the page</span>}
                      </p>
                      <input
                        defaultValue={f.note ?? ''}
                        onBlur={e => saveNote(f, e.target.value)}
                        maxLength={140}
                        placeholder="Optional one-liner, e.g. Sundowners on Sani Top"
                        aria-label="Note shown on the card"
                        className="mt-1.5 w-full border border-gray-100 px-2 py-1 font-sans text-xs focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => move(i, -1)} disabled={i === 0 || !!busy} aria-label="Move up" className="p-2 text-gray-400 hover:text-black disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button onClick={() => move(i, 1)} disabled={i === onStage.length - 1 || !!busy} aria-label="Move down" className="p-2 text-gray-400 hover:text-black disabled:opacity-30"><ArrowDown size={14} /></button>
                      <button onClick={() => remove(f)} disabled={!!busy} aria-label="Remove" className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30"><Trash2 size={14} /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Catalogue */}
        <section>
          <h3 className="font-sans text-[11px] tracking-wider uppercase text-gray-500 mb-2">Add from the catalogue</h3>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <label className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, region or date" aria-label="Search the catalogue" className="w-full border border-gray-200 bg-white pl-9 pr-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
            </label>
            <div className="flex flex-wrap gap-1">
              {KIND_FILTERS.map(k => (
                <button key={k.key} onClick={() => setKind(k.key)} className={`px-3 py-2 font-sans text-xs border ${kind === k.key ? 'bg-[#2d6a4f] border-[#2d6a4f] text-white' : 'border-gray-200 bg-white text-gray-600'}`}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          {loading ? null : results.length === 0 ? (
            <p className="font-sans text-sm text-gray-500">Nothing live matches. Only published listings and upcoming events can be featured.</p>
          ) : (
            <ul className="bg-white border border-gray-200 divide-y divide-gray-100">
              {results.map(item => {
                const key = `${item.kind}:${item.id}`
                const already = featuredKeys.has(key)
                return (
                  <li key={key} className="px-3 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm text-gray-900 truncate">{item.name}</p>
                      <p className="font-sans text-[11px] text-gray-400">
                        {item.kindLabel}{item.region ? ` · ${item.region}` : ''}{item.detail ? ` · ${item.detail}` : ''}{item.price ? ` · from ${formatMoney(item.price)}` : ''}
                        {item.region === stage.area && <span className="text-[#2d6a4f]"> · this area</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => add(item)}
                      disabled={already || !!busy}
                      className="font-sans text-xs border border-[#2d6a4f] text-[#2d6a4f] px-3 py-1.5 hover:bg-[#2d6a4f] hover:text-white disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-transparent flex items-center gap-1 shrink-0"
                    >
                      {already ? <><Check size={12} /> Featured</> : <><Plus size={12} /> Feature</>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

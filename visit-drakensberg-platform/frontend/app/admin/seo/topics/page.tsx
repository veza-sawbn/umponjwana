'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Loader2, Plus, Trash2, Pencil, CheckCircle, AlertCircle,
  AlertTriangle, X, Search, BookOpen,
} from 'lucide-react'
import { getTrails } from '@/lib/trails'
import type { Trail } from '@/lib/trails'
import { getProperties } from '@/lib/properties'
import type { Property } from '@/lib/properties'
import { getActivities } from '@/lib/activities'
import type { Activity } from '@/lib/activities'
import { getRegions } from '@/lib/regions'
import type { Region } from '@/lib/regions'
import {
  getTopicMap, addTopicEntry, updateTopicEntry, deleteTopicEntry,
} from '@/lib/topic-map'
import type { TopicEntry, TopicEntityRef, TopicEntityKind } from '@/lib/topic-map'

// ── Types ─────────────────────────────────────────────────────────────────────

type EntityOption = {
  id: string
  label: string
  kind: TopicEntityKind
  kindLabel: string
  path: string
  sublabel: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'
const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'

const KIND_LABELS: Record<TopicEntityKind, string> = {
  trail: 'Trail', property: 'Stay', activity: 'Activity', region: 'Region',
}

const KIND_PATH_PREFIX: Record<TopicEntityKind, string> = {
  trail: '/hikes', property: '/stay', activity: '/activities', region: '/regions',
}

function entityPath(kind: TopicEntityKind, entity: { id: string; slug?: string }): string {
  const base = KIND_PATH_PREFIX[kind]
  return `${base}/${entity.slug ?? entity.id}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Entity picker component ───────────────────────────────────────────────────

function EntityPicker({
  label,
  value,
  options,
  onChange,
  placeholder = 'Search entities…',
}: {
  label: string
  value: TopicEntityRef | null
  options: EntityOption[]
  onChange: (ref: TopicEntityRef | null) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!query.trim()) return options.slice(0, 12)
    const q = query.toLowerCase()
    return options.filter(o =>
      o.label.toLowerCase().includes(q) || o.kindLabel.toLowerCase().includes(q) || o.sublabel.toLowerCase().includes(q)
    ).slice(0, 12)
  }, [options, query])

  function select(opt: EntityOption) {
    onChange({ kind: opt.kind, id: opt.id, label: opt.label, path: opt.path })
    setQuery('')
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setQuery('')
  }

  return (
    <div>
      <label className={labelCls}>{label}</label>
      {value ? (
        <div className="flex items-center gap-2 border border-[#2d6a4f] bg-[#2d6a4f]/5 px-3 py-2.5">
          <span className="font-sans text-[10px] px-1.5 py-0.5 bg-[#2d6a4f]/10 text-[#2d6a4f]">
            {KIND_LABELS[value.kind]}
          </span>
          <span className="font-sans text-sm text-gray-800 flex-1 truncate">{value.label}</span>
          <code className="font-mono text-[10px] text-gray-400 truncate max-w-[120px]">{value.path}</code>
          <button onClick={clear} className="text-gray-400 hover:text-red-500 transition-colors shrink-0">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={placeholder}
              className="w-full border border-gray-200 pl-8 pr-3 py-2.5 font-sans text-sm bg-[#F7F5F2] focus:outline-none focus:border-[#2d6a4f]"
            />
          </div>
          {open && filtered.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 shadow-md max-h-48 overflow-y-auto">
              {filtered.map(opt => (
                <button
                  key={opt.id}
                  onMouseDown={() => select(opt)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[#F7F5F2] flex items-center gap-2 border-b border-gray-100 last:border-0"
                >
                  <span className="font-sans text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 shrink-0">
                    {opt.kindLabel}
                  </span>
                  <span className="font-sans text-sm text-gray-800 truncate flex-1">{opt.label}</span>
                  <span className="font-sans text-[10px] text-gray-400 truncate max-w-[100px]">{opt.sublabel}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Supporting entity chips ───────────────────────────────────────────────────

function SupportingPicker({
  selected,
  options,
  canonicalId,
  onChange,
}: {
  selected: TopicEntityRef[]
  options: EntityOption[]
  canonicalId: string | null
  onChange: (refs: TopicEntityRef[]) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selectedIds = new Set(selected.map(s => s.id))

  const filtered = useMemo(() => {
    const pool = options.filter(o => !selectedIds.has(o.id) && o.id !== canonicalId)
    if (!query.trim()) return pool.slice(0, 10)
    const q = query.toLowerCase()
    return pool.filter(o => o.label.toLowerCase().includes(q) || o.kindLabel.toLowerCase().includes(q)).slice(0, 10)
  }, [options, selected, canonicalId, query])

  function add(opt: EntityOption) {
    onChange([...selected, { kind: opt.kind, id: opt.id, label: opt.label, path: opt.path }])
    setQuery('')
    setOpen(false)
  }

  function remove(id: string) {
    onChange(selected.filter(s => s.id !== id))
  }

  return (
    <div>
      <label className={labelCls}>Supporting entities</label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map(s => (
            <div key={s.id} className="flex items-center gap-1 bg-gray-100 px-2 py-1 font-sans text-xs">
              <span className="text-gray-500">{KIND_LABELS[s.kind]}</span>
              <span className="text-gray-700 mx-1">{s.label}</span>
              <button onClick={() => remove(s.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Add supporting entity…"
            className="w-full border border-gray-200 pl-8 pr-3 py-2 font-sans text-sm bg-[#F7F5F2] focus:outline-none focus:border-[#2d6a4f]"
          />
        </div>
        {open && filtered.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 shadow-md max-h-40 overflow-y-auto">
            {filtered.map(opt => (
              <button
                key={opt.id}
                onMouseDown={() => add(opt)}
                className="w-full text-left px-3 py-2 hover:bg-[#F7F5F2] flex items-center gap-2 border-b border-gray-100 last:border-0"
              >
                <span className="font-sans text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 shrink-0">
                  {opt.kindLabel}
                </span>
                <span className="font-sans text-sm text-gray-800 truncate">{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Form state ────────────────────────────────────────────────────────────────

type FormState = {
  topic: string
  canonical: TopicEntityRef | null
  supporting: TopicEntityRef[]
  notes: string
}

const EMPTY_FORM: FormState = { topic: '', canonical: null, supporting: [], notes: '' }

// ── Main component ────────────────────────────────────────────────────────────

export default function TopicMapPage() {
  const [entries, setEntries] = useState<TopicEntry[]>([])
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [topics, trails, properties, activities, regions] = await Promise.all([
          getTopicMap().catch(() => [] as TopicEntry[]),
          getTrails().catch(() => [] as Trail[]),
          getProperties().catch(() => [] as Property[]),
          getActivities().catch(() => [] as Activity[]),
          getRegions().catch(() => [] as Region[]),
        ])

        setEntries(topics)

        const opts: EntityOption[] = [
          ...trails.map(t => ({
            id: t.id, label: t.name, kind: 'trail' as TopicEntityKind,
            kindLabel: 'Trail', path: entityPath('trail', t), sublabel: t.region ?? '',
          })),
          ...properties.map(p => ({
            id: p.id, label: p.name, kind: 'property' as TopicEntityKind,
            kindLabel: 'Stay', path: entityPath('property', p), sublabel: p.region ?? '',
          })),
          ...activities.map(a => ({
            id: a.id, label: a.name, kind: 'activity' as TopicEntityKind,
            kindLabel: 'Activity', path: entityPath('activity', a), sublabel: a.category ?? '',
          })),
          ...regions.map(r => ({
            id: r.id, label: r.name, kind: 'region' as TopicEntityKind,
            kindLabel: 'Region', path: entityPath('region', r), sublabel: '',
          })),
        ].sort((a, b) => a.label.localeCompare(b.label))

        setEntityOptions(opts)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function startEdit(entry: TopicEntry) {
    setEditingId(entry.id)
    setForm({
      topic: entry.topic,
      canonical: entry.canonicalEntity,
      supporting: entry.supportingEntities,
      notes: entry.notes,
    })
    setFormError(null)
    setConfirmDeleteId(null)
    document.getElementById('topic-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.topic.trim() || !form.canonical) return
    setSaving(true)
    setFormError(null)

    try {
      const payload = {
        topic: form.topic.trim().toLowerCase(),
        canonicalEntity: form.canonical,
        supportingEntities: form.supporting,
        notes: form.notes.trim(),
      }

      let updated: TopicEntry
      if (editingId) {
        updated = await updateTopicEntry(editingId, payload)
        setEntries(prev => prev.map(e => (e.id === editingId ? updated : e)))
      } else {
        updated = await addTopicEntry(payload)
        setEntries(prev => [...prev, updated])
      }

      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
      setEditingId(null)
      setForm(EMPTY_FORM)
    } catch {
      setFormError('Failed to save — check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return }
    setDeleting(true)
    try {
      await deleteTopicEntry(id)
      setEntries(prev => prev.filter(e => e.id !== id))
      setConfirmDeleteId(null)
      if (editingId === id) cancelEdit()
    } catch {
      setFormError('Failed to delete topic entry.')
    } finally {
      setDeleting(false)
    }
  }

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries
    const q = searchQuery.toLowerCase()
    return entries.filter(e =>
      e.topic.includes(q) ||
      e.canonicalEntity.label.toLowerCase().includes(q) ||
      e.notes.toLowerCase().includes(q)
    )
  }, [entries, searchQuery])

  const isValid = form.topic.trim().length > 0 && form.canonical !== null

  return (
    <div className="p-8 min-h-screen">

      {/* Breadcrumb + header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin/seo" className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 hover:text-[#2d6a4f] transition-colors">
            SEO Dashboard
          </Link>
          <span className="text-gray-300 text-xs">›</span>
          <span className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-500">Topic Map</span>
        </div>
        <h1 className="font-display italic text-3xl text-[#000000]">Topic Map</h1>
        <p className="font-sans text-sm text-gray-500 mt-1">
          One canonical entity per search topic. Supporting entities reinforce — they don't compete.
          Feeds the cannibalisation detector.
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex gap-6 mb-8 font-sans text-sm text-gray-600">
        <span>
          <span className="font-semibold text-gray-900 tabular-nums">{entries.length}</span> topic{entries.length !== 1 ? 's' : ''} mapped
        </span>
        <span className="text-gray-300">|</span>
        <span>
          <span className="font-semibold tabular-nums">
            {entries.reduce((n, e) => n + e.supportingEntities.length, 0)}
          </span> supporting entities total
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* ── ADD / EDIT FORM ──────────────────────────────────────────────── */}
        <aside className="w-full lg:w-96 shrink-0">
          <div id="topic-form" className="bg-white border border-gray-200 p-6">
            <h2 className="font-display italic text-xl mb-1">
              {editingId ? 'Edit Topic' : 'Add Topic'}
            </h2>
            <p className="font-sans text-xs text-gray-400 mb-5">
              {editingId
                ? <>Editing topic. <button onClick={cancelEdit} className="underline hover:text-[#2d6a4f]">Cancel</button></>
                : 'Map a search phrase to its single best-matching page.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={labelCls}>Topic / search phrase</label>
                <input
                  value={form.topic}
                  onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                  placeholder="e.g. tugela falls"
                  className={inputCls}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="font-sans text-[11px] text-gray-400 mt-1">
                  Use the phrase as searchers type it — lowercase, no quotes.
                </p>
              </div>

              <EntityPicker
                label="Canonical entity (the single best page for this topic)"
                value={form.canonical}
                options={entityOptions}
                onChange={canonical => setForm(f => ({
                  ...f,
                  canonical,
                  // Remove canonical from supporting if it was there
                  supporting: f.supporting.filter(s => s.id !== canonical?.id),
                }))}
                placeholder="Search for canonical page…"
              />

              <SupportingPicker
                selected={form.supporting}
                options={entityOptions}
                canonicalId={form.canonical?.id ?? null}
                onChange={supporting => setForm(f => ({ ...f, supporting }))}
              />

              <div>
                <label className={labelCls}>Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. canonical chosen over /mydrakensberg/tugela-falls because reserve page ranks higher"
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {formError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 text-red-700 font-sans text-sm">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={saving || !isValid}
                className={`w-full py-2.5 font-sans text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2 ${
                  savedFlash
                    ? 'bg-[#2d6a4f] text-white'
                    : 'bg-[#C9A96E] text-[#1a1a1a] hover:bg-[#b8935e]'
                }`}
              >
                {saving
                  ? <Loader2 size={15} className="animate-spin" />
                  : savedFlash
                  ? <CheckCircle size={15} />
                  : <Plus size={15} />}
                {saving ? 'Saving…' : savedFlash ? 'Saved' : editingId ? 'Update Topic' : 'Add Topic'}
              </button>
            </form>

            {/* Explanation */}
            <div className="mt-6 pt-5 border-t border-gray-100 space-y-2">
              <p className={labelCls}>How it works</p>
              <p className="font-sans text-xs text-gray-500 leading-relaxed">
                <strong className="text-gray-700">Canonical:</strong> the single page that should rank for this topic.
                One topic = one canonical. If another entity claims the same topic, the cannibalisation detector flags it.
              </p>
              <p className="font-sans text-xs text-gray-500 leading-relaxed">
                <strong className="text-gray-700">Supporting:</strong> pages that reinforce the canonical — related trail, region hub, article.
                These provide depth without competing for the same intent.
              </p>
            </div>
          </div>
        </aside>

        {/* ── TOPIC LIST ───────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Search */}
          <div className="relative mb-4">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter topics…"
              className="w-full border border-gray-200 pl-9 pr-4 py-2 font-sans text-sm bg-white focus:outline-none focus:border-[#2d6a4f]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-3 text-gray-400 font-sans text-sm py-12">
              <Loader2 size={16} className="animate-spin" /> Loading topic map…
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="bg-white border border-gray-200 flex items-center justify-center py-16 px-8 text-center">
              <div>
                <BookOpen size={28} className="text-gray-200 mx-auto mb-3" />
                {entries.length === 0 ? (
                  <>
                    <p className="font-sans text-sm text-gray-400">No topics mapped yet.</p>
                    <p className="font-sans text-xs text-gray-300 mt-1">
                      Add a topic using the form to build your map.
                    </p>
                  </>
                ) : (
                  <p className="font-sans text-sm text-gray-400">No topics match "{searchQuery}".</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries
                .slice()
                .sort((a, b) => a.topic.localeCompare(b.topic))
                .map(entry => (
                  <div
                    key={entry.id}
                    className={`bg-white border p-5 transition-colors ${
                      editingId === entry.id ? 'border-[#2d6a4f]' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="min-w-0">
                        <p className="font-display italic text-lg text-[#000000] leading-tight">{entry.topic}</p>
                        {entry.notes && (
                          <p className="font-sans text-xs text-gray-400 mt-0.5 leading-relaxed">{entry.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-sans text-[10px] text-gray-400">{formatDate(entry.updatedAt)}</span>
                        <button
                          onClick={() => editingId === entry.id ? cancelEdit() : startEdit(entry)}
                          className="p-1.5 text-gray-400 hover:text-[#2d6a4f] transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deleting && confirmDeleteId === entry.id}
                          className={`p-1.5 transition-colors ${
                            confirmDeleteId === entry.id
                              ? 'text-red-600 bg-red-50'
                              : 'text-gray-400 hover:text-red-500'
                          }`}
                          title={confirmDeleteId === entry.id ? 'Click again to confirm deletion' : 'Delete'}
                        >
                          {deleting && confirmDeleteId === entry.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Canonical */}
                    <div className="mb-3">
                      <p className={`${labelCls} mb-1`}>Canonical</p>
                      <div className="flex items-center gap-2 bg-[#2d6a4f]/5 border border-[#2d6a4f]/20 px-3 py-2">
                        <span className="font-sans text-[10px] px-1.5 py-0.5 bg-[#2d6a4f]/10 text-[#2d6a4f] shrink-0">
                          {KIND_LABELS[entry.canonicalEntity.kind]}
                        </span>
                        <span className="font-sans text-sm text-gray-800 flex-1 truncate">
                          {entry.canonicalEntity.label}
                        </span>
                        <code className="font-mono text-[10px] text-gray-400 truncate max-w-[160px]">
                          {entry.canonicalEntity.path}
                        </code>
                      </div>
                    </div>

                    {/* Supporting */}
                    {entry.supportingEntities.length > 0 && (
                      <div>
                        <p className={`${labelCls} mb-1`}>Supporting ({entry.supportingEntities.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {entry.supportingEntities.map(s => (
                            <div key={s.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-2 py-1">
                              <span className="font-sans text-[10px] text-gray-500">{KIND_LABELS[s.kind]}</span>
                              <span className="font-sans text-xs text-gray-700">{s.label}</span>
                              <code className="font-mono text-[9px] text-gray-400 max-w-[100px] truncate">{s.path}</code>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {confirmDeleteId === entry.id && (
                      <p className="font-sans text-xs text-red-500 mt-3 flex items-center gap-1.5">
                        <AlertTriangle size={12} />
                        Click the bin icon again to confirm deletion of "{entry.topic}".
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

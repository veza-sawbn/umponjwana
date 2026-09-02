'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, ExternalLink, Plus, Copy, Trash2, ChevronUp, ChevronDown,
  Eye, EyeOff, Check, AlertCircle, UploadCloud,
} from 'lucide-react'
import { supabase } from '@/lib/auth'
import { slugify } from '@/lib/slugify'
import { MediaPicker } from '@/components/media/MediaPicker'
import { adminMediaSource } from '@/lib/admin-supabase'
import LayerStudio from '@/components/admin/field-guide/LayerStudio'
import ChapterFields from '@/components/admin/field-guide/ChapterFields'
import { Label, SectionHeading, TextArea, TextField } from '@/components/admin/field-guide/Field'
import {
  blankLayer, createChapter, createLayer, deleteChapter, deleteLayer, duplicateChapter,
  getFieldGuidePage, listChapters, listLayers, publishFieldGuidePage, unpublishFieldGuidePage,
  updateChapter, updateFieldGuidePage, updateLayer,
  type FieldGuideChapter, type FieldGuideLayer, type FieldGuidePage, type LayerType,
} from '@/lib/field-guide'

// ─────────────────────────────────────────────────────────────────────────────
// The layered-guide editor.
//
// Everything typed here writes to the DRAFT rows. The public page reads a
// published snapshot and nothing else, so none of this reaches a visitor
// until Publish is pressed — including a disabled specimen, which is left out
// of the snapshot entirely rather than hidden in the browser.
//
// Edits save themselves on a short debounce (a drag emits a patch per pointer
// move; sending each one would be one round trip per pixel).
// ─────────────────────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'dirty' | 'saving' | 'error'
type QueueItem = { kind: 'page' | 'chapter' | 'layer'; id: string; patch: Record<string, unknown> }

const SAVE_DEBOUNCE_MS = 600

export default function AdminFieldGuideEditor({ params }: { params: { id: string } }) {
  const pageId = params.id

  const [page, setPage] = useState<FieldGuidePage | null>(null)
  const [chapters, setChapters] = useState<FieldGuideChapter[]>([])
  const [layersByChapter, setLayersByChapter] = useState<Record<string, FieldGuideLayer[]>>({})
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [tab, setTab] = useState<'page' | 'specimens'>('specimens')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [confirmDeleteChapter, setConfirmDeleteChapter] = useState<string | null>(null)

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const found = await getFieldGuidePage(pageId, supabase)
        if (cancelled) return
        if (!found) { setError('That guide no longer exists.'); setLoading(false); return }
        setPage(found)
        const rows = await listChapters(pageId, supabase)
        if (cancelled) return
        setChapters(rows)
        setActiveChapterId(rows[0]?.id ?? null)
        const all = await Promise.all(rows.map(c => listLayers(c.id, supabase).then(l => [c.id, l] as const)))
        if (cancelled) return
        setLayersByChapter(Object.fromEntries(all))
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load this guide.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [pageId])

  // ── Debounced persistence ─────────────────────────────────────────────────
  const queue = useRef(new Map<string, QueueItem>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(async () => {
    if (queue.current.size === 0) return
    const items = Array.from(queue.current.values())
    queue.current.clear()
    setSaveState('saving')
    try {
      for (const item of items) {
        if (item.kind === 'page') await updateFieldGuidePage(item.id, item.patch, supabase)
        else if (item.kind === 'chapter') await updateChapter(item.id, item.patch, supabase)
        else await updateLayer(item.id, item.patch, supabase)
      }
      setSaveState(queue.current.size > 0 ? 'dirty' : 'idle')
    } catch (err: any) {
      setError(err?.message || 'Could not save your changes.')
      setSaveState('error')
    }
  }, [])

  const enqueue = useCallback((kind: QueueItem['kind'], id: string, patch: Record<string, unknown>) => {
    const key = `${kind}:${id}`
    const existing = queue.current.get(key)
    queue.current.set(key, { kind, id, patch: { ...(existing?.patch ?? {}), ...patch } })
    setSaveState('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { timer.current = null; void flush() }, SAVE_DEBOUNCE_MS)
  }, [flush])

  // Leaving the editor must not drop the last few hundred milliseconds of edits.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
    void flush()
  }, [flush])

  // ── Patch helpers ─────────────────────────────────────────────────────────
  const patchPage = useCallback((patch: Partial<FieldGuidePage>) => {
    setPage(p => p ? { ...p, ...patch } : p)
    enqueue('page', pageId, patch as Record<string, unknown>)
  }, [enqueue, pageId])

  const patchChapter = useCallback((id: string, patch: Partial<FieldGuideChapter>) => {
    setChapters(rows => rows.map(c => c.id === id ? { ...c, ...patch } : c))
    enqueue('chapter', id, patch as Record<string, unknown>)
  }, [enqueue])

  const patchLayer = useCallback((chapterId: string, id: string, patch: Partial<FieldGuideLayer>) => {
    setLayersByChapter(map => ({
      ...map,
      [chapterId]: (map[chapterId] ?? []).map(l => l.id === id ? { ...l, ...patch } : l),
    }))
    enqueue('layer', id, patch as Record<string, unknown>)
  }, [enqueue])

  // ── Chapter actions ───────────────────────────────────────────────────────
  async function addChapter() {
    if (!page || busy) return
    setBusy(true); setError(null)
    try {
      const created = await createChapter(page.id, {
        common_name: 'New specimen',
        chapter_order: chapters.length,
        scroll_length: 260,
        is_enabled: false,
      }, supabase)
      setChapters(rows => [...rows, created])
      setLayersByChapter(map => ({ ...map, [created.id]: [] }))
      setActiveChapterId(created.id)
      setTab('specimens')
    } catch (err: any) {
      setError(err?.message || 'Could not add a specimen.')
    } finally { setBusy(false) }
  }

  async function duplicate(chapter: FieldGuideChapter) {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const copy = await duplicateChapter(chapter, supabase)
      const copyLayers = await listLayers(copy.id, supabase)
      const rows = await listChapters(pageId, supabase)
      setChapters(rows)
      setLayersByChapter(map => ({ ...map, [copy.id]: copyLayers }))
      setActiveChapterId(copy.id)
      setNotice(`Duplicated as "${copy.common_name}". It is disabled until you enable it.`)
    } catch (err: any) {
      setError(err?.message || 'Could not duplicate the specimen.')
    } finally { setBusy(false) }
  }

  async function removeChapter(id: string) {
    setBusy(true); setError(null)
    try {
      await deleteChapter(id, supabase)
      const remaining = chapters.filter(c => c.id !== id)
      setChapters(remaining)
      setLayersByChapter(map => { const next = { ...map }; delete next[id]; return next })
      if (activeChapterId === id) setActiveChapterId(remaining[0]?.id ?? null)
      setConfirmDeleteChapter(null)
    } catch (err: any) {
      setError(err?.message || 'Could not delete the specimen.')
    } finally { setBusy(false) }
  }

  function moveChapter(id: string, direction: -1 | 1) {
    const index = chapters.findIndex(c => c.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= chapters.length) return
    const next = [...chapters]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    const renumbered = next.map((c, i) => ({ ...c, chapter_order: i }))
    setChapters(renumbered)
    renumbered.forEach(c => enqueue('chapter', c.id, { chapter_order: c.chapter_order }))
  }

  // ── Layer actions ─────────────────────────────────────────────────────────
  async function addLayer(chapterId: string, type: LayerType) {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const existing = layersByChapter[chapterId] ?? []
      const created = await createLayer(chapterId, blankLayer(type, existing.length + 1), supabase)
      setLayersByChapter(map => ({ ...map, [chapterId]: [...(map[chapterId] ?? []), created] }))
    } catch (err: any) {
      setError(err?.message || 'Could not add the layer.')
    } finally { setBusy(false) }
  }

  async function removeLayer(chapterId: string, id: string) {
    setError(null)
    try {
      await deleteLayer(id, supabase)
      setLayersByChapter(map => ({ ...map, [chapterId]: (map[chapterId] ?? []).filter(l => l.id !== id) }))
    } catch (err: any) {
      setError(err?.message || 'Could not delete the layer.')
    }
  }

  function reorderLayers(chapterId: string, ordered: FieldGuideLayer[]) {
    setLayersByChapter(map => ({ ...map, [chapterId]: ordered }))
    ordered.forEach(l => enqueue('layer', l.id, { entrance_order: l.entrance_order }))
  }

  // ── Publishing ────────────────────────────────────────────────────────────
  async function publish() {
    if (!page || busy) return
    setBusy(true); setError(null); setNotice(null)
    try {
      if (timer.current) { clearTimeout(timer.current); timer.current = null }
      await flush()
      await publishFieldGuidePage(page.id, page.slug, supabase)
      const now = new Date().toISOString()
      setPage(p => p ? { ...p, status: 'published', published_at: now } : p)
      setNotice('Published. The live page now shows exactly what is in this editor.')
    } catch (err: any) {
      setError(err?.message || 'Could not publish this guide.')
    } finally { setBusy(false) }
  }

  async function unpublish() {
    if (!page || busy) return
    setBusy(true); setError(null); setNotice(null)
    try {
      await unpublishFieldGuidePage(page.id, page.slug, supabase)
      setPage(p => p ? { ...p, status: 'draft' } : p)
      setNotice('Taken off the public site. Publishing again restores the last published version.')
    } catch (err: any) {
      setError(err?.message || 'Could not unpublish this guide.')
    } finally { setBusy(false) }
  }

  if (loading) {
    return <div className="p-4 sm:p-6 lg:p-8 py-24 flex justify-center"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
  }

  if (!page) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="font-sans text-sm text-red-600 mb-4">{error ?? 'Guide not found.'}</p>
        <Link href="/admin/field-guide" className="font-sans text-sm text-[#2d6a4f]">← Back to Layered Field Guide</Link>
      </div>
    )
  }

  const activeChapter = chapters.find(c => c.id === activeChapterId) ?? null
  const activeLayers = activeChapterId ? layersByChapter[activeChapterId] ?? [] : []
  const enabledCount = chapters.filter(c => c.is_enabled).length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href="/admin/field-guide" className="inline-flex items-center gap-1.5 font-sans text-xs text-gray-400 hover:text-[#2d6a4f] transition-colors mb-4">
        <ArrowLeft size={13} /> Layered Field Guide
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">
            {page.status === 'published' ? 'Published guide' : 'Draft guide'}
          </p>
          <h1 className="font-display italic text-3xl text-[#000000]">{page.title}</h1>
          <p className="font-sans text-xs text-gray-400 mt-1.5">
            /field-guide/{page.slug} · {chapters.length} {chapters.length === 1 ? 'specimen' : 'specimens'} ·{' '}
            {enabledCount} enabled
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <SaveBadge state={saveState} />
          {page.status === 'published' && (
            <a
              href={`/field-guide/${page.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border border-gray-200 px-4 py-2.5 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
            >
              <ExternalLink size={13} /> View live
            </a>
          )}
          {page.status === 'published' && (
            <button onClick={unpublish} disabled={busy} className="border border-gray-200 px-4 py-2.5 font-sans text-sm text-gray-600 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50">
              Unpublish
            </button>
          )}
          <button
            onClick={publish}
            disabled={busy}
            className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
            {page.status === 'published' ? 'Publish changes' : 'Publish'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 font-sans text-sm flex items-start gap-2">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mb-5 bg-[#2d6a4f]/8 border border-[#2d6a4f]/20 text-[#2d6a4f] px-4 py-3 font-sans text-sm flex items-start gap-2">
          <Check size={15} className="mt-0.5 shrink-0" /> {notice}
        </div>
      )}

      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {([['specimens', 'Specimens & layers'], ['page', 'Page settings']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-current={tab === key ? 'page' : undefined}
            className={`px-5 py-3 font-sans text-sm border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'page' ? (
        <div className="bg-white border border-gray-200 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-8">
          <div className="space-y-4">
            <SectionHeading>Page</SectionHeading>
            <div className="grid md:grid-cols-2 gap-4">
              <TextField label="Page title" value={page.title} onChange={v => patchPage({ title: v })} />
              <TextField
                label="Page slug"
                value={page.slug}
                onChange={v => patchPage({ slug: slugify(v) })}
                hint={`/field-guide/${page.slug}`}
              />
            </div>
            <TextArea label="Page introduction" value={page.intro ?? ''} onChange={v => patchPage({ intro: v })} rows={4} />
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <SectionHeading>Search engines</SectionHeading>
              <TextField label="SEO title" value={page.seo_title ?? ''} onChange={v => patchPage({ seo_title: v })} hint="falls back to the page title" />
              <TextArea label="SEO description" value={page.seo_description ?? ''} onChange={v => patchPage({ seo_description: v })} rows={2} hint="falls back to the introduction" />
            </div>
          </div>

          <div className="space-y-4">
            <SectionHeading>Paper</SectionHeading>
            <div>
              <Label>Paper texture</Label>
              <MediaPicker value={page.background_url ?? ''} onChange={url => patchPage({ background_url: url || null })} source={adminMediaSource} />
              <p className="mt-1.5 font-sans text-[11px] text-gray-400 leading-relaxed">
                Tiled behind every chapter and held stationary while the reader scrolls. A JPEG is fine here —
                the texture is opaque by design.
              </p>
            </div>
            <div>
              <Label htmlFor="fg-bg-colour">Background fallback colour</Label>
              <div className="flex items-center gap-2">
                <input
                  id="fg-bg-colour"
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(page.background_color) ? page.background_color : '#F2EDE3'}
                  onChange={e => patchPage({ background_color: e.target.value })}
                  className="w-10 h-10 border border-gray-200 bg-white p-1 cursor-pointer"
                />
                <input
                  aria-label="Background fallback colour hex"
                  value={page.background_color}
                  onChange={e => patchPage({ background_color: e.target.value })}
                  className="flex-1 border border-gray-200 px-3 py-2.5 font-sans text-sm bg-[#F7F5F2] focus:outline-none focus:border-[#2d6a4f]"
                />
              </div>
              <p className="mt-1.5 font-sans text-[11px] text-gray-400 leading-relaxed">
                Painted under the texture, so the chapter still reads as paper before the file arrives.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
          {/* Specimen list */}
          <div className="bg-white border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-sans text-[10px] tracking-[0.16em] uppercase text-gray-400">Specimens</h2>
            </div>
            {chapters.length === 0 ? (
              <p className="px-4 py-8 font-sans text-xs text-gray-400 text-center">No specimens yet.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {chapters.map((chapter, i) => (
                  <li key={chapter.id} className={activeChapterId === chapter.id ? 'bg-[#2d6a4f]/5' : ''}>
                    <div className="px-2 py-2 flex items-center gap-1">
                      <button
                        onClick={() => patchChapter(chapter.id, { is_enabled: !chapter.is_enabled })}
                        title={chapter.is_enabled ? 'Enabled — appears when published' : 'Disabled — left out of the published page'}
                        className="p-1 text-gray-400 hover:text-[#2d6a4f] transition-colors shrink-0"
                      >
                        {chapter.is_enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button onClick={() => setActiveChapterId(chapter.id)} className="flex-1 min-w-0 text-left py-1">
                        <span className={`block font-sans text-xs truncate ${chapter.is_enabled ? 'text-gray-700' : 'text-gray-300'}`}>
                          {chapter.common_name}
                        </span>
                        <span className="block font-sans text-[10px] text-gray-300 truncate">
                          {(layersByChapter[chapter.id] ?? []).length} layers
                        </span>
                      </button>
                      <div className="flex flex-col shrink-0">
                        <button onClick={() => moveChapter(chapter.id, -1)} disabled={i === 0} title="Move up" className="p-0.5 text-gray-300 hover:text-[#2d6a4f] disabled:opacity-30 transition-colors">
                          <ChevronUp size={12} />
                        </button>
                        <button onClick={() => moveChapter(chapter.id, 1)} disabled={i === chapters.length - 1} title="Move down" className="p-0.5 text-gray-300 hover:text-[#2d6a4f] disabled:opacity-30 transition-colors">
                          <ChevronDown size={12} />
                        </button>
                      </div>
                      <button onClick={() => duplicate(chapter)} title="Duplicate specimen" className="p-1 text-gray-300 hover:text-[#2d6a4f] transition-colors shrink-0">
                        <Copy size={12} />
                      </button>
                      <button onClick={() => setConfirmDeleteChapter(chapter.id)} title="Delete specimen" className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="p-3 border-t border-gray-100">
              <button
                onClick={addChapter}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-1.5 border border-gray-200 px-3 py-2 font-sans text-xs text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors disabled:opacity-50"
              >
                <Plus size={12} /> Add specimen
              </button>
            </div>
          </div>

          {/* Active specimen */}
          {activeChapter ? (
            <div className="space-y-6 min-w-0">
              <div className="bg-white border border-gray-200 p-4 sm:p-6">
                <ChapterFields chapter={activeChapter} onPatch={patch => patchChapter(activeChapter.id, patch)} />
              </div>
              <div className="bg-white border border-gray-200 p-4 sm:p-6">
                <LayerStudio
                  chapter={activeChapter}
                  layers={activeLayers}
                  background={page.background_url}
                  backgroundColor={page.background_color}
                  busy={busy}
                  onPatchLayer={(id, patch) => patchLayer(activeChapter.id, id, patch)}
                  onCreateLayer={type => addLayer(activeChapter.id, type)}
                  onDeleteLayer={id => removeLayer(activeChapter.id, id)}
                  onReorder={ordered => reorderLayers(activeChapter.id, ordered)}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 py-20 text-center">
              <p className="font-sans text-sm text-gray-400">Add a specimen to start the guide.</p>
            </div>
          )}
        </div>
      )}

      {confirmDeleteChapter && (
        <div className="fixed inset-0 z-[1100] bg-black/60 flex items-center justify-center p-6" onClick={() => setConfirmDeleteChapter(null)}>
          <div className="bg-white max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-display italic text-xl mb-2">Delete this specimen?</h2>
            <p className="font-sans text-sm text-gray-500 leading-relaxed mb-5">
              The chapter and every layer in it are removed. The image files stay in the Media Library. This
              cannot be undone, and it reaches the live page the next time you publish.
            </p>
            <div className="flex gap-3">
              <button onClick={() => removeChapter(confirmDeleteChapter)} className="bg-red-500 text-white px-5 py-2.5 font-sans text-sm hover:bg-red-600 transition-colors">
                Delete specimen
              </button>
              <button onClick={() => setConfirmDeleteChapter(null)} className="border border-gray-200 text-gray-600 px-5 py-2.5 font-sans text-sm hover:bg-[#F7F5F2] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SaveBadge({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; className: string }> = {
    idle: { text: 'All changes saved', className: 'text-gray-400' },
    dirty: { text: 'Unsaved changes', className: 'text-gray-500' },
    saving: { text: 'Saving…', className: 'text-gray-500' },
    error: { text: 'Save failed', className: 'text-red-500' },
  }
  const { text, className } = map[state]
  return (
    <span role="status" className={`font-sans text-[11px] ${className} whitespace-nowrap`}>
      {state === 'saving' && <Loader2 size={10} className="inline mr-1.5 animate-spin" />}
      {text}
    </span>
  )
}

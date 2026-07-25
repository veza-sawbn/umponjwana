'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X, Check, Loader2, Monitor, Tablet, Smartphone, ExternalLink, MousePointer2,
  Undo2, Redo2, Eye, EyeOff, GripVertical, ChevronRight, ChevronDown, Layers,
  LayoutPanelTop, Image as ImageIcon, Plus, Copy, Trash2,
  ArrowUp, ArrowDown, UploadCloud, History, MoreVertical, FileClock, Type,
} from 'lucide-react'
import {
  getAllSiteContent, type SiteContent, type SiteContentKey, type SectionStyle,
  getEditorDraft, saveEditorDraft, clearEditorDraft, publishEditorSections,
  rollbackLastPublish, getEditorBackup, type EditorPending, type HomeCard,
} from '@/lib/site-content'
import {
  EDITOR_PAGES, findSection, type EditorPage, type EditorSection,
  type EditorField, type EditorCardCollection,
} from '@/lib/editor-schema'
import { adminMediaSource } from '@/lib/admin-supabase'
import { MediaPicker } from '@/components/media/MediaPicker'
import type { EditFieldConfig } from '@/lib/edit-mode-context'

/* ─── Types ────────────────────────────────────────────────────────────────── */

type Breakpoint = 'desktop' | 'tablet' | 'mobile'

type Selection =
  | { kind: 'field'; field: EditFieldConfig }
  | { kind: 'section'; sectionId: string }
  | { kind: 'card'; contentKey: string; fieldKey: string; index: number }
  | null

const BREAKPOINTS: { id: Breakpoint; icon: typeof Monitor; width: string; label: string }[] = [
  { id: 'desktop', icon: Monitor, width: '100%', label: 'Desktop' },
  { id: 'tablet', icon: Tablet, width: '820px', label: 'Tablet' },
  { id: 'mobile', icon: Smartphone, width: '400px', label: 'Mobile' },
]

const clone = (v: any) => JSON.parse(JSON.stringify(v))

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function AdminEditorPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [activePage, setActivePage] = useState<EditorPage>(EDITOR_PAGES[0])
  const [content, setContent] = useState<SiteContent | null>(null)
  const [pending, setPending] = useState<EditorPending>({})
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  const [selection, setSelection] = useState<Selection>(null)
  const [inspectorTab, setInspectorTab] = useState<'content' | 'style' | 'advanced'>('content')
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop')
  const [iframeReady, setIframeReady] = useState(false)
  const [iframeNonce, setIframeNonce] = useState(0)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [hasBackup, setHasBackup] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Undo / redo
  const undoStack = useRef<EditorPending[]>([])
  const redoStack = useRef<EditorPending[]>([])
  const lastHistory = useRef<{ key: string; at: number }>({ key: '', at: 0 })
  const [, forceHistoryRender] = useState(0)

  const sendToIframe = useCallback((msg: object) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*')
  }, [])

  /* ── Value resolution: draft first, then live content, then '' ── */
  const sectionValue = useCallback((contentKey: string, fieldKey: string): any => {
    const fromPending = pending[contentKey]?.[fieldKey]
    if (fromPending !== undefined) return fromPending
    return (content as any)?.[contentKey]?.[fieldKey] ?? ''
  }, [pending, content])

  const cardsOf = useCallback((contentKey: string, fieldKey: string): HomeCard[] => {
    const v = sectionValue(contentKey, fieldKey)
    return Array.isArray(v) ? v : []
  }, [sectionValue])

  const layoutValue = useCallback(<K extends 'section_order' | 'hidden' | 'styles'>(k: K) => {
    return sectionValue('home_layout', k) as any
  }, [sectionValue])

  /* ── History + change application ── */
  const pushHistory = useCallback((changeKey: string) => {
    const now = Date.now()
    // Coalesce rapid edits to the same field into one undo step
    if (lastHistory.current.key === changeKey && now - lastHistory.current.at < 900) {
      lastHistory.current.at = now
      return
    }
    undoStack.current.push(clone(pendingRef.current))
    if (undoStack.current.length > 100) undoStack.current.shift()
    redoStack.current = []
    lastHistory.current = { key: changeKey, at: now }
    forceHistoryRender(n => n + 1)
  }, [])

  const applyChange = useCallback((section: string, fieldKey: string, value: any, opts?: { syncIframe?: boolean }) => {
    pushHistory(`${section}.${fieldKey}`)
    setPending(p => ({ ...p, [section]: { ...p[section], [fieldKey]: value } }))
    if (opts?.syncIframe !== false) {
      sendToIframe({ type: 'vd:field_update', payload: { section, fieldKey, value } })
    }
  }, [pushHistory, sendToIframe])

  const setAllPending = useCallback((next: EditorPending) => {
    setPending(next)
    sendToIframe({ type: 'vd:state', payload: { pending: next } })
  }, [sendToIframe])

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(clone(pendingRef.current))
    lastHistory.current = { key: '', at: 0 }
    setAllPending(prev)
    forceHistoryRender(n => n + 1)
  }, [setAllPending])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(clone(pendingRef.current))
    lastHistory.current = { key: '', at: 0 }
    setAllPending(next)
    forceHistoryRender(n => n + 1)
  }, [setAllPending])

  /* ── Bootstrap: live content + stored draft ── */
  useEffect(() => {
    Promise.all([getAllSiteContent(), getEditorDraft().catch(() => null), getEditorBackup().catch(() => null)])
      .then(([liveContent, draft, backup]) => {
        setContent(liveContent)
        if (draft) setPending(draft.sections)
        setHasBackup(Boolean(backup))
        setBootstrapped(true)
      })
  }, [])

  /* ── Draft autosave (debounced) ── */
  useEffect(() => {
    if (!bootstrapped) return
    setDraftStatus('saving')
    const t = setTimeout(() => {
      saveEditorDraft(pending)
        .then(() => setDraftStatus('saved'))
        .catch(() => setDraftStatus('error'))
    }, 1200)
    return () => clearTimeout(t)
  }, [pending, bootstrapped])

  /* ── Messages from the preview iframe ── */
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const { type, payload } = e.data ?? {}
      if (type === 'vd:field_click') {
        setSelection({ kind: 'field', field: payload as EditFieldConfig })
        setInspectorTab('content')
      }
      if (type === 'vd:section_click') {
        setSelection({ kind: 'section', sectionId: payload.sectionId })
        setInspectorTab('content')
      }
      if (type === 'vd:card_click') {
        setSelection({ kind: 'card', contentKey: payload.contentKey, fieldKey: payload.fieldKey, index: payload.index })
        setInspectorTab('content')
      }
      if (type === 'vd:inline_input' || type === 'vd:inline_commit') {
        // The iframe DOM is already up to date — record without echoing back.
        const { section, fieldKey, value } = payload
        pushHistory(`${section}.${fieldKey}`)
        setPending(p => ({ ...p, [section]: { ...p[section], [fieldKey]: value } }))
      }
      if (type === 'vd:ready') {
        sendToIframe({ type: 'vd:state', payload: { pending: pendingRef.current } })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [pushHistory, sendToIframe])

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  /* ── Page switching ── */
  function switchPage(page: EditorPage) {
    setActivePage(page)
    setSelection(null)
    setIframeReady(false)
  }

  function selectSection(section: EditorSection) {
    setSelection({ kind: 'section', sectionId: section.id })
    setInspectorTab('content')
    sendToIframe({ type: 'vd:scroll_to', payload: { sectionId: section.id } })
  }

  /* ── Section ordering / visibility (home) ── */
  const currentOrder: string[] = layoutValue('section_order') || []
  const hiddenIds: string[] = layoutValue('hidden') || []
  const styles: Record<string, SectionStyle> = layoutValue('styles') || {}

  function moveSection(id: string, dir: -1 | 1) {
    const order = [...currentOrder]
    const i = order.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    applyChange('home_layout', 'section_order', order)
  }

  function reorderSections(fromId: string, toId: string) {
    if (fromId === toId) return
    const order = [...currentOrder]
    const from = order.indexOf(fromId)
    const to = order.indexOf(toId)
    if (from < 0 || to < 0) return
    order.splice(from, 1)
    order.splice(to, 0, fromId)
    applyChange('home_layout', 'section_order', order)
  }

  function toggleSectionHidden(id: string) {
    const next = hiddenIds.includes(id) ? hiddenIds.filter(h => h !== id) : [...hiddenIds, id]
    applyChange('home_layout', 'hidden', next)
  }

  function setSectionStyle(id: string, patch: Partial<SectionStyle> | null) {
    const next = { ...styles }
    if (patch === null) delete next[id]
    else next[id] = { ...next[id], ...patch }
    applyChange('home_layout', 'styles', next)
  }

  /* ── Card operations ── */
  function updateCard(contentKey: string, fieldKey: string, index: number, patch: Record<string, any>) {
    const arr = cardsOf(contentKey, fieldKey).map((c, i) => i === index ? { ...c, ...patch } : c)
    applyChange(contentKey, fieldKey, arr)
  }

  function cardAction(collection: EditorCardCollection, index: number, action: 'duplicate' | 'delete' | 'up' | 'down' | 'toggle') {
    const arr = [...cardsOf(collection.contentKey, collection.fieldKey)]
    const card = arr[index]
    if (!card) return
    if (action === 'duplicate') {
      arr.splice(index + 1, 0, { ...clone(card), id: `${collection.fieldKey}-${Date.now()}` })
      setSelection({ kind: 'card', contentKey: collection.contentKey, fieldKey: collection.fieldKey, index: index + 1 })
    }
    if (action === 'delete') {
      arr.splice(index, 1)
      setSelection(null)
    }
    if (action === 'up' || action === 'down') {
      const j = action === 'up' ? index - 1 : index + 1
      if (j < 0 || j >= arr.length) return
      ;[arr[index], arr[j]] = [arr[j], arr[index]]
      setSelection({ kind: 'card', contentKey: collection.contentKey, fieldKey: collection.fieldKey, index: j })
    }
    if (action === 'toggle') {
      arr[index] = { ...card, visible: card.visible === false }
    }
    applyChange(collection.contentKey, collection.fieldKey, arr)
  }

  function addCard(collection: EditorCardCollection) {
    const arr = [...cardsOf(collection.contentKey, collection.fieldKey)]
    arr.push({ ...collection.blank, id: `${collection.fieldKey}-${Date.now()}` } as HomeCard)
    applyChange(collection.contentKey, collection.fieldKey, arr)
    setSelection({ kind: 'card', contentKey: collection.contentKey, fieldKey: collection.fieldKey, index: arr.length - 1 })
  }

  /* ── Publish / discard / rollback ── */
  const unsavedCount = Object.values(pending).reduce((n, fields) => n + Object.keys(fields).length, 0)

  async function handlePublish() {
    if (publishing || unsavedCount === 0) return
    setPublishing(true)
    setPublishError('')
    try {
      await publishEditorSections(pending)
      const liveContent = await getAllSiteContent()
      setContent(liveContent)
      undoStack.current = []
      redoStack.current = []
      setAllPending({})
      setHasBackup(true)
      setIframeNonce(n => n + 1) // reload preview against published content
      setSelection(null)
    } catch (e: any) {
      setPublishError(e?.message || 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  async function handleDiscardDraft() {
    setMenuOpen(false)
    try { await clearEditorDraft() } catch {}
    undoStack.current = []
    redoStack.current = []
    setAllPending({})
    setIframeNonce(n => n + 1)
    setSelection(null)
  }

  async function handleRollback() {
    setMenuOpen(false)
    try {
      const restored = await rollbackLastPublish()
      if (!restored) return
      const liveContent = await getAllSiteContent()
      setContent(liveContent)
      setHasBackup(false)
      setIframeNonce(n => n + 1)
    } catch (e: any) {
      setPublishError(e?.message || 'Rollback failed')
    }
  }

  /* ── Navigator ordering: reflect home section_order ── */
  function navigatorSections(page: EditorPage): EditorSection[] {
    const reorderable = page.sections.filter(s => s.reorderable)
    if (reorderable.length === 0) return page.sections
    const sorted = [...reorderable].sort((a, b) => {
      const ia = currentOrder.indexOf(a.id); const ib = currentOrder.indexOf(b.id)
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
    })
    const result: EditorSection[] = []
    let placed = false
    for (const s of page.sections) {
      if (s.reorderable) {
        if (!placed) { result.push(...sorted); placed = true }
      } else {
        result.push(s)
      }
    }
    return result
  }

  const dragId = useRef<string | null>(null)

  const iframeSrc = `${activePage.path}?edit=1`
  const bp = BREAKPOINTS.find(b => b.id === breakpoint)!

  const selectedSection: EditorSection | undefined =
    selection?.kind === 'section' ? findSection(activePage, selection.sectionId) : undefined

  const selectedCardCollection: EditorCardCollection | undefined =
    selection?.kind === 'card'
      ? activePage.sections.map(s => s.cards).find(c => c && c.contentKey === selection.contentKey && c.fieldKey === selection.fieldKey) ?? undefined
      : undefined

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-[#0d0d0d]">

      {/* ── Top toolbar ── */}
      <div className="h-12 bg-[#111] border-b border-white/10 flex items-center justify-between px-4 shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <LayoutPanelTop className="w-4 h-4 text-gold shrink-0" />
          <span className="font-sans text-sm text-white font-medium whitespace-nowrap">Visual Editor</span>
          <span className="font-sans text-[11px] text-white/30 whitespace-nowrap hidden md:inline">
            {draftStatus === 'saving' && 'Saving draft…'}
            {draftStatus === 'saved' && (unsavedCount > 0 ? `Draft saved · ${unsavedCount} change${unsavedCount === 1 ? '' : 's'} pending publish` : 'All changes published')}
            {draftStatus === 'error' && <span className="text-red-400">Draft save failed — check your connection</span>}
          </span>
        </div>

        {/* Breakpoints */}
        <div className="flex items-center gap-1 bg-white/5 p-0.5">
          {BREAKPOINTS.map(b => {
            const Icon = b.icon
            return (
              <button
                key={b.id}
                onClick={() => setBreakpoint(b.id)}
                title={b.label}
                className={`p-1.5 transition-colors ${breakpoint === b.id ? 'bg-gold text-forest' : 'text-white/40 hover:text-white'}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Undo / redo */}
          <button onClick={undo} disabled={undoStack.current.length === 0} title="Undo (Ctrl+Z)"
            className="p-1.5 text-white/50 hover:text-white disabled:opacity-25 transition-colors">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={redoStack.current.length === 0} title="Redo (Ctrl+Shift+Z)"
            className="p-1.5 text-white/50 hover:text-white disabled:opacity-25 transition-colors">
            <Redo2 className="w-4 h-4" />
          </button>

          <a href={activePage.path} target="_blank" rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 font-sans text-xs text-white/40 hover:text-white transition-colors px-2">
            <ExternalLink className="w-3.5 h-3.5" /> Live Site
          </a>

          <button
            onClick={handlePublish}
            disabled={publishing || unsavedCount === 0}
            className="flex items-center gap-2 bg-gold text-forest font-sans text-sm font-semibold px-4 py-1.5 disabled:opacity-40 hover:bg-gold/90 transition-colors"
          >
            {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
            {publishing ? 'Publishing…' : 'Publish'}
          </button>

          {/* Overflow menu */}
          <div className="relative">
            <button onClick={() => setMenuOpen(v => !v)} className="p-1.5 text-white/40 hover:text-white transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-[#1a1a1a] border border-white/10 py-1 z-50">
                <button onClick={handleDiscardDraft} disabled={unsavedCount === 0}
                  className="flex items-center gap-2 w-full px-4 py-2.5 font-sans text-xs text-white/70 hover:bg-white/5 disabled:opacity-30 transition-colors">
                  <FileClock className="w-3.5 h-3.5" /> Discard draft (revert to published)
                </button>
                <button onClick={handleRollback} disabled={!hasBackup}
                  className="flex items-center gap-2 w-full px-4 py-2.5 font-sans text-xs text-white/70 hover:bg-white/5 disabled:opacity-30 transition-colors">
                  <History className="w-3.5 h-3.5" /> Restore previous published version
                </button>
              </div>
            )}
          </div>

          <a href="/admin" className="p-1.5 text-white/30 hover:text-white transition-colors" title="Exit editor">
            <X className="w-5 h-5" />
          </a>
        </div>
      </div>

      {publishError && (
        <div className="bg-red-500/15 border-b border-red-500/30 px-4 py-2 font-sans text-xs text-red-300 shrink-0">
          {publishError}
        </div>
      )}

      {/* ── Page tabs ── */}
      <div className="bg-[#0d0d0d] border-b border-white/8 flex items-center px-4 gap-1 overflow-x-auto shrink-0">
        {EDITOR_PAGES.map(page => (
          <button
            key={page.path}
            onClick={() => switchPage(page)}
            className={`px-4 py-2.5 font-sans text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
              activePage.path === page.path
                ? 'text-gold border-gold'
                : 'text-white/40 border-transparent hover:text-white/70'
            }`}
          >
            {page.label}
          </button>
        ))}
      </div>

      {/* ── Editor body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Navigator (left) ── */}
        <div className="w-60 bg-[#111] border-r border-white/8 flex flex-col shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8">
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-white/30">Page Structure</p>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {navigatorSections(activePage).map(section => {
              const isSelected = selection?.kind === 'section' && selection.sectionId === section.id
              const isHidden = hiddenIds.includes(section.id)
              const cards = section.cards ? cardsOf(section.cards.contentKey, section.cards.fieldKey) : []
              const isExpanded = expanded[section.id]
              return (
                <div key={section.id}>
                  <div
                    draggable={Boolean(section.reorderable)}
                    onDragStart={() => { dragId.current = section.id }}
                    onDragOver={e => { if (section.reorderable && dragId.current) e.preventDefault() }}
                    onDrop={() => { if (section.reorderable && dragId.current) reorderSections(dragId.current, section.id); dragId.current = null }}
                    className={`group flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-gold/15 text-gold' : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                    onClick={() => selectSection(section)}
                  >
                    {section.reorderable ? (
                      <GripVertical className="w-3 h-3 text-white/20 group-hover:text-white/50 cursor-grab shrink-0" />
                    ) : (
                      <span className="w-3 shrink-0" />
                    )}
                    {(section.fields || section.cards) ? (
                      <button
                        onClick={e => { e.stopPropagation(); setExpanded(x => ({ ...x, [section.id]: !x[section.id] })) }}
                        className="shrink-0 text-white/30 hover:text-white"
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                    ) : <span className="w-3 shrink-0" />}
                    <span className={`font-sans text-xs flex-1 truncate ${isHidden ? 'line-through opacity-50' : ''}`}>{section.label}</span>
                    {section.hideable && (
                      <button
                        onClick={e => { e.stopPropagation(); toggleSectionHidden(section.id) }}
                        title={isHidden ? 'Show section' : 'Hide section'}
                        className="shrink-0 text-white/25 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* Fields + cards under the section */}
                  {isExpanded && (
                    <div className="pb-1">
                      {(section.fields ?? []).map(f => (
                        <button
                          key={f.key}
                          onClick={() => {
                            setSelection({
                              kind: 'field',
                              field: {
                                section: section.contentKey!, fieldKey: f.key,
                                value: sectionValue(section.contentKey!, f.key),
                                label: f.label, type: f.type as any, min: f.min, max: f.max,
                              },
                            })
                            sendToIframe({ type: 'vd:scroll_to', payload: { sectionId: section.id } })
                          }}
                          className={`flex items-center gap-2 w-full pl-10 pr-3 py-1.5 font-sans text-[11px] transition-colors ${
                            selection?.kind === 'field' && selection.field.section === section.contentKey && selection.field.fieldKey === f.key
                              ? 'text-gold' : 'text-white/35 hover:text-white/70'
                          }`}
                        >
                          {f.type === 'image' ? <ImageIcon className="w-3 h-3 shrink-0" /> : <Type className="w-3 h-3 shrink-0" />}
                          <span className="truncate">{f.label}</span>
                        </button>
                      ))}
                      {section.cards && cards.map((card, i) => (
                        <button
                          key={String(card.id ?? i)}
                          onClick={() => {
                            setSelection({ kind: 'card', contentKey: section.cards!.contentKey, fieldKey: section.cards!.fieldKey, index: i })
                            sendToIframe({ type: 'vd:scroll_to', payload: { sectionId: section.id } })
                          }}
                          className={`flex items-center gap-2 w-full pl-10 pr-3 py-1.5 font-sans text-[11px] transition-colors ${
                            selection?.kind === 'card' && selection.fieldKey === section.cards!.fieldKey && selection.index === i
                              ? 'text-sky-400' : 'text-white/35 hover:text-white/70'
                          } ${card.visible === false ? 'line-through opacity-60' : ''}`}
                        >
                          <Layers className="w-3 h-3 shrink-0 text-sky-500/70" />
                          <span className="truncate">{String(card[section.cards!.itemLabelKey] || 'Untitled')}</span>
                        </button>
                      ))}
                      {section.cards && (
                        <button
                          onClick={() => addCard(section.cards!)}
                          className="flex items-center gap-2 w-full pl-10 pr-3 py-1.5 font-sans text-[11px] text-white/30 hover:text-gold transition-colors"
                        >
                          <Plus className="w-3 h-3 shrink-0" /> Add card
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="px-4 py-3 border-t border-white/8">
            <p className="font-sans text-[10px] text-white/25 leading-relaxed">
              Drag <GripVertical className="w-2.5 h-2.5 inline" /> to reorder sections. Click any element in the preview to edit it.
            </p>
          </div>
        </div>

        {/* ── Canvas ── */}
        <div className="flex-1 overflow-auto relative bg-[#1a1a1a] flex justify-center">
          {!iframeReady && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#1a1a1a]">
              <Loader2 className="w-6 h-6 text-gold animate-spin" />
            </div>
          )}
          <div
            className="h-full transition-all duration-300 bg-white"
            style={{ width: bp.width, maxWidth: '100%' }}
          >
            <iframe
              key={`${iframeSrc}-${iframeNonce}`}
              ref={iframeRef}
              src={iframeSrc}
              className="w-full h-full border-none"
              title="Site Preview"
              onLoad={() => setIframeReady(true)}
            />
          </div>
        </div>

        {/* ── Inspector (right) ── */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-hidden">
          {selection === null && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-forest/10 flex items-center justify-center mb-4">
                <MousePointer2 className="w-5 h-5 text-forest" />
              </div>
              <p className="font-sans text-sm text-gray-700 font-medium mb-2">Click anything to edit it</p>
              <p className="font-sans text-xs text-gray-400 leading-relaxed">
                Click text to edit it inline, click a card to edit or reorder it, or click a section background to restyle the whole section.
              </p>
            </div>
          )}

          {/* Field inspector */}
          {selection?.kind === 'field' && (
            <FieldInspector
              field={selection.field}
              value={sectionValue(selection.field.section, selection.field.fieldKey) || selection.field.value}
              onChange={v => applyChange(selection.field.section, selection.field.fieldKey, v)}
              onClose={() => setSelection(null)}
            />
          )}

          {/* Section inspector */}
          {selection?.kind === 'section' && selectedSection && (
            <SectionInspector
              section={selectedSection}
              tab={inspectorTab}
              setTab={setInspectorTab}
              sectionValue={sectionValue}
              applyChange={applyChange}
              styleOverride={styles[selectedSection.id] ?? {}}
              setStyle={patch => setSectionStyle(selectedSection.id, patch)}
              hidden={hiddenIds.includes(selectedSection.id)}
              toggleHidden={() => toggleSectionHidden(selectedSection.id)}
              orderIndex={currentOrder.indexOf(selectedSection.id)}
              orderLength={currentOrder.length}
              onMove={dir => moveSection(selectedSection.id, dir)}
              cards={selectedSection.cards ? cardsOf(selectedSection.cards.contentKey, selectedSection.cards.fieldKey) : []}
              onSelectCard={i => setSelection({ kind: 'card', contentKey: selectedSection.cards!.contentKey, fieldKey: selectedSection.cards!.fieldKey, index: i })}
              onAddCard={() => selectedSection.cards && addCard(selectedSection.cards)}
              onClose={() => setSelection(null)}
            />
          )}

          {/* Card inspector */}
          {selection?.kind === 'card' && selectedCardCollection && (
            <CardInspector
              collection={selectedCardCollection}
              index={selection.index}
              card={cardsOf(selection.contentKey, selection.fieldKey)[selection.index]}
              total={cardsOf(selection.contentKey, selection.fieldKey).length}
              onField={(key, v) => updateCard(selection.contentKey, selection.fieldKey, selection.index, { [key]: v })}
              onAction={a => cardAction(selectedCardCollection, selection.index, a)}
              onClose={() => setSelection(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Inspector: single field ──────────────────────────────────────────────── */

function FieldInspector({ field, value, onChange, onClose }: {
  field: EditFieldConfig
  value: any
  onChange: (v: any) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">{field.section}</p>
          <p className="font-sans text-sm font-semibold text-gray-900 mt-0.5 truncate">{field.label}</p>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-600 transition-colors shrink-0 mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 p-5 overflow-y-auto">
        <EditInput type={field.type} value={value} min={field.min} max={field.max} onChange={onChange} />
      </div>
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
        <p className="font-sans text-[11px] text-gray-400 leading-relaxed">
          Changes preview live and autosave as a draft. Click <strong className="text-gray-600">Publish</strong> to push them to the live site.
        </p>
      </div>
    </>
  )
}

/* ─── Inspector: section ───────────────────────────────────────────────────── */

function SectionInspector({
  section, tab, setTab, sectionValue, applyChange, styleOverride, setStyle,
  hidden, toggleHidden, orderIndex, orderLength, onMove, cards, onSelectCard, onAddCard, onClose,
}: {
  section: EditorSection
  tab: 'content' | 'style' | 'advanced'
  setTab: (t: 'content' | 'style' | 'advanced') => void
  sectionValue: (contentKey: string, fieldKey: string) => any
  applyChange: (section: string, fieldKey: string, value: any) => void
  styleOverride: SectionStyle
  setStyle: (patch: Partial<SectionStyle> | null) => void
  hidden: boolean
  toggleHidden: () => void
  orderIndex: number
  orderLength: number
  onMove: (dir: -1 | 1) => void
  cards: HomeCard[]
  onSelectCard: (i: number) => void
  onAddCard: () => void
  onClose: () => void
}) {
  const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'
  return (
    <>
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Section</p>
          <p className="font-sans text-sm font-semibold text-gray-900 mt-0.5 truncate">{section.label}</p>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-600 transition-colors shrink-0 mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {(['content', 'style', 'advanced'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 font-sans text-[11px] tracking-wide uppercase transition-colors border-b-2 ${
              tab === t ? 'border-forest text-forest font-semibold' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 p-5 overflow-y-auto space-y-5">
        {tab === 'content' && (
          <>
            {section.note && (
              <p className="font-sans text-[11px] text-gray-400 bg-gray-50 border border-gray-100 p-3 leading-relaxed">{section.note}</p>
            )}
            {(section.fields ?? []).map(f => (
              <div key={f.key}>
                <label className={labelCls}>{f.label}</label>
                <EditInput
                  type={f.type as any}
                  value={sectionValue(section.contentKey!, f.key)}
                  min={f.min}
                  max={f.max}
                  onChange={v => applyChange(section.contentKey!, f.key, v)}
                  compact
                />
              </div>
            ))}
            {section.cards && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>{section.cards.label}</label>
                  <button onClick={onAddCard} className="flex items-center gap-1 font-sans text-xs text-forest hover:text-forest/70">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-1">
                  {cards.map((card, i) => (
                    <button
                      key={String(card.id ?? i)}
                      onClick={() => onSelectCard(i)}
                      className={`flex items-center gap-2.5 w-full border border-gray-200 px-3 py-2 text-left hover:border-forest/40 transition-colors ${card.visible === false ? 'opacity-50' : ''}`}
                    >
                      {typeof card.img === 'string' && card.img
                        ? <img src={card.img} alt="" className="w-8 h-8 object-cover shrink-0" />
                        : <span className="w-8 h-8 bg-gray-100 flex items-center justify-center shrink-0"><Layers className="w-3.5 h-3.5 text-gray-300" /></span>}
                      <span className="font-sans text-xs text-gray-700 truncate flex-1">
                        {String(card[section.cards!.itemLabelKey] || 'Untitled')}
                      </span>
                      {card.visible === false && <EyeOff className="w-3 h-3 text-gray-300 shrink-0" />}
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!section.fields?.length && !section.cards && !section.note && (
              <p className="font-sans text-xs text-gray-400">This section has no editable content fields.</p>
            )}
          </>
        )}

        {tab === 'style' && (
          <>
            <div>
              <label className={labelCls}>Background Colour</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={styleOverride.background ?? '#ffffff'}
                  onChange={e => setStyle({ background: e.target.value })}
                  className="w-10 h-9 border border-gray-200 cursor-pointer bg-transparent p-0.5"
                />
                <input
                  type="text"
                  value={styleOverride.background ?? ''}
                  placeholder="Theme default"
                  onChange={e => setStyle({ background: e.target.value || undefined })}
                  className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2] font-mono"
                />
                {styleOverride.background && (
                  <button onClick={() => setStyle({ background: undefined })} className="p-1.5 text-gray-400 hover:text-red-400" title="Reset to theme">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className={labelCls}>
                Vertical Padding {typeof styleOverride.paddingY === 'number' ? `· ${styleOverride.paddingY}px` : '· theme default'}
              </label>
              <input
                type="range" min={0} max={160}
                value={styleOverride.paddingY ?? 80}
                onChange={e => setStyle({ paddingY: Number(e.target.value) })}
                className="w-full accent-forest"
              />
              {typeof styleOverride.paddingY === 'number' && (
                <button onClick={() => setStyle({ paddingY: undefined })} className="font-sans text-[11px] text-gray-400 hover:text-gray-600 mt-1">
                  Reset to theme default
                </button>
              )}
            </div>
            {section.hideable && (
              <div>
                <label className={labelCls}>Visibility</label>
                <button
                  onClick={toggleHidden}
                  className={`flex items-center gap-2 w-full border px-3 py-2.5 font-sans text-sm transition-colors ${
                    hidden ? 'border-red-200 text-red-500 bg-red-50' : 'border-gray-200 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {hidden ? 'Hidden on the live site' : 'Visible on the live site'}
                </button>
              </div>
            )}
          </>
        )}

        {tab === 'advanced' && (
          <>
            <div>
              <label className={labelCls}>Section ID</label>
              <p className="font-sans text-sm text-gray-600 font-mono">{section.id}</p>
            </div>
            {section.reorderable && (
              <div>
                <label className={labelCls}>Position {orderIndex >= 0 ? `· ${orderIndex + 1} of ${orderLength}` : ''}</label>
                <div className="flex gap-2">
                  <button onClick={() => onMove(-1)} disabled={orderIndex <= 0}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 py-2 font-sans text-xs text-gray-600 hover:border-gray-400 disabled:opacity-30 transition-colors">
                    <ArrowUp className="w-3.5 h-3.5" /> Move Up
                  </button>
                  <button onClick={() => onMove(1)} disabled={orderIndex < 0 || orderIndex >= orderLength - 1}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 py-2 font-sans text-xs text-gray-600 hover:border-gray-400 disabled:opacity-30 transition-colors">
                    <ArrowDown className="w-3.5 h-3.5" /> Move Down
                  </button>
                </div>
              </div>
            )}
            {section.contentKey && (
              <div>
                <label className={labelCls}>Data Binding</label>
                <p className="font-sans text-[11px] text-gray-400 leading-relaxed">
                  Content is stored in <span className="font-mono text-gray-600">site_content → {section.contentKey}</span>.
                  Dynamic data (listings, trails, bookings) stays bound to its live source and is never converted to static markup.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

/* ─── Inspector: card ──────────────────────────────────────────────────────── */

function CardInspector({ collection, index, card, total, onField, onAction, onClose }: {
  collection: EditorCardCollection
  index: number
  card: HomeCard | undefined
  total: number
  onField: (key: string, v: any) => void
  onAction: (a: 'duplicate' | 'delete' | 'up' | 'down' | 'toggle') => void
  onClose: () => void
}) {
  const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'
  if (!card) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="font-sans text-xs text-gray-400">Card no longer exists.</p>
    </div>
  )
  const hidden = card.visible === false
  return (
    <>
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">{collection.label} · {index + 1} of {total}</p>
          <p className="font-sans text-sm font-semibold text-gray-900 mt-0.5 truncate">
            {String(card[collection.itemLabelKey] || 'Untitled')}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-600 transition-colors shrink-0 mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Card actions */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 bg-gray-50">
        <button onClick={() => onAction('up')} disabled={index === 0} title="Move up"
          className="p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-25"><ArrowUp className="w-3.5 h-3.5" /></button>
        <button onClick={() => onAction('down')} disabled={index >= total - 1} title="Move down"
          className="p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-25"><ArrowDown className="w-3.5 h-3.5" /></button>
        <button onClick={() => onAction('duplicate')} title="Duplicate"
          className="p-1.5 text-gray-500 hover:text-gray-900"><Copy className="w-3.5 h-3.5" /></button>
        <button onClick={() => onAction('toggle')} title={hidden ? 'Show card' : 'Hide card'}
          className={`p-1.5 ${hidden ? 'text-red-400' : 'text-gray-500 hover:text-gray-900'}`}>
          {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        <span className="flex-1" />
        <button onClick={() => onAction('delete')} title="Delete card"
          className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex-1 p-5 overflow-y-auto space-y-5">
        {hidden && (
          <p className="font-sans text-[11px] text-red-500 bg-red-50 border border-red-100 p-2.5">
            This card is hidden on the live site.
          </p>
        )}
        {collection.fields.map(f => (
          <div key={f.key}>
            <label className={labelCls}>{f.label}</label>
            <EditInput
              type={f.type as any}
              value={(card[f.key] as any) ?? ''}
              onChange={v => onField(f.key, v)}
              compact
            />
          </div>
        ))}
      </div>
    </>
  )
}

/* ─── Input component ──────────────────────────────────────────────────────── */

function EditInput({ type, value, min, max, onChange, compact }: {
  type: string
  value: string | number
  min?: number
  max?: number
  onChange: (v: string | number) => void
  compact?: boolean
}) {
  const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-forest bg-[#F7F5F2]'

  if (type === 'textarea') return (
    <textarea value={String(value ?? '')} onChange={e => onChange(e.target.value)} rows={compact ? 3 : 6} className={`${inputCls} resize-none`} />
  )

  if (type === 'image') return (
    <MediaPicker value={String(value ?? '')} onChange={url => onChange(url)} source={adminMediaSource} />
  )

  if (type === 'range') return (
    <div className="space-y-2">
      <input type="range" min={min ?? 0} max={max ?? 100} value={Number(value ?? 0)} onChange={e => onChange(Number(e.target.value))} className="w-full accent-forest" />
      <p className="font-sans text-sm text-center text-gray-500 font-semibold">{value}</p>
    </div>
  )

  if (type === 'number') return (
    <input type="number" min={min} max={max} value={Number(value ?? 0)} onChange={e => onChange(Number(e.target.value))} className={inputCls} />
  )

  if (type === 'color') return (
    <div className="flex items-center gap-3">
      <input type="color" value={String(value || '#2d6a4f')} onChange={e => onChange(e.target.value)} className="w-12 h-10 border border-gray-200 cursor-pointer bg-transparent p-0.5" />
      <input type="text" value={String(value ?? '')} onChange={e => onChange(e.target.value)} className={`flex-1 ${inputCls} font-mono`} />
    </div>
  )

  return (
    <input type="text" value={String(value ?? '')} onChange={e => onChange(e.target.value)} className={inputCls} />
  )
}


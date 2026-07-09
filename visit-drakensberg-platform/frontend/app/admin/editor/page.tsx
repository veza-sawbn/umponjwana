'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Save, Check, Loader2, Monitor, ExternalLink, MousePointer2 } from 'lucide-react'
import { getSiteContent, setSiteContent, type SiteContentKey } from '@/lib/site-content'
import type { EditFieldConfig, FieldType } from '@/lib/edit-mode-context'

const PAGES = [
  { label: 'Home', path: '/' },
  { label: 'Stays', path: '/stays' },
  { label: 'Hikes', path: '/hikes' },
  { label: 'Activities', path: '/activities' },
  { label: 'Reserves', path: '/nature-reserves' },
  { label: 'Regions', path: '/regions' },
  { label: 'Stories', path: '/mydrakensberg' },
  { label: 'Plan', path: '/plan' },
  { label: 'About', path: '/about' },
]

interface PendingChanges {
  [section: string]: Record<string, any>
}

export default function AdminEditorPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [activePage, setActivePage] = useState(PAGES[0])
  const [activeField, setActiveField] = useState<EditFieldConfig | null>(null)
  const [editValue, setEditValue] = useState<string | number>('')
  const [pending, setPending] = useState<PendingChanges>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [iframeReady, setIframeReady] = useState(false)

  const sendToIframe = useCallback((msg: object) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*')
  }, [])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'vd:field_click') {
        const field = e.data.payload as EditFieldConfig
        setActiveField(field)
        setEditValue(field.value)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  function switchPage(page: typeof PAGES[0]) {
    setActivePage(page)
    setActiveField(null)
    setIframeReady(false)
  }

  function handleChange(value: string | number) {
    setEditValue(value)
    if (!activeField) return
    sendToIframe({ type: 'vd:field_update', payload: { section: activeField.section, fieldKey: activeField.fieldKey, value } })
    setPending(p => ({
      ...p,
      [activeField.section]: { ...p[activeField.section], [activeField.fieldKey]: value },
    }))
  }

  async function handleSaveAll() {
    if (saving || Object.keys(pending).length === 0) return
    setSaving(true)
    // Merge into the currently stored section so fields edited in an earlier
    // session aren't clobbered by a partial write.
    await Promise.all(
      Object.entries(pending).map(async ([section, fields]) => {
        const current = await getSiteContent(section as SiteContentKey)
        await setSiteContent(section as SiteContentKey, { ...current, ...fields } as any)
      })
    )
    setPending({})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const unsavedCount = Object.values(pending).reduce((n, fields) => n + Object.keys(fields).length, 0)
  const iframeSrc = `${activePage.path}?edit=1`

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-[#0d0d0d]">

      {/* ── Top toolbar ── */}
      <div className="h-12 bg-[#111] border-b border-white/10 flex items-center justify-between px-4 shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Monitor className="w-4 h-4 text-gold shrink-0" />
          <span className="font-sans text-sm text-white font-medium">Visual Editor</span>
          {unsavedCount > 0 && (
            <span className="font-sans text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 shrink-0">
              {unsavedCount} unsaved
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <a
            href={activePage.path}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 font-sans text-xs text-white/40 hover:text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Live Site
          </a>
          <button
            onClick={handleSaveAll}
            disabled={saving || unsavedCount === 0}
            className="flex items-center gap-2 bg-gold text-forest font-sans text-sm font-semibold px-4 py-1.5 disabled:opacity-40 hover:bg-gold/90 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save All'}
          </button>
          <a
            href="/admin/website"
            className="p-1.5 text-white/30 hover:text-white transition-colors"
            title="Exit editor"
          >
            <X className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* ── Page tabs ── */}
      <div className="bg-[#0d0d0d] border-b border-white/8 flex items-center px-4 gap-1 overflow-x-auto shrink-0">
        {PAGES.map(page => (
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

        {/* iframe */}
        <div className="flex-1 overflow-hidden relative bg-[#1a1a1a]">
          {!iframeReady && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#1a1a1a]">
              <Loader2 className="w-6 h-6 text-gold animate-spin" />
            </div>
          )}
          <iframe
            key={iframeSrc}
            ref={iframeRef}
            src={iframeSrc}
            className="w-full h-full border-none"
            title="Site Preview"
            onLoad={() => setIframeReady(true)}
          />
        </div>

        {/* ── Right panel ── */}
        {activeField ? (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">{activeField.section}</p>
                <p className="font-sans text-sm font-semibold text-gray-900 mt-0.5 truncate">{activeField.label}</p>
              </div>
              <button onClick={() => setActiveField(null)} className="text-gray-300 hover:text-gray-600 transition-colors shrink-0 mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              <EditInput type={activeField.type} value={editValue} min={activeField.min} max={activeField.max} onChange={handleChange} />
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <p className="font-sans text-[11px] text-gray-400 leading-relaxed">
                Preview updates live. Click <strong className="text-gray-600">Save All</strong> to publish.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-64 bg-[#111] border-l border-white/8 flex flex-col items-center justify-center p-8 text-center shrink-0">
            <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mb-4">
              <MousePointer2 className="w-5 h-5 text-gold" />
            </div>
            <p className="font-sans text-sm text-white/70 font-medium mb-2">Click any element</p>
            <p className="font-sans text-xs text-white/30 leading-relaxed">
              Hover over highlighted items on the page preview and click to edit them here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Input component ── */
function EditInput({ type, value, min, max, onChange }: {
  type: FieldType; value: string | number; min?: number; max?: number; onChange: (v: string | number) => void
}) {
  const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-forest bg-[#F7F5F2]'

  if (type === 'textarea') return (
    // eslint-disable-next-line jsx-a11y/no-autofocus
    <textarea autoFocus value={String(value)} onChange={e => onChange(e.target.value)} rows={6} className={`${inputCls} resize-none`} />
  )

  if (type === 'image') return (
    <div className="space-y-3">
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input autoFocus type="text" value={String(value)} onChange={e => onChange(e.target.value)} placeholder="https://…" className={inputCls} />
      {value && <img src={String(value)} alt="Preview" className="w-full h-32 object-cover border border-gray-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
    </div>
  )

  if (type === 'range') return (
    <div className="space-y-3">
      <input type="range" min={min ?? 0} max={max ?? 100} value={Number(value)} onChange={e => onChange(Number(e.target.value))} className="w-full accent-forest" />
      <p className="font-sans text-sm text-center text-gray-500 font-semibold">{value}</p>
    </div>
  )

  if (type === 'number') return (
    // eslint-disable-next-line jsx-a11y/no-autofocus
    <input autoFocus type="number" min={min} max={max} value={Number(value)} onChange={e => onChange(Number(e.target.value))} className={inputCls} />
  )

  if (type === 'color') return (
    <div className="flex items-center gap-3">
      <input type="color" value={String(value)} onChange={e => onChange(e.target.value)} className="w-12 h-10 border border-gray-200 cursor-pointer bg-transparent p-0.5" />
      <input type="text" value={String(value)} onChange={e => onChange(e.target.value)} className={`flex-1 ${inputCls} font-mono`} />
    </div>
  )

  return (
    // eslint-disable-next-line jsx-a11y/no-autofocus
    <input autoFocus type="text" value={String(value)} onChange={e => onChange(e.target.value)} className={inputCls} />
  )
}

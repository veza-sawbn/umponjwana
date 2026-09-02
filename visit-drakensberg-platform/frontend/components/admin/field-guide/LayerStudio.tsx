'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Eye, EyeOff, ChevronUp, ChevronDown, Trash2, Plus, Play, Square,
  Image as ImageIcon, Type, PenLine, StickyNote, Monitor, Smartphone, Loader2,
} from 'lucide-react'
import { MediaPicker } from '@/components/media/MediaPicker'
import { adminMediaSource } from '@/lib/admin-supabase'
import FieldGuideLayer from '@/components/field-guide/FieldGuideLayer'
import { specimenLayer } from '@/components/field-guide/LayeredFieldGuide'
import {
  LAYER_TYPES, LAYER_TYPE_LABEL, SPECIMEN_TRIGGER, clamp, isLayerRevealed,
  type FieldGuideChapter, type FieldGuideLayer as LayerRow, type LayerType, type PublishedChapter,
  type PublishedLayer,
} from '@/lib/field-guide'
import { CheckField, Label, NumberField, SectionHeading, TextArea, TextField } from './Field'

// ─────────────────────────────────────────────────────────────────────────────
// The layer editor: a live preview of the real composition on the left, the
// stack on the right, and the selected layer's controls beneath it.
//
// The preview renders through the same FieldGuideLayer component and the same
// stylesheet as the public page, at a fixed logical stage size scaled to fit
// the panel — so what an editor drags into place is not an approximation of
// the visitor's view, it is the visitor's view at a smaller scale.
// ─────────────────────────────────────────────────────────────────────────────

const STAGE = {
  desktop: { w: 1280, h: 720 },
  mobile: { w: 390, h: 780 },
}

const TYPE_ICON: Record<LayerType, typeof ImageIcon> = {
  image: ImageIcon,
  text: Type,
  annotation: PenLine,
  card: StickyNote,
}

/** Read a picked image's intrinsic size so the public page can reserve its
 *  box. Resolves to null for anything the browser cannot decode, which is
 *  not an error — the layer simply renders without a reserved aspect ratio. */
function measureImage(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    if (!url) return resolve(null)
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Working row → the shape the renderer takes. One conversion, so the preview
 *  cannot drift from what publishing will actually write. */
function toPublished(row: LayerRow): PublishedLayer {
  return {
    id: row.id,
    type: row.layer_type,
    name: row.name,
    mediaUrl: row.media_url,
    mediaWidth: row.media_width,
    mediaHeight: row.media_height,
    heading: row.heading,
    text: row.text_content,
    alt: row.alt_text,
    x: row.x,
    y: row.y,
    mobileX: row.mobile_x,
    mobileY: row.mobile_y,
    width: row.width,
    mobileWidth: row.mobile_width,
    zIndex: row.z_index,
    entranceOrder: row.entrance_order,
    scrollTrigger: row.scroll_trigger,
    floatDistance: row.float_distance,
    fadeDuration: row.fade_duration,
    rotation: row.rotation,
    opacity: row.opacity,
    decorative: row.is_decorative,
  }
}

function toPublishedChapter(chapter: FieldGuideChapter): PublishedChapter {
  return {
    id: chapter.id,
    order: chapter.chapter_order,
    commonName: chapter.common_name,
    scientificName: chapter.scientific_name,
    category: chapter.category,
    description: chapter.description,
    habitat: chapter.habitat,
    elevation: chapter.elevation,
    season: chapter.season,
    locality: chapter.locality,
    accessibleDescription: chapter.accessible_description,
    mainMediaUrl: chapter.main_media_url,
    mainMediaAlt: chapter.main_media_alt,
    mainMediaWidth: chapter.main_media_width,
    mainMediaHeight: chapter.main_media_height,
    scrollLength: chapter.scroll_length,
    layers: [],
  }
}

export default function LayerStudio({
  chapter,
  layers,
  background,
  backgroundColor,
  onPatchLayer,
  onCreateLayer,
  onDeleteLayer,
  onReorder,
  busy,
}: {
  chapter: FieldGuideChapter
  layers: LayerRow[]
  background: string | null
  backgroundColor: string
  onPatchLayer: (id: string, patch: Partial<LayerRow>) => void
  onCreateLayer: (type: LayerType) => void
  onDeleteLayer: (id: string) => void
  onReorder: (ordered: LayerRow[]) => void
  busy: boolean
}) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [frameWidth, setFrameWidth] = useState(0)

  const logical = STAGE[device]
  const selected = layers.find(l => l.id === selectedId) ?? null

  // Keep the miniature exactly proportional to its panel at every width.
  // Capped at 1: a phone stage is narrower than the panel, and blowing it up
  // past life size would misrepresent how big the type actually is.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => {
      setFrameWidth(frame.clientWidth)
      setScale(Math.min(1, frame.clientWidth / logical.w))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [logical.w])

  // Scroll-animation preview: replays the chapter's reveal sequence at the
  // triggers and stagger the layers are actually configured with.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const started = performance.now()
    const duration = 5200
    const step = (now: number) => {
      const p = Math.min(1, (now - started) / duration)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(step)
      else { setPlaying(false); setProgress(null) }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const ordered = useMemo(
    () => [...layers].sort((a, b) => a.entrance_order - b.entrance_order),
    [layers],
  )

  const specimen = useMemo(() => specimenLayer(toPublishedChapter(chapter)), [chapter])

  // null progress = editing: everything visible so it can be positioned.
  const revealed = (layer: { scrollTrigger: number }) =>
    progress === null || isLayerRevealed(layer, progress)

  // ── Drag to position ──────────────────────────────────────────────────────
  const dragRef = useRef<{ id: string; pointer: number } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent, layer: LayerRow) => {
    e.preventDefault()
    setSelectedId(layer.id)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { id: layer.id, pointer: e.pointerId }
    setDraggingId(layer.id)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    const stage = stageRef.current
    if (!drag || !stage) return
    const rect = stage.getBoundingClientRect()
    // getBoundingClientRect already accounts for the preview's scale, so the
    // percentage is correct at any zoom without dividing by it here.
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100)
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100)
    const patch = device === 'desktop'
      ? { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
      : { mobile_x: Math.round(x * 10) / 10, mobile_y: Math.round(y * 10) / 10 }
    onPatchLayer(drag.id, patch)
  }, [device, onPatchLayer])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    try { (e.currentTarget as HTMLElement).releasePointerCapture(drag.pointer) } catch { /* already released */ }
    dragRef.current = null
    setDraggingId(null)
  }, [])

  // ── Reordering ────────────────────────────────────────────────────────────
  function move(id: string, direction: -1 | 1) {
    const index = ordered.findIndex(l => l.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ordered.length) return
    const next = [...ordered]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    onReorder(next.map((l, i) => ({ ...l, entrance_order: i + 1 })))
  }

  async function pickMedia(layerId: string, url: string) {
    const size = url ? await measureImage(url) : null
    onPatchLayer(layerId, {
      media_url: url || null,
      media_width: size?.width ?? null,
      media_height: size?.height ?? null,
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
      {/* ── Preview ─────────────────────────────────────────────────────── */}
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <SectionHeading>Live preview</SectionHeading>
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200">
              {(['desktop', 'mobile'] as const).map(d => {
                const Icon = d === 'desktop' ? Monitor : Smartphone
                return (
                  <button
                    key={d}
                    onClick={() => setDevice(d)}
                    aria-pressed={device === d}
                    className={`flex items-center gap-1.5 px-3 py-1.5 font-sans text-xs transition-colors ${
                      device === d ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'
                    }`}
                  >
                    <Icon size={12} /> {d === 'desktop' ? 'Desktop' : 'Mobile'}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => { if (playing) { setPlaying(false); setProgress(null) } else setPlaying(true) }}
              className="flex items-center gap-1.5 border border-gray-200 px-3 py-1.5 font-sans text-xs text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
            >
              {playing ? <Square size={11} /> : <Play size={11} />}
              {playing ? 'Stop' : 'Play scroll'}
            </button>
          </div>
        </div>

        <div ref={frameRef} className="w-full border border-gray-200 bg-[#F7F5F2] overflow-hidden">
          <div className="overflow-hidden" style={{ height: logical.h * scale }}>
            <div
              ref={stageRef}
              className={`fg-stage fg-preview-stage fg-preview-${device}`}
              style={{
                width: logical.w,
                height: logical.h,
                transform: `translateX(${Math.max(0, (frameWidth - logical.w * scale) / 2)}px) scale(${scale})`,
                transformOrigin: 'top left',
                backgroundColor,
                backgroundImage: background ? `url(${background})` : undefined,
                backgroundRepeat: 'repeat',
                backgroundSize: '420px 420px',
                touchAction: 'none',
              }}
            >
              <h2 className="fg-label" data-revealed={revealed({ scrollTrigger: SPECIMEN_TRIGGER }) ? 'true' : 'false'}>
                {chapter.category && (
                  <span className="block font-sans text-[10px] tracking-[0.22em] uppercase text-[#2B2418]/40 mb-2">
                    {chapter.category}
                  </span>
                )}
                <span className="block font-display italic text-4xl leading-[1.1] text-[#2B2418]">
                  {chapter.common_name}
                </span>
                {chapter.scientific_name && (
                  <span className="block mt-1.5 font-display italic text-[15px] text-[#2B2418]/50">
                    {chapter.scientific_name}
                  </span>
                )}
              </h2>

              {specimen.mediaUrl && (
                <FieldGuideLayer layer={specimen} revealed={revealed(specimen)} eager />
              )}

              {ordered.filter(l => l.is_enabled).map(row => {
                const layer = toPublished(row)
                return (
                  <FieldGuideLayer
                    key={row.id}
                    layer={layer}
                    revealed={revealed(layer)}
                    eager
                    selected={selectedId === row.id}
                    dragging={draggingId === row.id}
                    onPointerDown={e => onPointerDown(e, row)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  />
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Label htmlFor="fg-scrub">Chapter scroll</Label>
          <input
            id="fg-scrub"
            type="range"
            min={0}
            max={100}
            value={progress === null ? 100 : Math.round(progress * 100)}
            onChange={e => { setPlaying(false); setProgress(Number(e.target.value) / 100) }}
            className="flex-1 accent-[#2d6a4f] h-1"
          />
          <button
            onClick={() => { setPlaying(false); setProgress(null) }}
            className="font-sans text-xs text-gray-500 hover:text-[#2d6a4f] transition-colors whitespace-nowrap"
          >
            Show all
          </button>
        </div>
        <p className="mt-2 font-sans text-[11px] text-gray-400 leading-relaxed">
          Drag any layer in the preview to position it. Positions are saved as percentages, and the desktop and
          mobile compositions are edited separately — switch device to move the mobile arrangement.
        </p>
      </div>

      {/* ── Stack + inspector ───────────────────────────────────────────── */}
      <div className="space-y-6 min-w-0">
        <div>
          <SectionHeading>Layers ({layers.length})</SectionHeading>
          <div className="border border-gray-200 bg-white divide-y divide-gray-50">
            <div className="px-3 py-2.5 flex items-center gap-2 bg-[#F7F5F2]">
              <ImageIcon size={12} className="text-gray-400 shrink-0" />
              <span className="font-sans text-xs text-gray-500 truncate">Main specimen</span>
              <span className="ml-auto font-sans text-[10px] text-gray-300 shrink-0">always first</span>
            </div>
            {ordered.length === 0 ? (
              <p className="px-3 py-6 font-sans text-xs text-gray-400 text-center">No detail layers yet.</p>
            ) : ordered.map((row, i) => {
              const Icon = TYPE_ICON[row.layer_type]
              return (
                <div
                  key={row.id}
                  className={`px-2 py-2 flex items-center gap-1.5 ${selectedId === row.id ? 'bg-[#2d6a4f]/5' : ''}`}
                >
                  <button
                    onClick={() => onPatchLayer(row.id, { is_enabled: !row.is_enabled })}
                    title={row.is_enabled ? 'Hide this layer' : 'Show this layer'}
                    className="p-1 text-gray-400 hover:text-[#2d6a4f] transition-colors shrink-0"
                  >
                    {row.is_enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button
                    onClick={() => setSelectedId(row.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  >
                    <Icon size={12} className="text-gray-400 shrink-0" />
                    <span className={`font-sans text-xs truncate ${row.is_enabled ? 'text-gray-700' : 'text-gray-300 line-through'}`}>
                      {row.name}
                    </span>
                  </button>
                  <span className="font-sans text-[10px] text-gray-300 shrink-0 w-4 text-right">{i + 1}</span>
                  <button onClick={() => move(row.id, -1)} disabled={i === 0} title="Reveal earlier" className="p-0.5 text-gray-300 hover:text-[#2d6a4f] disabled:opacity-30 transition-colors">
                    <ChevronUp size={13} />
                  </button>
                  <button onClick={() => move(row.id, 1)} disabled={i === ordered.length - 1} title="Reveal later" className="p-0.5 text-gray-300 hover:text-[#2d6a4f] disabled:opacity-30 transition-colors">
                    <ChevronDown size={13} />
                  </button>
                  <button onClick={() => setConfirmDelete(row.id)} title="Delete layer" className="p-0.5 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {LAYER_TYPES.map(type => {
              const Icon = TYPE_ICON[type]
              return (
                <button
                  key={type}
                  onClick={() => onCreateLayer(type)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 border border-gray-200 px-2.5 py-1.5 font-sans text-[11px] text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors disabled:opacity-50"
                >
                  <Plus size={11} /> <Icon size={11} /> {LAYER_TYPE_LABEL[type]}
                </button>
              )
            })}
          </div>
        </div>

        {selected && (
          <LayerInspector
            key={selected.id}
            layer={selected}
            device={device}
            onPatch={patch => onPatchLayer(selected.id, patch)}
            onPickMedia={url => pickMedia(selected.id, url)}
          />
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[1100] bg-black/60 flex items-center justify-center p-6" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-display italic text-xl mb-2">Delete this layer?</h2>
            <p className="font-sans text-sm text-gray-500 mb-5 leading-relaxed">
              The layer is removed from the composition. Its image file stays in the Media Library.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { onDeleteLayer(confirmDelete); if (selectedId === confirmDelete) setSelectedId(null); setConfirmDelete(null) }}
                className="bg-red-500 text-white px-5 py-2.5 font-sans text-sm hover:bg-red-600 transition-colors"
              >
                Delete layer
              </button>
              <button onClick={() => setConfirmDelete(null)} className="border border-gray-200 text-gray-600 px-5 py-2.5 font-sans text-sm hover:bg-[#F7F5F2] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LayerInspector({
  layer, device, onPatch, onPickMedia,
}: {
  layer: LayerRow
  device: 'desktop' | 'mobile'
  onPatch: (patch: Partial<LayerRow>) => void
  onPickMedia: (url: string) => void
}) {
  const [measuring, setMeasuring] = useState(false)

  async function handlePick(url: string) {
    setMeasuring(true)
    await onPickMedia(url)
    setMeasuring(false)
  }

  return (
    <div className="border border-gray-200 bg-white p-4 space-y-5">
      <SectionHeading>
        {LAYER_TYPE_LABEL[layer.layer_type]} settings
      </SectionHeading>

      <TextField label="Layer name" value={layer.name} onChange={v => onPatch({ name: v })} hint="editor only" />

      {layer.layer_type === 'image' ? (
        <div className="space-y-3">
          <div>
            <Label>Image</Label>
            <MediaPicker value={layer.media_url ?? ''} onChange={handlePick} source={adminMediaSource} />
            <p className="mt-1.5 font-sans text-[11px] text-gray-400 leading-relaxed">
              {measuring ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 size={10} className="animate-spin" /> Reading dimensions…</span>
              ) : layer.media_width && layer.media_height ? (
                `${layer.media_width}×${layer.media_height} px — box reserved, no layout shift.`
              ) : (
                'Transparent PNG or WebP recommended. JPEG is for paper textures and backdrops.'
              )}
            </p>
          </div>
          <TextField
            label="Alternative text"
            value={layer.alt_text ?? ''}
            onChange={v => onPatch({ alt_text: v })}
            placeholder="What this drawing shows"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <TextField label="Heading" value={layer.heading ?? ''} onChange={v => onPatch({ heading: v })} />
          <TextArea label="Text" value={layer.text_content ?? ''} onChange={v => onPatch({ text_content: v })} rows={3} />
        </div>
      )}

      <CheckField
        label="Decorative"
        checked={layer.is_decorative}
        onChange={v => onPatch({ is_decorative: v })}
        hint="Hidden from screen readers. Use for marginalia that repeats what the specimen record already says."
      />

      <div className="pt-4 border-t border-gray-100 space-y-4">
        <SectionHeading>{device === 'desktop' ? 'Desktop position' : 'Mobile position'}</SectionHeading>
        {device === 'desktop' ? (
          <>
            <NumberField label="Horizontal" value={layer.x} onChange={v => onPatch({ x: v })} min={-20} max={120} step={0.5} suffix="%" hint="beyond 0–100 bleeds off the edge" />
            <NumberField label="Vertical" value={layer.y} onChange={v => onPatch({ y: v })} min={-20} max={120} step={0.5} suffix="%" />
            <NumberField label="Width" value={layer.width} onChange={v => onPatch({ width: v })} min={2} max={120} step={0.5} suffix="%" />
          </>
        ) : (
          <>
            <NumberField label="Horizontal" value={layer.mobile_x} onChange={v => onPatch({ mobile_x: v })} min={-20} max={120} step={0.5} suffix="%" hint="beyond 0–100 bleeds off the edge" />
            <NumberField label="Vertical" value={layer.mobile_y} onChange={v => onPatch({ mobile_y: v })} min={-20} max={120} step={0.5} suffix="%" />
            <NumberField label="Width" value={layer.mobile_width} onChange={v => onPatch({ mobile_width: v })} min={2} max={140} step={0.5} suffix="%" />
          </>
        )}
        <NumberField label="Rotation" value={layer.rotation} onChange={v => onPatch({ rotation: v })} min={-45} max={45} step={0.5} suffix="deg" />
        <NumberField label="Opacity" value={layer.opacity} onChange={v => onPatch({ opacity: v })} min={0} max={1} step={0.05} />
        <NumberField label="Stacking (z-index)" value={layer.z_index} onChange={v => onPatch({ z_index: v })} min={0} max={99} slider={false} />
      </div>

      <div className="pt-4 border-t border-gray-100 space-y-4">
        <SectionHeading>Entrance</SectionHeading>
        <NumberField
          label="Reveal order"
          value={layer.entrance_order}
          onChange={v => onPatch({ entrance_order: v })}
          min={0}
          max={30}
          slider={false}
          hint="also sets the stagger"
        />
        <NumberField
          label="Scroll trigger"
          value={layer.scroll_trigger}
          onChange={v => onPatch({ scroll_trigger: v })}
          min={0}
          max={1}
          step={0.01}
          hint="0 = with the specimen, 1 = chapter end"
        />
        <NumberField label="Float distance" value={layer.float_distance} onChange={v => onPatch({ float_distance: v })} min={0} max={200} suffix="px" hint="floats up from below" />
        <NumberField label="Fade duration" value={layer.fade_duration} onChange={v => onPatch({ fade_duration: v })} min={100} max={3000} step={50} suffix="ms" />
      </div>
    </div>
  )
}

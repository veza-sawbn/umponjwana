'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Crosshair, RotateCcw } from 'lucide-react'
import {
  IMAGE_POSITION_PRESETS,
  CENTER_POSITION_CSS,
  imagePositionToCss,
  isCenterPosition,
  parseImagePosition,
} from '@/lib/image-position'

// Companion to MediaPicker: MediaPicker chooses *which* photo a hero uses,
// this chooses *which part of it survives the crop*. Sits directly under the
// picker wherever a hero image is edited (admin console pages and the visual
// editor's inspector), and renders nothing at all until an image is chosen —
// there is nothing to aim at before that.
//
// The drag surface shows the whole uncropped photo, because the point being
// picked belongs to the photo rather than to any one viewport. The two
// previews beside it then show what that choice actually does to the crop at
// the shapes heroes really take: a wide desktop letterbox and a tall phone
// screen. Picking "keep the peaks" on the full photo and watching the tall
// preview follow is the whole workflow.

const NUDGE_STEP = 2
const NUDGE_STEP_COARSE = 10

export function ImagePositionPicker({ image, value, onChange, disabled }: {
  /** The hero image this focal point applies to. Empty = control hides itself. */
  image: string
  value: string
  onChange: (position: string) => void
  disabled?: boolean
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  // The drag surface takes the photo's own aspect ratio once it has loaded.
  // A fixed-shape surface would letterbox a portrait photo, and then the
  // pointer's position within the box is not the position within the photo —
  // dragging to the visual top of the image would store something else.
  // Matching the ratio means the box *is* the photo, so the mapping is exact.
  const [ratio, setRatio] = useState<number | null>(null)
  const position = parseImagePosition(value)
  const css = imagePositionToCss(value)
  const atCenter = isCenterPosition(value)

  // A new photo has its own shape; don't keep measuring the previous one.
  useEffect(() => { setRatio(null) }, [image])

  const applyFromPointer = useCallback((clientX: number, clientY: number) => {
    const surface = surfaceRef.current
    if (!surface) return
    const rect = surface.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100
    onChange(imagePositionToCss({ x, y }))
  }, [onChange])

  // Tracked on the window rather than the surface so a drag that runs off the
  // edge of the photo keeps updating (and still ends) instead of sticking.
  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => {
      e.preventDefault()
      applyFromPointer(e.clientX, e.clientY)
    }
    const stop = () => setDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [dragging, applyFromPointer])

  function nudge(dx: number, dy: number) {
    onChange(imagePositionToCss({ x: position.x + dx, y: position.y + dy }))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    const step = e.shiftKey ? NUDGE_STEP_COARSE : NUDGE_STEP
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    }
    if (e.key in moves) {
      e.preventDefault()
      nudge(...moves[e.key])
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      onChange(CENTER_POSITION_CSS)
    }
  }

  if (!image) return null

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {/* Drag surface — the full photo, with the focal point marked. */}
        <div
          ref={surfaceRef}
          role="group"
          aria-label={`Hero image focal point, ${position.x}% from the left and ${position.y}% from the top. Drag it, or use the arrow keys; the Across and Down boxes below take exact values.`}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={onKeyDown}
          onPointerDown={e => {
            if (disabled) return
            e.preventDefault()
            setDragging(true)
            applyFromPointer(e.clientX, e.clientY)
          }}
          style={{ aspectRatio: ratio ?? 16 / 9 }}
          className={`relative flex-1 overflow-hidden border border-gray-200 bg-gray-100 select-none touch-none focus:outline-none focus:border-[#2d6a4f] ${
            disabled ? 'opacity-50' : dragging ? 'cursor-grabbing' : 'cursor-crosshair'
          }`}
        >
          <img
            src={image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            onLoad={e => {
              const { naturalWidth, naturalHeight } = e.currentTarget
              if (naturalWidth > 0 && naturalHeight > 0) setRatio(naturalWidth / naturalHeight)
            }}
          />
          {/* Crosshair guides make it obvious which row and column of the
              photo the crop will hold on to. */}
          <div className="absolute inset-y-0 w-px bg-white/60 pointer-events-none" style={{ left: `${position.x}%` }} />
          <div className="absolute inset-x-0 h-px bg-white/60 pointer-events-none" style={{ top: `${position.y}%` }} />
          <div
            className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white bg-[#C9A96E] shadow pointer-events-none"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
          />
        </div>

        {/* What the choice does to the crop, at the two shapes that matter. */}
        <div className="w-28 shrink-0 space-y-2">
          <PositionPreview image={image} css={css} aspect="16/9" label="Desktop" />
          <PositionPreview image={image} css={css} aspect="9/16" label="Phone" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Crosshair size={12} className="text-gray-400 shrink-0" />
        {IMAGE_POSITION_PRESETS.map(preset => {
          const active = imagePositionToCss(preset.value) === css
          return (
            <button
              key={preset.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset.value)}
              className={`px-2 py-1 font-sans text-[10px] border transition-colors disabled:opacity-50 ${
                active
                  ? 'border-[#2d6a4f] text-[#2d6a4f] bg-[#2d6a4f]/5'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
        {/* Typed entry as well as dragging: exact values are easier to reach
            this way, and the drag surface alone gives a screen reader nothing
            to read or set. */}
        <span className="flex items-center gap-1 ml-auto">
          <AxisInput label="Across" value={position.x} onChange={x => onChange(imagePositionToCss({ ...position, x }))} disabled={disabled} />
          <AxisInput label="Down" value={position.y} onChange={y => onChange(imagePositionToCss({ ...position, y }))} disabled={disabled} />
        </span>
        {!atCenter && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(CENTER_POSITION_CSS)}
            className="flex items-center gap-1 font-sans text-[10px] text-gray-400 hover:text-gray-700 disabled:opacity-50"
            title="Back to centre"
          >
            <RotateCcw size={10} /> Reset
          </button>
        )}
      </div>
      <p className="font-sans text-xs text-gray-400">
        Drag the marker onto whatever has to stay in frame — a summit, a rooftop, a face. Heroes crop to
        fit the visitor&apos;s screen, and this is the point they crop around. Arrow keys nudge it.
      </p>
    </div>
  )
}

function AxisInput({ label, value, onChange, disabled }: {
  label: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-center gap-0.5" title={`${label} (% of the photo's width or height)`}>
      <span className="font-sans text-[9px] tracking-wide uppercase text-gray-400">{label}</span>
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        disabled={disabled}
        onChange={e => {
          const raw = e.target.value.trim()
          // An emptied field is mid-edit, not a request to move to 0% — and
          // `Number('')` is 0, so this has to be caught before the parse.
          if (raw === '') return
          const next = Number(raw)
          if (Number.isFinite(next)) onChange(next)
        }}
        className="w-12 border border-gray-200 px-1 py-0.5 font-sans text-[10px] text-gray-600 bg-[#F7F5F2] focus:outline-none focus:border-[#2d6a4f] disabled:opacity-50"
      />
    </label>
  )
}

function PositionPreview({ image, css, aspect, label }: {
  image: string
  css: string
  aspect: string
  label: string
}) {
  return (
    <div>
      <div className="relative overflow-hidden border border-gray-200 bg-gray-100" style={{ aspectRatio: aspect }}>
        <img src={image} alt="" className="w-full h-full object-cover" style={{ objectPosition: css }} />
      </div>
      <p className="font-sans text-[9px] tracking-wide uppercase text-gray-400 mt-0.5 text-center">{label}</p>
    </div>
  )
}

export default ImagePositionPicker

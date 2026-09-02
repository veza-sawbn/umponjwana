import type { CSSProperties, PointerEventHandler } from 'react'
import type { PublishedLayer } from '@/lib/field-guide'
import { layerStagger } from '@/lib/field-guide'

// One layer, one DOM element — used unchanged by the public page and by the
// dashboard's live preview, so an editor is never positioning against a
// different renderer to the one visitors get.

/** Config that never changes with scroll, handed to CSS as custom properties.
 *  Keeping it out of React state is what lets the reveal run on the
 *  compositor: scrolling only ever flips one data attribute per layer. */
export function layerStyle(layer: PublishedLayer): CSSProperties {
  return {
    '--fg-x': `${layer.x}%`,
    '--fg-y': `${layer.y}%`,
    '--fg-mx': `${layer.mobileX}%`,
    '--fg-my': `${layer.mobileY}%`,
    '--fg-w': `${layer.width}%`,
    '--fg-mw': `${layer.mobileWidth}%`,
    '--fg-rot': `${layer.rotation}deg`,
    '--fg-opacity': layer.opacity,
    '--fg-float': `${layer.floatDistance}px`,
    '--fg-dur': `${layer.fadeDuration}ms`,
    '--fg-delay': `${layerStagger(layer.entranceOrder)}ms`,
    zIndex: layer.zIndex,
  } as CSSProperties
}

export default function FieldGuideLayer({
  layer,
  revealed,
  eager = false,
  trigger,
  selected,
  dragging,
  ...pointer
}: {
  layer: PublishedLayer
  revealed: boolean
  /** First chapter only. Everything below the fold waits. */
  eager?: boolean
  /** Present on the public page: the scroll loop finds the element by this
   *  attribute and flips data-revealed on it. The dashboard preview omits it
   *  and drives `revealed` from React instead. */
  trigger?: number
  /** Dashboard preview only — drag-to-position handles and selection state.
   *  The public page passes none of these and renders an inert element. */
  selected?: boolean
  dragging?: boolean
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerMove?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
  onPointerCancel?: PointerEventHandler<HTMLDivElement>
}) {
  // Marginalia and rules carry nothing a screen reader needs; the specimen
  // record beneath the plate already says it in prose.
  const ariaHidden = layer.decorative || undefined

  return (
    <div
      className="fg-layer"
      data-revealed={revealed ? 'true' : 'false'}
      data-fg-trigger={trigger}
      data-layer-id={layer.id}
      data-selected={selected ? 'true' : undefined}
      data-dragging={dragging ? 'true' : undefined}
      {...pointer}
      style={layerStyle(layer)}
      aria-hidden={ariaHidden}
    >
      {layer.type === 'image' && layer.mediaUrl && (
        <img
          src={layer.mediaUrl}
          alt={layer.decorative ? '' : layer.alt || ''}
          /* Reserving the box from the stored intrinsic size is what stops a
             late-arriving PNG from shoving the composition sideways. */
          width={layer.mediaWidth ?? undefined}
          height={layer.mediaHeight ?? undefined}
          style={
            layer.mediaWidth && layer.mediaHeight
              ? { aspectRatio: `${layer.mediaWidth} / ${layer.mediaHeight}` }
              : undefined
          }
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
        />
      )}

      {layer.type === 'annotation' && (
        <p className="font-display italic text-[13px] md:text-[15px] leading-snug text-[#2B2418]/75 -rotate-1">
          {layer.text}
        </p>
      )}

      {layer.type === 'text' && (
        <div className="text-[#2B2418]">
          {layer.heading && (
            <p className="font-sans text-[9px] md:text-[10px] tracking-[0.2em] uppercase text-[#2B2418]/45 mb-1.5">
              {layer.heading}
            </p>
          )}
          <p className="font-display text-[15px] md:text-[19px] leading-[1.45]">{layer.text}</p>
        </div>
      )}

      {layer.type === 'card' && (
        <div className="border border-[#2B2418]/18 bg-[#FBF8F1]/85 backdrop-blur-[1px] px-4 py-3.5 md:px-5 md:py-4 shadow-[0_1px_10px_rgba(43,36,24,0.07)]">
          {layer.heading && (
            <p className="font-sans text-[9px] md:text-[10px] tracking-[0.2em] uppercase text-[#2B2418]/45 mb-2">
              {layer.heading}
            </p>
          )}
          <p className="font-sans text-[12px] md:text-[13px] leading-[1.6] text-[#2B2418]/85">{layer.text}</p>
        </div>
      )}
    </div>
  )
}

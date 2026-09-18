/* ────────────────────────────────────────────────────────────────────────────
 * Hero image focal points
 *
 * Every hero on the site crops its image (`object-cover`, or a `bg-cover`
 * backdrop) to a frame whose shape it does not control: the homepage hero is
 * near-square on a phone and a wide letterbox on a desktop, a region hero is
 * 16/9, a package hero 45vh. The browser crops to the centre of the photo,
 * which is routinely the wrong half of a Drakensberg shot — the Amphitheatre
 * sits along the top edge, a lodge along the bottom — so the subject is the
 * first thing thrown away.
 *
 * A focal point fixes that without asking anyone to re-crop and re-upload:
 * the admin says which point of the photo must stay in frame, and every
 * render site feeds it to CSS the same way. It is stored as a plain
 * `"<x>% <y>%"` string so the saved value drops straight into
 * `object-position` / `background-position`, reads sensibly in the
 * site_content JSON blob, and needs no migration — anything missing or
 * unparseable simply means "centre", which is what the site already did.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Focal point as percentages of the image's own width/height, 0–100. */
export type ImagePosition = { x: number; y: number }

export const CENTER_POSITION: ImagePosition = { x: 50, y: 50 }

/** Serialized form of {@link CENTER_POSITION} — the stored default. */
export const CENTER_POSITION_CSS = '50% 50%'

const clampPercent = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

// CSS position keywords, so a hand-written `"top"` or `"bottom right"` in the
// content blob keeps working rather than silently falling back to centre.
const KEYWORD_X: Record<string, number> = { left: 0, center: 50, centre: 50, right: 100 }
const KEYWORD_Y: Record<string, number> = { top: 0, center: 50, centre: 50, bottom: 100 }

function parseToken(token: string): { axis: 'x' | 'y' | 'either'; value: number } | null {
  if (token in KEYWORD_X && token in KEYWORD_Y) return { axis: 'either', value: KEYWORD_X[token] }
  if (token in KEYWORD_X) return { axis: 'x', value: KEYWORD_X[token] }
  if (token in KEYWORD_Y) return { axis: 'y', value: KEYWORD_Y[token] }
  const numeric = Number.parseFloat(token)
  return Number.isFinite(numeric) ? { axis: 'either', value: clampPercent(numeric) } : null
}

/**
 * Reads whatever is stored for a focal point into a usable pair. Accepts the
 * serialized `"40% 25%"` form, an `{ x, y }` object, CSS keywords, and a bare
 * `"40%"` (which means "40% across, centred vertically", as CSS does).
 * Anything else — empty, null, garbage — is centre.
 */
export function parseImagePosition(value: unknown): ImagePosition {
  if (value && typeof value === 'object') {
    const { x, y } = value as Partial<ImagePosition>
    return {
      x: Number.isFinite(x) ? clampPercent(x as number) : 50,
      y: Number.isFinite(y) ? clampPercent(y as number) : 50,
    }
  }
  if (typeof value !== 'string') return { ...CENTER_POSITION }

  const tokens = value.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 2)
  if (tokens.length === 0) return { ...CENTER_POSITION }

  const parsed = tokens.map(parseToken)
  if (parsed.some(p => p === null)) return { ...CENTER_POSITION }

  const [first, second] = parsed as { axis: 'x' | 'y' | 'either'; value: number }[]
  // A lone value sets the horizontal axis and centres the other, per CSS.
  if (!second) {
    return first.axis === 'y' ? { x: 50, y: first.value } : { x: first.value, y: 50 }
  }
  // `"top 30%"` is as valid as `"30% top"`, so let an explicit axis win and
  // give the leftover value to whichever axis is still free.
  if (first.axis === 'y' || second.axis === 'x') return { x: second.value, y: first.value }
  return { x: first.value, y: second.value }
}

/** Serializes a focal point for storage and for CSS. */
export function imagePositionToCss(value: unknown): string {
  const { x, y } = parseImagePosition(value)
  return `${x}% ${y}%`
}

export function isCenterPosition(value: unknown): boolean {
  const { x, y } = parseImagePosition(value)
  return x === 50 && y === 50
}

/**
 * Style object for an `object-cover` image (`<img>`, `next/image`).
 * Applied unconditionally — `50% 50%` is exactly the browser default, so a
 * hero with no focal point set renders byte-identically to before.
 */
export function objectPositionStyle(value: unknown): { objectPosition: string } {
  return { objectPosition: imagePositionToCss(value) }
}

/** Style object for a `bg-cover` backdrop div. */
export function backgroundPositionStyle(value: unknown): { backgroundPosition: string } {
  return { backgroundPosition: imagePositionToCss(value) }
}

/** Offered as one-click buttons in the admin position control. */
export const IMAGE_POSITION_PRESETS: { label: string; value: string }[] = [
  { label: 'Top', value: '50% 0%' },
  { label: 'Upper third', value: '50% 25%' },
  { label: 'Centre', value: CENTER_POSITION_CSS },
  { label: 'Lower third', value: '50% 75%' },
  { label: 'Bottom', value: '50% 100%' },
]

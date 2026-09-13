import type { Trail } from '@/lib/trails'

const TONE_STROKE = { forest: '#2d6a4f', light: '#F7F5F2', white: '#ffffff' } as const

/**
 * Is this the artwork lib/gpx.ts generated, or something else?
 *
 * The value comes out of vd_entities.value — a JSON blob, admin-writable — and
 * is handed to dangerouslySetInnerHTML on public trail pages. Today
 * generateRouteArtwork() builds it from GPX coordinates, so it is numeric path
 * data and safe. But nothing between the store and this render enforced that,
 * so the day a value gets pasted rather than computed, this becomes stored XSS
 * on every /hikes page (audit finding L1).
 *
 * The allow-list is the shape generateRouteArtwork actually emits: one <svg>
 * with <path>, <polyline>, <circle> and <g> inside it. Anything with a script,
 * an event handler, a foreignObject, an <a>, or a URL-bearing attribute is not
 * our artwork and is not rendered.
 */
export function isSafeRouteArtwork(svg: string): boolean {
  if (typeof svg !== 'string' || svg.length > 200_000) return false
  if (!/^\s*<svg[\s>]/i.test(svg.trim())) return false

  // Any element outside the set generateRouteArtwork emits.
  const allowedTags = /^(svg|g|path|polyline|polygon|circle|line|rect|title|desc|defs|lineargradient|stop)$/i
  for (const [, tag] of svg.matchAll(/<\/?\s*([a-z][a-z0-9:-]*)/gi)) {
    if (!allowedTags.test(tag)) return false
  }

  // Event handlers, scripts, and anything that can fetch or navigate.
  if (/\son\w+\s*=/i.test(svg)) return false
  if (/<\s*(script|foreignObject|iframe|use|image|a)\b/i.test(svg)) return false
  if (/\b(href|xlink:href|src|srcset|formaction|data)\s*=/i.test(svg)) return false
  if (/(javascript|data|vbscript)\s*:/i.test(svg)) return false
  if (/<!\[CDATA\[|<!--/.test(svg)) return false

  return true
}

export default function RouteArtwork({ trail, className = '', tone = 'forest' }: { trail: Trail; className?: string; tone?: keyof typeof TONE_STROKE }) {
  const svg = trail.analytics?.routeArtworkSvg
  if (!svg || !isSafeRouteArtwork(svg)) {
    return <div className={`flex h-full w-full items-center justify-center bg-[#F7F5F2] text-[10px] uppercase tracking-[0.16em] text-forest/30 ${className}`}>No GPX route</div>
  }
  const renderedSvg = tone === 'forest' ? svg : svg.replaceAll('#2d6a4f', TONE_STROKE[tone])
  return <div className={`[&_svg]:h-full [&_svg]:w-full [&_svg]:drop-shadow-sm ${className}`} dangerouslySetInnerHTML={{ __html: renderedSvg }} />
}

import type { Trail } from '@/lib/trails'

const TONE_STROKE = { forest: '#2d6a4f', light: '#F7F5F2', white: '#ffffff' } as const

export default function RouteArtwork({ trail, className = '', tone = 'forest' }: { trail: Trail; className?: string; tone?: keyof typeof TONE_STROKE }) {
  const svg = trail.analytics?.routeArtworkSvg
  if (!svg) {
    return <div className={`flex h-full w-full items-center justify-center bg-[#F7F5F2] text-[10px] uppercase tracking-[0.16em] text-forest/30 ${className}`}>No GPX route</div>
  }
  const renderedSvg = tone === 'forest' ? svg : svg.replaceAll('#2d6a4f', TONE_STROKE[tone])
  return <div className={`[&_svg]:h-full [&_svg]:w-full [&_svg]:drop-shadow-sm ${className}`} dangerouslySetInnerHTML={{ __html: renderedSvg }} />
}

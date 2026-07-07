import type { Trail } from '@/lib/trails'

export default function RouteArtwork({ trail, className = '', tone = 'forest' }: { trail: Trail; className?: string; tone?: 'forest' | 'light' }) {
  const svg = trail.analytics?.routeArtworkSvg
  if (!svg) {
    return <div className={`flex h-full w-full items-center justify-center bg-[#F7F5F2] text-[10px] uppercase tracking-[0.16em] text-forest/30 ${className}`}>No GPX route</div>
  }
  const renderedSvg = tone === 'light' ? svg.replaceAll('#2d6a4f', '#F7F5F2') : svg
  return <div className={`[&_svg]:h-full [&_svg]:w-full [&_svg]:drop-shadow-sm ${className}`} dangerouslySetInnerHTML={{ __html: renderedSvg }} />
}

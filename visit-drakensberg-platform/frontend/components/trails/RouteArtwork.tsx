import type { Trail } from '@/lib/trails'

export default function RouteArtwork({ trail, className = '' }: { trail: Trail; className?: string }) {
  const svg = trail.analytics?.routeArtworkSvg
  if (!svg) {
    return <div className={`flex h-full w-full items-center justify-center bg-[#F7F5F2] text-[10px] uppercase tracking-[0.16em] text-forest/30 ${className}`}>No GPX route</div>
  }
  return <div className={`[&_svg]:h-full [&_svg]:w-full [&_svg]:drop-shadow-sm ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />
}

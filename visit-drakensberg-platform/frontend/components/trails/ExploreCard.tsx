import Link from 'next/link'
import { Mountain } from 'lucide-react'
import type { Trail } from '@/lib/trails'
import RouteArtwork from '@/components/trails/RouteArtwork'

// Shared visual design for a "browse the Drakensberg" card — image with a
// difficulty badge and optional route-artwork silhouette, an uppercase gold
// eyebrow, a display-font title, and a meta line/row underneath. Originally
// the /hikes trail card; /tours' experience cards render through this same
// component so browsing either listing shows identical imagery and layout.
export default function ExploreCard({
  href,
  image,
  imageAlt,
  eyebrow,
  title,
  meta,
  difficultyLabel,
  difficultyColor = '#2d6a4f',
  topLeftBadge,
  bottomRightBadge,
  routeArtworkTrail,
}: {
  href: string
  image?: string
  imageAlt: string
  eyebrow: React.ReactNode
  title: string
  meta: React.ReactNode
  difficultyLabel?: string
  difficultyColor?: string
  topLeftBadge?: string
  bottomRightBadge?: string
  routeArtworkTrail?: Trail
}) {
  return (
    <Link href={href} className="group block">
      <div className="relative overflow-hidden aspect-[4/3] mb-4 bg-forest/10">
        {image ? (
          <img loading="lazy" decoding="async" src={image} alt={imageAlt}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Mountain className="w-10 h-10 text-forest/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/25" />
        {routeArtworkTrail?.analytics?.routeArtworkSvg && (
          <div className="pointer-events-none absolute bottom-3 right-3 h-12 w-20">
            <RouteArtwork trail={routeArtworkTrail} tone="white" className="h-full w-full" />
          </div>
        )}
        {topLeftBadge && (
          <span className="absolute top-3 left-3 font-sans text-[10px] tracking-[0.15em] uppercase bg-gold text-forest px-2.5 py-1">
            {topLeftBadge}
          </span>
        )}
        {difficultyLabel && (
          <span
            className="absolute bottom-3 left-3 font-sans text-[10px] px-2.5 py-1 uppercase tracking-wide text-white"
            style={{ background: difficultyColor + 'dd' }}
          >
            {difficultyLabel}
          </span>
        )}
        {bottomRightBadge && (
          <span className="absolute bottom-3 right-3 font-sans text-[10px] px-2.5 py-1 uppercase tracking-wide bg-gold/90 text-forest">
            {bottomRightBadge}
          </span>
        )}
      </div>
      <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{eyebrow}</p>
      <h3 className="font-display text-xl text-forest leading-snug mb-2 group-hover:text-sage transition-colors">{title}</h3>
      {meta}
    </Link>
  )
}

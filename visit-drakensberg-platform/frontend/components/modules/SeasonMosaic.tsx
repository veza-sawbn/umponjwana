import Link from 'next/link'
import { SEASONS, SEASON_META } from '@/lib/seasons'

/**
 * The region page's "When to Go" section — four season tiles linking to
 * /regions/[slug]/[season]. Replaces the old plain-text "Best Time to
 * Visit" callout (still rendered above this as the section's own intro
 * copy, sourced from the admin's own bestTime field when set).
 *
 * Uses the region's own heroImage with a season-tinted overlay rather than
 * stock photography per season — every region already has a hero image,
 * so this needs no new admin field and never risks a missing image, while
 * still visually distinguishing each season. See
 * docs/destination-graph/PHASE_I.md.
 */
export default function SeasonMosaic({ regionSlug, heroImage }: { regionSlug: string; heroImage: string }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {SEASONS.map(season => {
        const meta = SEASON_META[season]
        return (
          <Link
            key={season}
            href={`/regions/${regionSlug}/${season}`}
            className="group relative block aspect-[3/4] overflow-hidden"
          >
            <img
              src={heroImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to top, rgba(${meta.tint},0.88) 0%, rgba(${meta.tint},0.35) 55%, rgba(${meta.tint},0.1) 100%)` }}
            />
            <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
              <p className="font-sans text-[10px] tracking-[0.18em] uppercase text-white/70 mb-1">{meta.range}</p>
              <h3 className="font-display italic text-2xl leading-none mb-1.5">{meta.label}</h3>
              <p className="font-sans text-[11px] text-white/80 leading-snug mb-3 max-w-[20ch]">{meta.blurb}</p>
              <span className="font-sans text-[10px] tracking-wide uppercase border-b border-white/40 w-fit pb-0.5 group-hover:border-white transition-colors">
                Explore {meta.label} &rarr;
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

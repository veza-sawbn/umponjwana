import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/* ─── Homepage house style ──────────────────────────────────────────────────
   One look for every homepage band, taken from Top Destinations: a bold
   DM Sans heading with an "Explore all →" link under it, and cards made of a
   rounded 4:3 photo over a small uppercase eyebrow, a semibold title that
   turns gold on hover, and a muted body line.

   Each band keeps its own background, so the colours come in two tones.
   Gold text is only legible on the dark bands; on white/mist the same
   accent uses the deeper brown-700 shade of the gold. */

export type HomeTone = 'light' | 'dark'

export const homeContainer = 'max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-[69px] py-16 lg:py-20'

export const homeType = {
  heading: 'font-sans font-bold text-[34px] lg:text-[52px] leading-[1.1] tracking-[-0.02em]',
  eyebrow: 'font-sans text-[10px] tracking-[0.15em] uppercase',
  cardTitle: 'font-sans font-semibold text-xl lg:text-2xl leading-snug transition-colors',
  cardBody: 'font-sans text-sm leading-relaxed',
  media: 'relative overflow-hidden rounded-2xl aspect-[4/3]',
  image: 'object-cover transition-transform duration-500 group-hover:scale-105 group-focus-visible:scale-105',
  cardLink: 'group block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4',
} as const

export const homeTone: Record<HomeTone, {
  heading: string
  subheading: string
  eyebrow: string
  title: string
  body: string
  link: string
  media: string
  focus: string
}> = {
  dark: {
    heading: 'text-white',
    subheading: 'text-white/60',
    eyebrow: 'text-gold',
    title: 'text-white group-hover:text-gold',
    body: 'text-white/60',
    link: 'text-gold hover:text-white focus-visible:outline-white',
    media: 'bg-white/10',
    focus: 'focus-visible:outline-gold',
  },
  light: {
    heading: 'text-forest',
    subheading: 'text-forest/60',
    eyebrow: 'text-brown-700',
    title: 'text-forest group-hover:text-brown-700',
    body: 'text-forest/60',
    link: 'text-brown-700 hover:text-forest focus-visible:outline-forest',
    media: 'bg-forest/5',
    focus: 'focus-visible:outline-brown-700',
  },
}

/** The "Explore all →" link that sits under each homepage heading. */
export function ExploreLink({ href, tone, children = 'Explore all', className = '' }: {
  href: string
  tone: HomeTone
  children?: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-3 font-sans text-base lg:text-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${homeTone[tone].link} ${className}`}
    >
      {children} <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5" aria-hidden="true" />
    </Link>
  )
}

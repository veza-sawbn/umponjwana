import Link from 'next/link'
import SafeImage from '@/components/ui/SafeImage'
import type { SeasonCard } from '@/lib/season-cards'
import { homeTone, homeType } from '@/components/home/home-style'

/** Pure presentational card — used both in the desktop grid and inside
 *  each mobile slide of TopicListingCarousel, so the two stay visually
 *  identical. See docs/destination-graph/PHASE_I.md. */
export default function SeasonListingCard({ card, variant = 'default' }: { card: SeasonCard; variant?: 'default' | 'home' }) {
  if (variant === 'home') return <HomeSeasonCard card={card} />
  return (
    <Link
      href={card.href}
      className="group bg-white border border-gray-200 overflow-hidden hover:border-gold transition-colors flex flex-col h-full rounded-2xl"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        <SafeImage src={card.image} alt="" fill loading="lazy" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
        <span className="absolute top-3 left-3 bg-white/92 font-sans text-[9px] tracking-[0.1em] uppercase px-2 py-1 text-gray-700">
          {card.kind}
        </span>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="font-sans text-[9.5px] tracking-[0.12em] uppercase text-[#C9A96E] mb-1">{card.eyebrow}</p>
        <h3 className="font-display italic text-lg text-[#000000] leading-tight mb-1.5 group-hover:text-brown-700 transition-colors">
          {card.title}
        </h3>
        <p className="font-sans text-xs text-gray-400 line-clamp-2 mb-3 flex-1">{card.description}</p>
        <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
          <span className="font-sans text-[11px] text-gray-400">{card.priceNote || ' '}</span>
          <span className="font-display italic text-base text-[#2d6a4f]">{card.price}</span>
        </div>
      </div>
    </Link>
  )
}

/** The homepage look (see components/home/home-style.tsx): rounded 4:3
 *  photo, no box, eyebrow / title / body underneath. */
function HomeSeasonCard({ card }: { card: SeasonCard }) {
  const t = homeTone.light
  return (
    <Link href={card.href} className={`${homeType.cardLink} ${t.focus}`}>
      <div className={`${homeType.media} bg-mist`}>
        <SafeImage src={card.image} alt="" fill loading="lazy" sizes="(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 25vw" className={homeType.image} />
        <span className="absolute top-3 left-3 bg-white/90 rounded-full font-sans text-[10px] tracking-[0.15em] uppercase px-3 py-1 text-forest">
          {card.kind}
        </span>
      </div>
      <div className="pt-5">
        <p className={`${homeType.eyebrow} ${t.eyebrow} mb-1`}>{card.eyebrow}</p>
        <h3 className={`font-sans font-semibold text-lg lg:text-xl leading-snug transition-colors mb-2 ${t.title}`}>{card.title}</h3>
        {card.description && <p className={`${homeType.cardBody} ${t.body} line-clamp-2`}>{card.description}</p>}
        {card.price && (
          <p className="mt-3 font-sans text-sm text-forest/60">
            <span className="font-semibold text-base text-forest">{card.price}</span>
            {card.priceNote && <span> {card.priceNote}</span>}
          </p>
        )}
      </div>
    </Link>
  )
}

import Link from 'next/link'
import type { SeasonCard } from '@/lib/season-cards'

/** Pure presentational card — used both in the desktop grid and inside
 *  each mobile slide of TopicListingCarousel, so the two stay visually
 *  identical. See docs/destination-graph/PHASE_I.md. */
export default function SeasonListingCard({ card }: { card: SeasonCard }) {
  return (
    <Link
      href={card.href}
      className="group bg-white border border-gray-200 overflow-hidden hover:border-[#2d6a4f] transition-colors flex flex-col h-full"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        <img src={card.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <span className="absolute top-3 left-3 bg-white/92 font-sans text-[9px] tracking-[0.1em] uppercase px-2 py-1 text-gray-700">
          {card.kind}
        </span>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="font-sans text-[9.5px] tracking-[0.12em] uppercase text-[#C9A96E] mb-1">{card.eyebrow}</p>
        <h3 className="font-display italic text-lg text-[#000000] leading-tight mb-1.5 group-hover:text-[#2d6a4f] transition-colors">
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

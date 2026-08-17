import { Droplets, Mountain, Bird, Landmark, Users, Zap, type LucideIcon } from 'lucide-react'
import { SEASON_TOPIC_META, type SeasonTopic } from '@/lib/seasons'
import { toSeasonCard } from '@/lib/season-cards'
import type { SeasonalItem } from '@/lib/modules'
import SeasonListingCard from './SeasonListingCard'
import TopicListingCarousel from './TopicListingCarousel'

const TOPIC_ICON: Record<SeasonTopic, LucideIcon> = {
  water: Droplets,
  mountains: Mountain,
  wildlife: Bird,
  culture: Landmark,
  family: Users,
  adventure: Zap,
}

/**
 * One topic group on a /regions/[slug]/[season] page — heading + a short
 * description of what the topic means (per the explicit ask: "By Water"
 * should say what it actually groups), then the listings themselves:
 * a static grid on tablet/desktop, an infinite Swiper carousel on mobile.
 * See docs/destination-graph/PHASE_I.md.
 */
export default function SeasonTopicSection({ topic, items }: { topic: SeasonTopic; items: SeasonalItem[] }) {
  const meta = SEASON_TOPIC_META[topic]
  const Icon = TOPIC_ICON[topic]
  const cards = items.map(toSeasonCard)

  return (
    <div>
      <div className="flex items-start gap-3 mb-1.5">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center bg-mist border border-gray-200 mt-0.5">
          <Icon size={17} className="text-[#2d6a4f]" />
        </span>
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="font-display italic text-2xl text-[#000000]">{meta.label}</h2>
            <span className="font-sans text-xs text-gray-400">{cards.length} listing{cards.length === 1 ? '' : 's'}</span>
          </div>
          <p className="font-sans text-sm text-gray-500 mt-0.5">{meta.description}</p>
        </div>
      </div>

      {/* Desktop/tablet: static grid */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
        {cards.map(card => <SeasonListingCard key={card.id} card={card} />)}
      </div>

      {/* Mobile: infinite carousel */}
      <div className="sm:hidden mt-5">
        <TopicListingCarousel cards={cards} />
      </div>
    </div>
  )
}

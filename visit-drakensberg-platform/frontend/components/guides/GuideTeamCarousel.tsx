'use client'
import Link from 'next/link'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import { Star, UserCircle } from 'lucide-react'
import { GUIDE_TYPE_LABEL, guideTypeOf, type GuideProfile, type GuideType } from '@/lib/operators'

const TYPE_CHIP: Record<GuideType, string> = {
  certified: 'bg-emerald-50 text-emerald-700',
  trainee: 'bg-blue-50 text-blue-600',
  expedition_leader: 'bg-[#C9A96E]/20 text-[#8B6914]',
}

function GuideCard({ g }: { g: GuideProfile }) {
  const type = guideTypeOf(g)
  return (
    <Link
      href={`/guides/${g.id}`}
      className="group flex h-full flex-col bg-white border border-gray-200 hover:border-[#2d6a4f] transition-colors"
    >
      <div className="relative aspect-[3/4] bg-[#2d6a4f]/10 overflow-hidden">
        {g.portrait ? (
          <img
            src={g.portrait}
            alt={g.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-display italic text-3xl text-[#2d6a4f]/30">
              {g.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
        )}
        <span className={`absolute top-3 left-3 font-sans text-[10px] tracking-[0.08em] uppercase px-2 py-1 ${TYPE_CHIP[type]}`}>
          {GUIDE_TYPE_LABEL[type]}
        </span>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <p className="font-display italic text-lg leading-tight">{g.name}</p>
        {g.speciality && (
          <p className="font-sans text-xs text-gray-400 mt-0.5 truncate">{g.speciality}</p>
        )}
        <div className="flex items-center gap-3 mt-2 font-sans text-xs text-gray-500 flex-wrap">
          {g.yearsExperience ? <span>{g.yearsExperience} yrs experience</span> : null}
          {g.rating > 0 && (
            <span className="flex items-center gap-1 text-[#C9A96E]">
              <Star size={11} className="fill-[#C9A96E]" /> {g.rating}
            </span>
          )}
        </div>
        <span className="font-sans text-xs text-[#2d6a4f] mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5">
          <UserCircle size={12} /> View Profile →
        </span>
      </div>
    </Link>
  )
}

/**
 * An operator's guide roster, swiped rather than stacked. A roster is a set of
 * faces, so each slide leads with the guide's portrait at a portrait aspect
 * ratio instead of the thumbnail-beside-text row this replaced.
 *
 * slidesPerView is fractional at every breakpoint so a sliver of the next
 * guide is always showing — that peek is what says "there are more of us"
 * without needing arrows. Slides stretch to a common height so cards with and
 * without a speciality line still line up.
 */
export default function GuideTeamCarousel({ guides }: { guides: GuideProfile[] }) {
  if (guides.length === 0) return null

  return (
    <Swiper
      modules={[Pagination]}
      spaceBetween={16}
      slidesPerView={1.3}
      breakpoints={{
        640: { slidesPerView: 2.3 },
        1024: { slidesPerView: 3.2 },
      }}
      grabCursor
      pagination={{ clickable: true }}
      className="!pb-10"
      style={{
        '--swiper-pagination-color': '#2d6a4f',
        '--swiper-pagination-bullet-inactive-color': '#00000022',
      } as React.CSSProperties}
    >
      {guides.map(g => (
        <SwiperSlide key={g.id} className="h-auto self-stretch">
          <GuideCard g={g} />
        </SwiperSlide>
      ))}
    </Swiper>
  )
}

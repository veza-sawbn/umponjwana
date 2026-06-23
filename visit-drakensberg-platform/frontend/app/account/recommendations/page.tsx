'use client'

import Link from 'next/link'
import { MapPin, Clock, Mountain, Star } from 'lucide-react'

const RECENT_VIEWS = [
  { title: 'Cathedral Peak Mountain Lodge', type: 'Stay', location: 'Northern Berg', image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&q=80', href: '/stays/s1', time: '2 hours ago' },
  { title: 'Tugela Falls Circuit', type: 'Hike', location: 'Royal Natal National Park', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80', href: '/hikes/tugela-falls', time: 'Yesterday' },
  { title: 'Guided Rock Climbing', type: 'Activity', location: 'Amphitheatre', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', href: '/activities/a1', time: '3 days ago' },
  { title: 'Tendele Tented Camp', type: 'Stay', location: 'Northern Berg', image: 'https://images.unsplash.com/photo-1533873984035-25970ab07461?w=400&q=80', href: '/stays/s2', time: '4 days ago' },
]

const RECOMMENDATIONS = [
  { title: 'San Rock Art Full-Day Tour', type: 'Experience', location: "Giant's Castle", rating: 4.9, price: 620, image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80', href: '/activities/a2', reason: 'Because you viewed cultural heritage sites' },
  { title: 'Amphitheatre via Chain Ladder', type: 'Hike', location: 'Royal Natal', rating: 4.8, price: null, image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80', href: '/hikes/amphitheatre', reason: 'Pairs well with Cathedral Peak Lodge' },
  { title: "Giant's Castle Restcamp", type: 'Stay', location: 'Central Berg', rating: 4.5, price: 680, image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400&q=80', href: '/stays/s3', reason: 'Based on your interest in Northern Berg' },
  { title: 'Fairy Glen Waterfall Walk', type: 'Hike', location: 'Central Berg', rating: 4.6, price: null, image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80', href: '/hikes/fairy-glen', reason: 'Popular with visitors like you' },
  { title: 'Cathedral Peak Summit', type: 'Hike', location: 'Central Berg, Northern', rating: 4.7, price: null, image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=400&q=80', href: '/hikes/cathedral-peak', reason: 'Because you stayed in Northern Berg' },
  { title: 'Berg Photography Tour', type: 'Activity', location: 'Northern Berg', rating: 4.8, price: 950, image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80', href: '/activities/a1', reason: 'Trending in Northern Berg' },
]

export default function RecommendationsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display italic text-3xl text-[#000000]">Continue Planning Your Trip</h1>
        <p className="font-sans text-sm text-gray-400 mt-1">Picks based on your recent activity and saved listings</p>
      </div>

      {/* Recently viewed */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-5">
          <Clock size={16} className="text-[#C9A96E]" />
          <h2 className="font-display italic text-xl text-[#000000]">Recently Viewed</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {RECENT_VIEWS.map(item => (
            <Link key={item.href} href={item.href} className="group bg-white border border-gray-200 overflow-hidden hover:border-[#2d6a4f] transition-colors">
              <div className="h-28 overflow-hidden">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-3">
                <span className="font-sans text-[9px] tracking-[0.12em] uppercase text-[#C9A96E]">{item.type}</span>
                <p className="font-display italic text-base leading-tight mt-0.5">{item.title}</p>
                <p className="font-sans text-xs text-gray-400 mt-1">{item.time}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Personalised recommendations */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <Mountain size={16} className="text-[#C9A96E]" />
          <h2 className="font-display italic text-xl text-[#000000]">Recommended for You</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RECOMMENDATIONS.map(item => (
            <Link key={item.title} href={item.href} className="group bg-white border border-gray-200 overflow-hidden flex hover:border-[#2d6a4f] transition-colors">
              <div className="w-28 h-28 shrink-0 overflow-hidden">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-4 flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-sans text-[9px] tracking-[0.12em] uppercase text-[#C9A96E]">{item.type}</span>
                  <span className="flex items-center gap-0.5 font-sans text-xs text-gray-400">
                    <Star size={10} className="text-[#C9A96E] fill-[#C9A96E]" />{item.rating}
                  </span>
                </div>
                <p className="font-display italic text-lg leading-tight">{item.title}</p>
                <p className="font-sans text-xs text-gray-400 flex items-center gap-1 mt-1"><MapPin size={10} />{item.location}</p>
                <p className="font-sans text-xs text-gray-300 mt-2 italic">{item.reason}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

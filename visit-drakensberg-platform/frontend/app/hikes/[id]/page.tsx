'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Mountain, Clock, TrendingUp, Users, Star, CheckCircle } from 'lucide-react'

const DIFF_COLOR: Record<string, string> = { Easy: '#4A7251', Moderate: '#C9A96E', Hard: '#c0392b' }
const DIFF_BG: Record<string, string> = { Easy: '#4A725122', Moderate: '#C9A96E22', Hard: '#c0392b22' }

const TRAILS: Record<string, any> = {
  'tugela-falls': {
    name: 'Tugela Falls Circuit', distance: '14 km', elevation: 1200, duration: '6–8 hours', difficulty: 'Hard',
    description: 'One of the most dramatic hikes in Africa, the Tugela Falls Circuit climbs from the Mahai campsite in Royal Natal National Park to the base and top of the Tugela Falls — the second highest waterfall in the world at 948m. The route ascends the iconic chain ladder to reach the Amphitheatre plateau, with panoramic views across the full Berg escarpment and into Lesotho.',
    what_to_bring: ['Layers (summit wind is significant)', '3L water minimum', 'Snacks and lunch', 'Hiking poles', 'Rain jacket', 'Headlamp for early starts', 'Park entry permit'],
    region: 'Royal Natal National Park',
    start_point: 'Mahai Campsite Car Park',
    color: 'bg-[#1a1a2e]',
  },
  'amphitheatre': {
    name: 'Amphitheatre via Chain Ladder', distance: '8 km', elevation: 780, duration: '4–5 hours', difficulty: 'Moderate',
    description: 'The classic Drakensberg hike. The chain ladder ascent to the Amphitheatre plateau is a rite of passage for visitors to the Northern Berg. From the top, the views across the escarpment are unmatched anywhere in southern Africa.',
    what_to_bring: ['2L water', 'Snacks', 'Sun protection', 'Light jacket'],
    region: 'Royal Natal National Park',
    start_point: 'Tendele Camp',
    color: 'bg-[#2d6a4f]',
  },
  'fairy-glen': {
    name: 'Fairy Glen Waterfall Walk', distance: '5 km', elevation: 240, duration: '2 hours', difficulty: 'Easy',
    description: 'A gentle introductory walk through indigenous forest and fynbos to a beautiful waterfall pool. Ideal for families with children and visitors new to the Berg.',
    what_to_bring: ['1.5L water', 'Comfortable shoes', 'Swimwear in summer'],
    region: 'Central Berg',
    start_point: 'Champagne Castle Hotel',
    color: 'bg-[#4A7251]',
  },
  'cathedral-peak': {
    name: 'Cathedral Peak Summit', distance: '16 km', elevation: 1500, duration: '8 hours', difficulty: 'Hard',
    description: 'The iconic pyramid summit of Cathedral Peak rewards fit hikers with 360-degree views across both the escarpment and the foothills. The route requires route-finding skills on the upper section — a guide is highly recommended.',
    what_to_bring: ['3L water', 'Full lunch', 'Emergency shelter', 'Navigation tools', 'Crampons in winter'],
    region: 'Central Berg, Northern',
    start_point: 'Cathedral Peak Hotel Trailhead',
    color: 'bg-[#8B4513]',
  },
}

const GUIDES = [
  { id: 'g1', full_name: 'Sipho Dlamini', specialties: ['Multi-day hikes', 'San rock art'], languages: ['English', 'Zulu'], initials: 'SD' },
  { id: 'g3', full_name: 'Thabo Ndlovu', specialties: ['Wilderness traverses', 'Wildlife tracking'], languages: ['English', 'Zulu', 'Afrikaans'], initials: 'TN' },
  { id: 'g2', full_name: 'Anele Mokoena', specialties: ['Day hikes', 'Flora'], languages: ['English', 'Xhosa'], initials: 'AM' },
]

const RELATED = [
  { name: 'Amphitheatre via Chain Ladder', distance: '8 km', difficulty: 'Moderate', href: '/hikes/amphitheatre' },
  { name: 'Fairy Glen Waterfall Walk', distance: '5 km', difficulty: 'Easy', href: '/hikes/fairy-glen' },
  { name: 'Cathedral Peak Summit', distance: '16 km', difficulty: 'Hard', href: '/hikes/cathedral-peak' },
]

const REVIEWS = [
  { name: 'James F.', rating: 5, date: 'May 2026', comment: 'The chain ladder section was exhilarating. Views from the top were worth every step. Go early to avoid afternoon clouds.' },
  { name: 'Sarah T.', rating: 5, date: 'April 2026', comment: 'Did this with our guide Sipho. His knowledge of the geology and San history made the hike so much richer.' },
  { name: 'Johan vdB', rating: 4, date: 'March 2026', comment: 'Challenging but achievable. Allow more time than the estimate if you want to stop for photos — and you will.' },
]

export default function HikeDetailPage() {
  const { id } = useParams() as { id: string }
  const trail = TRAILS[id] || TRAILS['tugela-falls']
  const diff = trail.difficulty

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className={`${trail.color} text-white py-20 px-6 lg:px-12 mt-16`}>
        <div className="max-w-[1440px] mx-auto">
          <Link href="/hikes" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={16} /> All Trails
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">{trail.region}</p>
              <h1 className="font-display italic text-5xl lg:text-6xl mb-4">{trail.name}</h1>
              <p className="font-sans text-sm text-white/60">Starting point: {trail.start_point}</p>
            </div>
            <span className="font-sans text-sm px-4 py-2 mt-2" style={{ color: DIFF_COLOR[diff], background: DIFF_BG[diff] }}>
              {diff}
            </span>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Mountain, label: 'Distance', value: trail.distance },
            { icon: TrendingUp, label: 'Elevation Gain', value: `+${trail.elevation.toLocaleString()} m` },
            { icon: Clock, label: 'Duration', value: trail.duration },
            { icon: Users, label: 'Difficulty', value: trail.difficulty },
          ].map(stat => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="flex items-center gap-3">
                <Icon size={20} className="text-[#C9A96E]" />
                <div>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{stat.label}</p>
                  <p className="font-display italic text-xl">{stat.value}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            {/* Description */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">About this Trail</h2>
              <p className="font-sans text-gray-700 leading-relaxed">{trail.description}</p>
            </div>

            {/* Elevation Profile */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">Elevation Profile</h2>
              <div className="bg-white border border-gray-200 p-4">
                <svg viewBox="0 0 400 120" className="w-full h-32" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2d6a4f" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#2d6a4f" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  <polyline fill="url(#elevGrad)" stroke="#2d6a4f" strokeWidth="2"
                    points="0,110 40,100 80,80 120,60 160,35 200,20 240,15 280,25 320,50 360,80 400,110 400,120 0,120" />
                </svg>
                <div className="flex justify-between font-sans text-xs text-gray-400 mt-1">
                  <span>Start {trail.start_point}</span>
                  <span>Summit</span>
                  <span>Return</span>
                </div>
              </div>
            </div>

            {/* What to bring */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">What to Bring</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {trail.what_to_bring.map((item: string) => (
                  <div key={item} className="flex items-start gap-2.5 bg-white border border-gray-200 px-4 py-3">
                    <CheckCircle size={14} className="text-[#2d6a4f] mt-0.5 shrink-0" />
                    <span className="font-sans text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gallery placeholder */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">Gallery</h2>
              <div className="grid grid-cols-3 gap-2">
                {[`${trail.color}`, 'bg-[#4A7251]', 'bg-[#C9A96E]/60'].map((bg, i) => (
                  <div key={i} className={`${bg} aspect-[4/3]`} />
                ))}
              </div>
            </div>

            {/* Guides */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-6">Expert Guides for this Trail</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {GUIDES.map(guide => (
                  <div key={guide.id} className="bg-white border border-gray-200 p-5">
                    <div className="w-12 h-12 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-xl mb-3">{guide.initials}</div>
                    <h3 className="font-display italic text-lg mb-1">{guide.full_name}</h3>
                    <p className="font-sans text-xs text-gray-500 mb-3">{guide.specialties.join(' · ')}</p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {guide.languages.map((l: string) => <span key={l} className="bg-[#F7F5F2] px-2 py-0.5 font-sans text-xs">{l}</span>)}
                    </div>
                    <Link href={`/guides/${guide.id}`} className="block text-center border border-[#2d6a4f] text-[#2d6a4f] py-2 font-sans text-xs hover:bg-[#2d6a4f] hover:text-white transition-colors">
                      Book Guided Hike
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-5">Hiker Reviews</h2>
              <div className="space-y-4">
                {REVIEWS.map((r, i) => (
                  <div key={i} className="bg-white border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-sm">{r.name[0]}</div>
                        <div>
                          <p className="font-sans text-sm font-medium">{r.name}</p>
                          <p className="font-sans text-xs text-gray-400">{r.date}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} size={11} className="text-[#C9A96E] fill-[#C9A96E]" />)}</div>
                    </div>
                    <p className="font-sans text-sm text-gray-700 leading-relaxed">{r.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-[#2d6a4f] text-white p-6">
              <h3 className="font-display italic text-xl mb-3">Book a Guided Experience</h3>
              <p className="font-sans text-sm text-white/70 mb-5">A certified guide transforms this trail. Includes permit, safety equipment and deep local knowledge.</p>
              <Link href="/guides" className="block text-center bg-[#C9A96E] text-[#2d2d2d] py-3 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors">
                Find a Guide →
              </Link>
            </div>

            <div className="bg-white border border-gray-200 p-5">
              <h3 className="font-display italic text-xl mb-4">Trail Info</h3>
              <div className="space-y-3 font-sans text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Region</span><span className="text-right ml-4">{trail.region}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Distance</span><span>{trail.distance}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Elevation</span><span>+{trail.elevation.toLocaleString()}m</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Duration</span><span>{trail.duration}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-400">Difficulty</span>
                  <span className="px-2.5 py-1 text-xs" style={{ color: DIFF_COLOR[diff], background: DIFF_BG[diff] }}>{diff}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-display italic text-xl text-[#000000] mb-4">Related Trails</h3>
              {RELATED.filter(r => r.href !== `/hikes/${id}`).slice(0, 2).map(r => (
                <Link key={r.href} href={r.href} className="block bg-white border border-gray-200 p-4 mb-3 hover:border-[#2d6a4f] transition-colors">
                  <p className="font-display italic text-lg mb-1">{r.name}</p>
                  <div className="flex items-center gap-3 font-sans text-xs text-gray-500">
                    <span>{r.distance}</span>
                    <span className="px-2 py-0.5" style={{ color: DIFF_COLOR[r.difficulty], background: DIFF_BG[r.difficulty] }}>{r.difficulty}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

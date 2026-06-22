'use client'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import SearchBar from '@/components/search/SearchBar'
import PanoramaViewer from '@/components/panorama/PanoramaViewer'
import Footer from '@/components/layout/Footer'

/* ─── Data ─────────────────────────────────────────────────────────────────── */

const STATS = [
  { value: '3,482m', label: 'Highest Peak' },
  { value: '243,000', label: 'Hectares Protected' },
  { value: '500+', label: 'Bird Species' },
  { value: '20,000+', label: 'San Rock Art Sites' },
]

const CATEGORIES = [
  { label: 'Stays', href: '/stays', img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80' },
  { label: 'Hikes', href: '/hikes', img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80' },
  { label: 'Activities', href: '/activities', img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80' },
  { label: 'Reserves', href: '/nature-reserves', img: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600&q=80' },
  { label: 'Packages', href: '/packages', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80' },
]

const REGIONS = [
  {
    name: 'Northern Berg',
    subtitle: 'Royal Natal & Amphitheatre',
    desc: 'Home to the iconic Amphitheatre and the Tugela Falls, the second highest waterfall in the world.',
    img: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=900&q=80',
    href: '/regions#northern',
  },
  {
    name: 'Central Berg',
    subtitle: 'Cathedral Peak & Giants Castle',
    desc: 'Alpine meadows, ancient San rock art and dramatic escarpment views stretching to Lesotho.',
    img: 'https://images.unsplash.com/photo-1542587222-e14b891ee40b?w=900&q=80',
    href: '/regions#central',
  },
  {
    name: 'Southern Berg',
    subtitle: 'Sani Pass & Mkhomazi',
    desc: 'The legendary Sani Pass climbs to the roof of Africa through a landscape unlike any other.',
    img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=900&q=80',
    href: '/regions#southern',
  },
]

const STORIES = [
  {
    tag: 'Wildlife',
    title: 'The bearded vulture — rarest raptor in Southern Africa',
    img: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80',
    href: '/stories/bearded-vulture',
    date: 'March 2025',
  },
  {
    tag: 'Culture',
    title: 'Reading the rock: San art and the spirit world',
    img: 'https://images.unsplash.com/photo-1529946179074-1f3cf40c0a0e?w=800&q=80',
    href: '/stories/san-rock-art',
    date: 'January 2025',
  },
  {
    tag: 'Adventure',
    title: 'Five days on the Drakensberg Grand Traverse',
    img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
    href: '/stories/grand-traverse',
    date: 'November 2024',
  },
]

const TRAILS = [
  { name: 'Tugela Falls Circuit', distance: '14 km', elevation: '+1,200 m', difficulty: 'Hard', time: '6–8 h', href: '/hikes/tugela-falls' },
  { name: 'Amphitheatre via Chain Ladder', distance: '8 km', elevation: '+780 m', difficulty: 'Moderate', time: '4–5 h', href: '/hikes/amphitheatre' },
  { name: 'Fairy Glen Waterfall Walk', distance: '5 km', elevation: '+240 m', difficulty: 'Easy', time: '2 h', href: '/hikes/fairy-glen' },
  { name: 'Cathedral Peak Summit', distance: '16 km', elevation: '+1,500 m', difficulty: 'Hard', time: '8 h', href: '/hikes/cathedral-peak' },
]

const DIFF_COLOR: Record<string, string> = {
  Easy: '#4A7251',
  Moderate: '#C9A96E',
  Hard: '#c0392b',
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <main className="bg-mist min-h-screen">

      {/* ── 1. Hero ── */}
      <section className="relative h-screen min-h-[600px] flex flex-col">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=1800&q=85"
            alt="Drakensberg mountains"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/60" />
        </div>

        {/* Content */}
        <div className="relative flex-1 flex flex-col justify-end pb-20 px-6 lg:px-20 max-w-[1440px] mx-auto w-full">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-4">
            KwaZulu-Natal · South Africa
          </p>
          <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl text-white leading-[0.9] mb-6 max-w-3xl">
            The Barrier<br />of Spears
          </h1>
          <p className="font-sans text-base text-white/70 max-w-md mb-10 font-light leading-relaxed">
            Africa&apos;s highest mountain range. A UNESCO World Heritage Site. Two hundred kilometres of wild escarpment.
          </p>

          {/* Search */}
          <div className="max-w-2xl">
            <SearchBar />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40">
          <ChevronDown className="w-5 h-5 animate-bounce-slow" />
        </div>
      </section>

      {/* ── 2. Stats strip ── */}
      <section className="bg-forest text-white">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="font-display text-3xl text-gold">{s.value}</p>
              <p className="font-sans text-xs text-white/40 mt-1 tracking-wide uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. Categories ── */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20">
        <div className="mb-10">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">What to do</p>
          <h2 className="font-display text-4xl text-forest">Explore the Berg</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CATEGORIES.map((cat) => (
            <Link key={cat.href} href={cat.href} className="group relative overflow-hidden aspect-[3/4]">
              <img
                src={cat.img}
                alt={cat.label}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="absolute bottom-4 left-4 font-display text-xl text-white">{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 4. Regions ── */}
      <section className="bg-white py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">By region</p>
              <h2 className="font-display text-4xl text-forest">Choose your Berg</h2>
            </div>
            <Link href="/regions" className="hidden sm:flex items-center gap-2 font-sans text-sm text-forest/50 hover:text-forest transition-colors">
              All regions <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {REGIONS.map((r) => (
              <Link key={r.href} href={r.href} className="group block">
                <div className="relative overflow-hidden aspect-[4/3] mb-4">
                  <img
                    src={r.img}
                    alt={r.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-104"
                  />
                </div>
                <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{r.subtitle}</p>
                <h3 className="font-display text-2xl text-forest mb-2">{r.name}</h3>
                <p className="font-sans text-sm text-forest/55 leading-relaxed">{r.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Panorama feature ── */}
      <section className="py-20 bg-mist">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-10 items-center mb-10">
            <div>
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-3">Interactive panorama</p>
              <h2 className="font-display text-4xl text-forest leading-tight">
                See the peaks<br />before you go
              </h2>
            </div>
            <p className="font-sans text-base text-forest/55 leading-relaxed">
              Drag the panorama to identify the peaks surrounding the Amphitheatre viewpoint. Powered by PeakVisor satellite elevation data.
            </p>
          </div>
          <PanoramaViewer />
          <div className="mt-6 text-right">
            <Link href="/nature-reserves" className="font-sans text-sm text-forest/50 hover:text-forest inline-flex items-center gap-1.5 transition-colors">
              Explore all reserves <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 6. Stories ── */}
      <section className="bg-white py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">Journal</p>
              <h2 className="font-display text-4xl text-forest">Stories from the Berg</h2>
            </div>
            <Link href="/stories" className="hidden sm:flex items-center gap-2 font-sans text-sm text-forest/50 hover:text-forest transition-colors">
              All stories <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {STORIES.map((s) => (
              <Link key={s.href} href={s.href} className="group block">
                <div className="relative overflow-hidden aspect-[3/2] mb-4">
                  <img src={s.img} alt={s.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
                <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-2">{s.tag} · {s.date}</p>
                <h3 className="font-display text-xl text-forest leading-snug group-hover:text-sage transition-colors">{s.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. Trails ── */}
      <section className="bg-forest py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-2">On foot</p>
              <h2 className="font-display text-4xl text-white">Top trails</h2>
            </div>
            <Link href="/hikes" className="hidden sm:flex items-center gap-2 font-sans text-sm text-white/40 hover:text-white transition-colors">
              All hikes <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="divide-y divide-white/10">
            {TRAILS.map((t, i) => (
              <Link key={t.href} href={t.href} className="group flex items-center justify-between py-5 hover:pl-2 transition-all duration-200">
                <div className="flex items-center gap-6">
                  <span className="font-sans text-2xl text-white/15 font-light tabular-nums w-8">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="font-display text-lg text-white group-hover:text-gold transition-colors">{t.name}</h3>
                    <p className="font-sans text-xs text-white/35 mt-0.5">{t.distance} · {t.elevation} · {t.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className="font-sans text-xs px-2.5 py-1"
                    style={{ color: DIFF_COLOR[t.difficulty], background: DIFF_COLOR[t.difficulty] + '22' }}
                  >
                    {t.difficulty}
                  </span>
                  <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-gold transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. Newsletter ── */}
      <section className="bg-mist py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="max-w-xl">
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-3">Stay informed</p>
            <h2 className="font-display text-4xl text-forest mb-4">Berg dispatches</h2>
            <p className="font-sans text-sm text-forest/55 mb-8 leading-relaxed">
              Seasonal trail conditions, new accommodation, and stories from the escarpment — delivered monthly.
            </p>
            <form className="flex gap-0 max-w-md" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 px-4 py-3 bg-white border border-black/10 font-sans text-sm text-forest placeholder:text-forest/30 focus:outline-none focus:border-forest transition-colors"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-forest text-white font-sans text-sm hover:bg-sage transition-colors whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <Footer />
    </main>
  )
}

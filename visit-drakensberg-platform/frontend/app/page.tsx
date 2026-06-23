'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, X } from 'lucide-react'
import { motion } from 'framer-motion'
import SearchBar from '@/components/search/SearchBar'
import PanoramaViewer from '@/components/panorama/PanoramaViewer'
import Footer from '@/components/layout/Footer'
import { getAllSiteContent, SITE_CONTENT_DEFAULTS } from '@/lib/site-content'
import { staggerContainer, staggerChild, fadeUp } from '@/lib/motion'

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

const UPCOMING_EVENTS = [
  { id: '1', title: 'Drakensberg Star Gazing Night', date: '20 Jul 2026', location: 'Cathedral Peak', price: 350, type: 'event' },
  { id: '2', title: 'Winter Wildflower Walk Special', date: '1–31 Jul 2026', location: "Monk's Cowl", price: 180, type: 'special' },
  { id: '3', title: 'San Rock Art Full-Day Tour', date: '5 Aug 2026', location: "Giant's Castle", price: 620, type: 'event' },
  { id: '4', title: 'Berg & Braai Sunset Special', date: '25 Jul 2026', location: 'Champagne Valley', price: 450, type: 'special' },
]

const FEATURED_STAYS = [
  { id: 's1', title: 'Cathedral Peak Mountain Lodge', location: 'Northern Berg', price: 1850, rating: 4.9, reviews: 142, rooms: 18, img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80' },
  { id: 's2', title: 'Amphitheatre Backpackers', location: 'Royal Natal', price: 320, rating: 4.7, reviews: 89, rooms: 6, img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80' },
  { id: 's3', title: 'Sani Lodge Drakensberg', location: 'Southern Berg', price: 2200, rating: 4.8, reviews: 67, rooms: 12, img: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80' },
]

const FEATURED_PACKAGES = [
  {
    id: 'p1',
    title: 'Drakensberg Royal Traverse',
    duration: 7,
    price: 12500,
    includes: ['Accommodation', 'All meals', 'Professional guide', 'Park fees', 'Airport transfers'],
    img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  },
  {
    id: 'p2',
    title: 'Sani Pass & Highlands Explorer',
    duration: 5,
    price: 8900,
    includes: ['4×4 transport', 'Lesotho day trip', 'Lodge stays', 'Guided hikes', 'Braai dinner'],
    img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=800&q=80',
  },
]

const SPECIALS = [
  { id: 'sp1', title: 'Winter Wildflower Walk', offer: '20% off guided walks', location: "Monk's Cowl", dates: 'Jul 2026', price: 180 },
  { id: 'sp2', title: 'Berg & Braai Sunset', offer: 'Sunset dinner + live music', location: 'Champagne Valley', dates: '25 Jul 2026', price: 450 },
  { id: 'sp3', title: 'Kids Berg Explorer Camp', offer: '2-night adventure camp', location: 'Royal Natal', dates: '12–14 Jul 2026', price: 2200 },
]

/* ─── Component ─────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [hero, setHero] = useState(SITE_CONTENT_DEFAULTS.hero)
  const [promos, setPromos] = useState(SITE_CONTENT_DEFAULTS.promotions)
  const [promoBannerDismissed, setPromoBannerDismissed] = useState(false)

  useEffect(() => {
    getAllSiteContent().then(content => {
      setHero(content.hero)
      setPromos(content.promotions)
    })
  }, [])

  return (
    <main className="bg-mist min-h-screen">

      {/* ── 0. Promo Banner (admin-controlled) ── */}
      {promos.enabled && !promoBannerDismissed && (
        <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-2.5 font-sans text-sm text-white" style={{ backgroundColor: promos.banner_color }}>
          <span />
          <Link href={promos.banner_link} className="hover:underline">{promos.banner_text}</Link>
          <button onClick={() => setPromoBannerDismissed(true)} className="text-white/60 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 1. Hero ── */}
      <section className="relative h-screen min-h-[600px] flex flex-col">
        {/* Background */}
        <div className="absolute inset-0">
          {hero.video_url ? (
            <video
              src={hero.video_url}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={hero.image_url}
              alt="Drakensberg mountains"
              className="w-full h-full object-cover"
            />
          )}
          <div
            className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/60"
            style={{ opacity: hero.overlay_opacity / 100 + 0.3 }}
          />
        </div>

        {/* Content */}
        <motion.div
          className="relative flex-1 flex flex-col justify-end pb-20 px-6 lg:px-20 max-w-[1440px] mx-auto w-full"
          variants={staggerContainer(0.12, 0.2)}
          initial="hidden"
          animate="show"
        >
          <motion.p variants={fadeUp} className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-4">
            {hero.location_label}
          </motion.p>
          <motion.h1 variants={fadeUp} className="font-display text-5xl sm:text-7xl lg:text-8xl text-white leading-[0.9] mb-6 max-w-3xl" style={{ whiteSpace: 'pre-line' }}>
            {hero.headline}
          </motion.h1>
          <motion.p variants={fadeUp} className="font-sans text-base text-white/70 max-w-md mb-10 font-light leading-relaxed">
            {hero.subheadline}
          </motion.p>

          {/* Search */}
          <motion.div variants={fadeUp} className="max-w-2xl">
            <SearchBar />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40">
          <ChevronDown className="w-5 h-5 animate-bounce-slow" />
        </div>
      </section>

      {/* ── 2. Stats strip ── */}
      <section className="bg-forest text-white">
        <motion.div
          className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10 grid grid-cols-2 md:grid-cols-4 gap-8"
          variants={staggerContainer(0.07)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          {STATS.map((s) => (
            <motion.div key={s.label} variants={staggerChild}>
              <p className="font-display text-3xl text-gold">{s.value}</p>
              <p className="font-sans text-xs text-white/40 mt-1 tracking-wide uppercase">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── 3. Categories ── */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20">
        <div className="mb-10">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">What to do</p>
          <h2 className="font-display text-4xl text-forest">Explore the Berg</h2>
        </div>
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          variants={staggerContainer(0.06)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          {CATEGORIES.map((cat) => (
            <motion.div key={cat.href} variants={staggerChild} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}>
              <Link href={cat.href} className="group relative overflow-hidden aspect-[3/4] block">
                <img
                  src={cat.img}
                  alt={cat.label}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  style={{ willChange: 'transform' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span className="absolute bottom-4 left-4 font-display text-xl text-white">{cat.label}</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
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

          <motion.div
            className="grid md:grid-cols-3 gap-6"
            variants={staggerContainer(0.08)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            {REGIONS.map((r) => (
              <motion.div key={r.href} variants={staggerChild}>
                <Link href={r.href} className="group block">
                  <div className="relative overflow-hidden aspect-[4/3] mb-4">
                    <img
                      src={r.img}
                      alt={r.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      style={{ willChange: 'transform' }}
                    />
                  </div>
                  <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{r.subtitle}</p>
                  <h3 className="font-display text-2xl text-forest mb-2">{r.name}</h3>
                  <p className="font-sans text-sm text-forest/55 leading-relaxed">{r.desc}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
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

          <motion.div
            className="grid md:grid-cols-3 gap-8"
            variants={staggerContainer(0.08)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            {STORIES.map((s) => (
              <motion.div key={s.href} variants={staggerChild} whileHover={{ y: -3 }} transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}>
                <Link href={s.href} className="group block">
                  <div className="relative overflow-hidden aspect-[3/2] mb-4">
                    <img src={s.img} alt={s.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" style={{ willChange: 'transform' }} />
                  </div>
                  <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-2">{s.tag} · {s.date}</p>
                  <h3 className="font-display text-xl text-forest leading-snug group-hover:text-sage transition-colors">{s.title}</h3>
                </Link>
              </motion.div>
            ))}
          </motion.div>
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

      {/* ── What's On: Upcoming Events ── */}
      <section className="bg-white py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">What's On</p>
              <h2 className="font-display italic text-4xl text-[#000000]">Upcoming Events & Specials</h2>
            </div>
            <Link href="/events" className="font-sans text-sm text-[#2d6a4f] hover:underline hidden md:block">See all events →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {UPCOMING_EVENTS.map(ev => (
              <Link key={ev.id} href={`/events`} className="border border-gray-200 p-5 hover:border-[#2d6a4f] transition-colors group">
                <span className={`inline-block font-sans text-[10px] tracking-[0.14em] uppercase px-2.5 py-1 mb-4 ${ev.type === 'special' ? 'bg-[#C9A96E]/20 text-[#9a7840]' : 'bg-[#2d6a4f]/10 text-[#2d6a4f]'}`}>
                  {ev.type === 'special' ? 'Special' : 'Event'}
                </span>
                <h3 className="font-display italic text-lg text-[#000000] mb-2 group-hover:text-[#2d6a4f] transition-colors">{ev.title}</h3>
                <p className="font-sans text-xs text-gray-500 mb-1">{ev.location}</p>
                <p className="font-sans text-xs text-gray-400 mb-4">{ev.date}</p>
                <p className="font-display italic text-xl text-[#2d6a4f]">R {ev.price}</p>
              </Link>
            ))}
          </div>
          <div className="mt-6 md:hidden">
            <Link href="/events" className="font-sans text-sm text-[#2d6a4f]">See all events →</Link>
          </div>
        </div>
      </section>

      {/* ── Featured Stays ── */}
      <section className="bg-[#F7F5F2] py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">Where to Sleep</p>
              <h2 className="font-display italic text-4xl text-[#000000]">Featured Stays</h2>
            </div>
            <Link href="/stays" className="font-sans text-sm text-[#2d6a4f] hover:underline hidden md:block">All accommodation →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURED_STAYS.map(stay => (
              <Link key={stay.id} href={`/stays/${stay.id}`} className="bg-white group">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={stay.img} alt={stay.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">{stay.location}</span>
                    <span className="font-sans text-xs text-[#2d6a4f]">★ {stay.rating} <span className="text-gray-400">({stay.reviews})</span></span>
                  </div>
                  <h3 className="font-display italic text-xl text-[#000000] mb-2">{stay.title}</h3>
                  <div className="flex items-center justify-between">
                    <p className="font-sans text-xs text-gray-500">{stay.rooms} rooms</p>
                    <div className="text-right">
                      <p className="font-sans text-[10px] text-gray-400">From</p>
                      <p className="font-display italic text-xl text-[#2d6a4f]">R {stay.price.toLocaleString()}<span className="font-sans text-xs text-gray-400">/night</span></p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recommended Packages ── */}
      <section className="bg-[#000000] py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">Curated Experiences</p>
              <h2 className="font-display italic text-4xl text-white">Recommended Packages</h2>
            </div>
            <Link href="/packages" className="font-sans text-sm text-[#C9A96E] hover:text-white transition-colors hidden md:block">All packages →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURED_PACKAGES.map(pkg => (
              <Link key={pkg.id} href={`/packages`} className="group flex gap-0 bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                <div className="w-48 shrink-0 overflow-hidden">
                  <img src={pkg.img} alt={pkg.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="p-6 flex flex-col justify-between">
                  <div>
                    <span className="font-sans text-[10px] tracking-[0.14em] uppercase text-[#C9A96E] mb-2 block">{pkg.duration} Days</span>
                    <h3 className="font-display italic text-2xl text-white mb-3">{pkg.title}</h3>
                    <ul className="space-y-1">
                      {pkg.includes.map(item => (
                        <li key={item} className="font-sans text-xs text-white/50 flex items-center gap-1.5">
                          <span className="text-[#C9A96E]">✓</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="font-sans text-[10px] text-white/30">From</p>
                      <p className="font-display italic text-2xl text-[#C9A96E]">R {pkg.price.toLocaleString()}</p>
                    </div>
                    <span className="font-sans text-xs text-white/60 group-hover:text-white transition-colors">View Package →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Specials & Deals ── */}
      <section className="bg-[#C9A96E]/10 py-20 border-y border-[#C9A96E]/30">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="mb-10">
            <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#9a7840] mb-2">Limited Time</p>
            <h2 className="font-display italic text-4xl text-[#000000]">Specials & Deals</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SPECIALS.map(sp => (
              <Link key={sp.id} href="/events" className="bg-white border border-[#C9A96E]/30 p-6 hover:border-[#C9A96E] transition-colors group">
                <span className="font-sans text-[10px] tracking-[0.14em] uppercase text-[#9a7840] bg-[#C9A96E]/20 px-2.5 py-1 mb-4 inline-block">Special</span>
                <h3 className="font-display italic text-xl text-[#000000] mb-1 group-hover:text-[#2d6a4f] transition-colors">{sp.title}</h3>
                <p className="font-sans text-sm text-[#2d6a4f] font-medium mb-3">{sp.offer}</p>
                <p className="font-sans text-xs text-gray-500 mb-1">{sp.location}</p>
                <p className="font-sans text-xs text-gray-400 mb-4">{sp.dates}</p>
                <div className="flex items-center justify-between">
                  <p className="font-display italic text-2xl text-[#2d6a4f]">R {sp.price}</p>
                  <span className="font-sans text-xs text-[#2d6a4f] group-hover:underline">Book →</span>
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

'use client'
import Link from 'next/link'
import { ChevronDown, Mountain, Tent, Footprints, Car, Package, Star, Instagram, Facebook, Twitter, ArrowRight } from 'lucide-react'
import SearchBar from '@/components/search/SearchBar'
import ListingGrid from '@/components/listings/ListingGrid'
import PanoramaViewer from '@/components/panorama/PanoramaViewer'
import TrailCard from '@/components/trails/TrailCard'
import type { Trail } from '@/components/trails/TrailCard'

/* ─── Category data ──────────────────────────────────────────────────────── */
const categories = [
  {
    name: 'Stays',
    href: '/stays',
    desc: 'Lodges, hotels & camping',
    image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80',
  },
  {
    name: 'Hikes',
    href: '/hikes',
    desc: 'Trails & guided walks',
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
  },
  {
    name: 'Activities',
    href: '/activities',
    desc: 'Guided tours & adventures',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
  },
  {
    name: 'Shuttles',
    href: '/shuttles',
    desc: 'Airport & regional transfers',
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80',
  },
  {
    name: 'Packages',
    href: '/packages',
    desc: 'Multi-day holiday deals',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  },
]

/* ─── Trail data ─────────────────────────────────────────────────────────── */
const featuredTrails: Trail[] = [
  {
    id: 't1',
    name: 'Tugela Falls Circuit',
    area: 'Royal Natal National Park',
    difficulty: 'hard',
    distance_km: 14,
    elevation_gain_m: 948,
    duration_hours: 7,
    rating: 4.9,
    review_count: 412,
    image: 'https://images.unsplash.com/photo-1439853949212-36589f9df9d7?w=800&q=80',
    tags: ['Waterfall', 'Views', 'Iconic'],
    is_featured: true,
  },
  {
    id: 't2',
    name: "Giant's Cup Trail",
    area: 'Southern Drakensberg',
    difficulty: 'moderate',
    distance_km: 60,
    elevation_gain_m: 1200,
    duration_hours: 32,
    rating: 4.8,
    review_count: 287,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    tags: ['Multi-day', 'Wildflowers', 'Swimming'],
  },
  {
    id: 't3',
    name: 'Injisuthi Contour Path',
    area: 'Injisuthi Reserve',
    difficulty: 'easy',
    distance_km: 9,
    elevation_gain_m: 320,
    duration_hours: 3.5,
    rating: 4.7,
    review_count: 164,
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
    tags: ['Beginner', 'Views', 'Dog-friendly'],
  },
  {
    id: 't4',
    name: 'Cathedral Peak Summit',
    area: 'Cathedral Peak Nature Reserve',
    difficulty: 'expert',
    distance_km: 18,
    elevation_gain_m: 1380,
    duration_hours: 9,
    rating: 4.95,
    review_count: 93,
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
    tags: ['Summit', 'Technical', 'Views'],
    is_featured: true,
  },
]

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <main className="bg-mist">

      {/* ── A. HERO ─────────────────────────────────────────────────────── */}
      <section
        className="relative h-screen flex flex-col overflow-hidden"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1800&q=85)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
        }}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-forest/70 via-forest/40 to-forest/80 pointer-events-none" />

        {/* Inline minimal navbar for hero (actual Navbar is in layout above this) */}
        <div className="relative z-10 hidden">
          {/* The real Navbar in layout.tsx sits above this section */}
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center">
          <p className="font-sans text-gold/90 text-sm font-medium tracking-[0.25em] uppercase mb-6 animate-fade-up">
            KwaZulu-Natal · South Africa
          </p>
          <h1
            className="font-display text-white font-bold leading-none mb-6 animate-fade-up"
            style={{ fontSize: 'clamp(52px, 8vw, 96px)', animationDelay: '0.1s' }}
          >
            Where Earth<br />
            <em className="not-italic text-gold">Meets Sky</em>
          </h1>
          <p
            className="font-sans font-light text-white/80 text-xl md:text-2xl max-w-2xl mb-12 animate-fade-up"
            style={{ animationDelay: '0.2s' }}
          >
            Discover the Drakensberg — South Africa's greatest mountain wilderness
          </p>

          {/* Search bar */}
          <div
            className="w-full max-w-5xl animate-fade-up"
            style={{ animationDelay: '0.35s' }}
          >
            <SearchBar />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="relative z-10 flex justify-center pb-8">
          <div className="flex flex-col items-center gap-2 text-white/60 animate-bounce-slow">
            <span className="font-sans text-xs tracking-widest uppercase">Scroll</span>
            <ChevronDown className="h-5 w-5" />
          </div>
        </div>
      </section>

      {/* ── B. CATEGORY STRIP ───────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold text-forest mb-3">
              Explore the Berg
            </h2>
            <p className="font-sans text-forest/50 text-lg font-light">
              Everything you need for the perfect Drakensberg escape
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                href={cat.href}
                className="group relative rounded-2xl overflow-hidden aspect-[3/4] min-w-[160px]"
              >
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest/80 via-forest/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="font-display text-xl font-bold text-white mb-0.5">{cat.name}</p>
                  <p className="font-sans text-xs text-white/70">{cat.desc}</p>
                </div>
                <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-3.5 w-3.5 text-white" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── C. PEAK VIEWER TEASER ────────────────────────────────────────── */}
      <section className="bg-forest py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-12">
            {/* Editorial text */}
            <div>
              <p className="font-sans text-gold text-sm font-medium tracking-[0.2em] uppercase mb-5">
                Interactive Panorama
              </p>
              <h2 className="font-display text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
                Identify<br />
                <em className="not-italic text-gold">Every Peak</em>
              </h2>
              <p className="font-sans text-white/60 text-lg font-light leading-relaxed mb-8">
                Our interactive panorama viewer lets you explore the Drakensberg skyline peak by peak.
                Drag across the horizon to discover named summits, their elevations, and the trails
                that lead to them — just as the pioneering mountaineers once did.
              </p>
              <Link
                href="/nature-reserves"
                className="inline-flex items-center gap-3 bg-gold text-forest font-sans font-semibold px-8 py-4 rounded-full hover:bg-brown-600 hover:text-white transition-all duration-300 shadow-gold"
              >
                Explore the Panorama
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-6">
              {[
                { number: '3 446', unit: 'm', label: 'Thabana Ntlenyana — highest peak in southern Africa' },
                { number: '12', unit: '', label: 'Named Drakensberg peaks in our interactive viewer' },
                { number: '4', unit: '', label: 'Major nature reserves with panoramic viewpoints' },
                { number: 'UNESCO', unit: '', label: 'World Heritage Site since 2000' },
              ].map((stat) => (
                <div key={stat.label} className="border border-white/10 rounded-2xl p-6">
                  <div className="font-display text-4xl font-bold text-gold mb-1">
                    {stat.number}<span className="text-2xl">{stat.unit}</span>
                  </div>
                  <p className="font-sans text-white/50 text-sm font-light leading-snug">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Panorama teaser */}
          <div className="rounded-3xl overflow-hidden border border-white/10">
            <PanoramaViewer
              spotName="Amphitheatre Viewpoint"
              latitude={-28.7522}
              longitude={28.9714}
            />
          </div>
        </div>
      </section>

      {/* ── D. FEATURED TRAILS ───────────────────────────────────────────── */}
      <section className="py-24 bg-mist">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="font-sans text-sage text-sm font-medium tracking-[0.2em] uppercase mb-3">
                AllTrails Verified
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-forest">
                Top Trails
              </h2>
            </div>
            <Link
              href="/hikes"
              className="hidden md:inline-flex items-center gap-2 font-sans text-sm font-medium text-sage hover:text-forest transition-colors"
            >
              View all trails <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Horizontal scroll container */}
          <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
            {featuredTrails.map((trail) => (
              <div key={trail.id} className="snap-start shrink-0 w-[300px] md:w-[340px]">
                <TrailCard trail={trail} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── E. STAYS GRID ────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="font-sans text-sage text-sm font-medium tracking-[0.2em] uppercase mb-3">
                Handpicked Accommodation
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-forest">
                Where to Stay
              </h2>
            </div>
            <Link
              href="/stays"
              className="hidden md:inline-flex items-center gap-2 font-sans text-sm font-medium text-sage hover:text-forest transition-colors"
            >
              View all stays <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ListingGrid featured={true} />
        </div>
      </section>

      {/* ── F. NATURE & CULTURE EDITORIAL ────────────────────────────────── */}
      <section className="py-24 bg-mist overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-3xl overflow-hidden shadow-card-hover">
            {/* Image */}
            <div className="relative aspect-[4/3] lg:aspect-auto min-h-[400px]">
              <img
                src="https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=1200&q=85"
                alt="Drakensberg UNESCO heritage landscape"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-forest/20" />
            </div>

            {/* Editorial text */}
            <div className="bg-forest px-10 py-14 lg:px-16 flex flex-col justify-center">
              <p className="font-sans text-gold text-sm font-medium tracking-[0.2em] uppercase mb-6">
                UNESCO World Heritage
              </p>
              <div className="w-12 h-0.5 bg-gold mb-6" />
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
                A Living<br />Cathedral of<br />
                <em className="not-italic text-gold">Stone & Sky</em>
              </h2>
              <p className="font-sans text-white/60 font-light leading-relaxed mb-5">
                The uKhahlamba-Drakensberg Park was inscribed as a UNESCO World Heritage Site in 2000,
                recognised for its exceptional natural beauty and outstanding universal value. The
                Drakensberg — or "Barrier of Spears" in Zulu — stretches over 1,000 kilometres,
                forming the escarpment between South Africa and Lesotho.
              </p>
              <p className="font-sans text-white/60 font-light leading-relaxed mb-8">
                Home to the San people's ancient rock art, rare Bearded Vultures, and plant species
                found nowhere else on earth, the Drakensberg is a place of profound cultural and
                ecological significance.
              </p>
              <Link
                href="/nature-reserves"
                className="inline-flex items-center gap-3 font-sans text-sm font-medium text-gold hover:text-white transition-colors group"
              >
                Explore the reserves
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── G. FOOTER ────────────────────────────────────────────────────── */}
      <footer className="bg-forest text-white">
        {/* Newsletter strip */}
        <div className="border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-14 flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h3 className="font-display text-3xl font-bold text-white mb-1">
                Stay <em className="not-italic text-gold">Connected</em>
              </h3>
              <p className="font-sans text-white/50 font-light">
                Seasonal trail updates, exclusive lodge deals, and Drakensberg stories.
              </p>
            </div>
            <form
              className="flex gap-3 w-full md:w-auto"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 md:w-72 px-5 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-gold font-sans text-sm"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-gold text-forest font-sans font-semibold text-sm rounded-full hover:bg-brown-600 hover:text-white transition-all duration-300 whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        {/* Links grid */}
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <p className="font-display text-2xl font-bold italic text-gold mb-4">
                Visit Drakensberg
              </p>
              <p className="font-sans text-white/50 font-light text-sm leading-relaxed mb-6">
                Your gateway to South Africa's most spectacular mountain wilderness.
              </p>
              <div className="flex gap-4">
                {[Instagram, Facebook, Twitter].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center hover:border-gold hover:text-gold transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Explore */}
            <div>
              <p className="font-sans text-xs font-semibold tracking-widest uppercase text-white/40 mb-5">Explore</p>
              {[
                { label: 'Stays', href: '/stays' },
                { label: 'Hikes', href: '/hikes' },
                { label: 'Activities', href: '/activities' },
                { label: 'Shuttles', href: '/shuttles' },
                { label: 'Packages', href: '/packages' },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block font-sans text-sm text-white/60 hover:text-gold transition-colors mb-2.5"
                >
                  {l.label}
                </Link>
              ))}
            </div>

            {/* Reserves */}
            <div>
              <p className="font-sans text-xs font-semibold tracking-widest uppercase text-white/40 mb-5">Reserves</p>
              {[
                { label: 'Royal Natal', href: '/nature-reserves' },
                { label: "Giant's Castle", href: '/nature-reserves' },
                { label: 'Injisuthi', href: '/nature-reserves' },
                { label: 'Cathedral Peak', href: '/nature-reserves' },
              ].map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="block font-sans text-sm text-white/60 hover:text-gold transition-colors mb-2.5"
                >
                  {l.label}
                </Link>
              ))}
            </div>

            {/* Company */}
            <div>
              <p className="font-sans text-xs font-semibold tracking-widest uppercase text-white/40 mb-5">Company</p>
              {[
                { label: 'List Property', href: '/supplier' },
                { label: 'About Us', href: '#' },
                { label: 'Contact', href: '#' },
                { label: 'Blog', href: '#' },
              ].map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="block font-sans text-sm text-white/60 hover:text-gold transition-colors mb-2.5"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Legal */}
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-sans text-xs text-white/30">
              © {new Date().getFullYear()} Visit Drakensberg. All rights reserved.
            </p>
            <div className="flex gap-6">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((t) => (
                <a key={t} href="#" className="font-sans text-xs text-white/30 hover:text-white/60 transition-colors">
                  {t}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}

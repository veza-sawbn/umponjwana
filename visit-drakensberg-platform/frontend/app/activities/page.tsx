'use client'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'

const CATEGORIES = [
  { label: 'Adventure', slug: 'adventure' },
  { label: 'Wildlife', slug: 'wildlife' },
  { label: 'Cultural', slug: 'cultural' },
  { label: 'Family', slug: 'family' },
  { label: 'Wellness', slug: 'wellness' },
]

const ACTIVITIES = [
  { id: 'a1', title: 'San Rock Art Tour', location: 'Giants Castle', category: 'Cultural', price: 380, duration: '3 h', img: 'https://images.unsplash.com/photo-1529946179074-1f3cf40c0a0e?w=800&q=80', rating: 4.9, reviews: 87 },
  { id: 'a2', title: 'Abseiling at the Amphitheatre', location: 'Royal Natal', category: 'Adventure', price: 650, duration: '4 h', img: 'https://images.unsplash.com/photo-1542587222-e14b891ee40b?w=800&q=80', rating: 4.8, reviews: 43 },
  { id: 'a3', title: 'Bearded Vulture Hide', location: 'Giants Castle GR', category: 'Wildlife', price: 290, duration: '3 h', img: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80', rating: 4.9, reviews: 61 },
  { id: 'a4', title: 'Fly-Fishing — Trout in the Berg', location: 'Champagne Valley', category: 'Adventure', price: 1200, duration: 'Full day', img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=800&q=80', rating: 4.6, reviews: 29 },
  { id: 'a5', title: 'Sani Pass 4x4 Day Tour', location: 'Sani Pass', category: 'Adventure', price: 950, duration: 'Full day', img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80', rating: 4.8, reviews: 112 },
  { id: 'a6', title: 'Horse Riding in the Foothills', location: 'Central Berg', category: 'Family', price: 480, duration: '2 h', img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80', rating: 4.5, reviews: 38 },
  { id: 'a7', title: 'Sunrise Yoga & Meditation', location: 'Champagne Valley', category: 'Wellness', price: 220, duration: '2 h', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80', rating: 4.7, reviews: 22 },
  { id: 'a8', title: 'Stargazing Experience', location: 'Northern Berg', category: 'Family', price: 300, duration: '2.5 h', img: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800&q=80', rating: 4.9, reviews: 74 },
]

export default function ActivitiesPage() {
  return (
    <main className="bg-mist min-h-screen pt-16">
      <section className="bg-forest text-white py-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-3">Things to do</p>
          <h1 className="font-display text-5xl lg:text-6xl text-white leading-none mb-4">Activities</h1>
          <p className="font-sans text-sm text-white/50">Guided experiences, tours and adventures across the Drakensberg</p>
        </div>
      </section>

      <section className="bg-white border-b border-black/8 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto flex gap-8 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button key={c.slug}
              className="font-sans text-sm text-forest/50 hover:text-forest py-4 border-b-2 border-transparent hover:border-forest transition-all whitespace-nowrap">
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <p className="font-sans text-sm text-forest/50 mb-8">
          <span className="text-forest font-medium">{ACTIVITIES.length}</span> experiences
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {ACTIVITIES.map((a) => (
            <Link key={a.id} href={`/activities/${a.id}`} className="group block">
              <div className="relative overflow-hidden aspect-square mb-4">
                <img src={a.img} alt={a.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <span className="absolute top-3 left-3 font-sans text-[10px] tracking-[0.1em] uppercase bg-white/90 text-forest px-2.5 py-1">
                  {a.category}
                </span>
              </div>
              <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{a.location} · {a.duration}</p>
              <h3 className="font-display text-lg text-forest leading-snug mb-2 group-hover:text-sage transition-colors">{a.title}</h3>
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs text-forest/40">★ {a.rating} ({a.reviews})</span>
                <span className="font-display text-base text-forest">R{a.price.toLocaleString()}<span className="font-sans text-xs text-forest/40"> /p</span></span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </main>
  )
}

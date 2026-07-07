'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { getPublishedPackages } from '@/lib/packages'

type PackageCard = {
  id: string
  title: string
  duration: string
  price: number
  originalPrice?: number
  location: string
  img: string
  includes: string[]
  tag?: string
  rating?: number
  reviews?: number
}

const PACKAGES: PackageCard[] = [
  {
    id: 'p1',
    title: 'Amphitheatre Weekend Escape',
    duration: '3 nights',
    price: 4200,
    originalPrice: 5100,
    location: 'Royal Natal',
    img: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=900&q=80',
    includes: ['3 nights accommodation', 'Daily breakfast', 'Tugela Falls guided hike', 'San rock art tour'],
    tag: 'Best Seller',
    rating: 4.9,
    reviews: 54,
  },
  {
    id: 'p2',
    title: 'Central Berg Family Adventure',
    duration: '5 nights',
    price: 8900,
    location: 'Cathedral Peak',
    img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=900&q=80',
    includes: ['5 nights family cottage', 'All meals', 'Horse riding', 'Nature walks', 'Rock art excursion'],
    rating: 4.7,
    reviews: 28,
  },
  {
    id: 'p3',
    title: 'Sani Pass & Southern Berg Explorer',
    duration: '4 nights',
    price: 6600,
    location: 'Underberg',
    img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=80',
    includes: ['4 nights lodge', 'Sani Pass 4x4 tour', 'Mountain bike day', 'Fly-fishing half day'],
    tag: 'New',
    rating: 4.8,
    reviews: 16,
  },
  {
    id: 'p4',
    title: 'Grand Berg Traverse — 7 Days',
    duration: '7 nights',
    price: 18500,
    location: 'Northern to Southern Berg',
    img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&q=80',
    includes: ['7 nights premium accommodation', 'All meals', 'Private guide', 'All park fees', 'Transfers'],
    tag: 'Premium',
    rating: 5.0,
    reviews: 9,
  },
]

export default function PackagesPage() {
  const [cards, setCards] = useState<PackageCard[]>(PACKAGES)

  // Live admin-curated marketplace packages appear ahead of the showcase set.
  useEffect(() => {
    getPublishedPackages().then(live => {
      if (live.length === 0) return
      const liveCards: PackageCard[] = live.map(p => ({
        id: p.id,
        title: p.title,
        duration: `${p.durationNights} night${p.durationNights !== 1 ? 's' : ''}`,
        price: p.pricePerPerson,
        originalPrice: p.originalPrice,
        location: p.region || 'Drakensberg',
        img: p.image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=80',
        includes: p.components.map(c => c.title).filter(Boolean).slice(0, 5),
        tag: p.featured ? (p.tag || 'Featured') : p.tag || undefined,
      }))
      setCards([...liveCards, ...PACKAGES])
    })
  }, [])

  return (
    <main className="bg-mist min-h-screen pt-16">
      {/* Header */}
      <section className="bg-forest text-white py-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-3">Curated journeys</p>
          <h1 className="font-display text-5xl lg:text-6xl text-white leading-none mb-4">Packages</h1>
          <p className="font-sans text-sm text-white/50">Complete Drakensberg experiences — stay, eat, explore, guided</p>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="grid lg:grid-cols-2 gap-8">
          {cards.map((p) => (
            <Link key={p.id} href={`/packages/${p.id}`} className="group bg-white border border-black/8 block hover:border-forest/30 transition-colors">
              <div className="relative overflow-hidden aspect-[16/9]">
                <img src={p.img} alt={p.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-104" />
                {p.tag && (
                  <span className="absolute top-4 left-4 font-sans text-[10px] tracking-[0.15em] uppercase bg-gold text-forest px-3 py-1">
                    {p.tag}
                  </span>
                )}
                {p.originalPrice && (
                  <span className="absolute top-4 right-4 font-sans text-xs bg-forest text-white px-2.5 py-1">
                    Save R{(p.originalPrice - p.price).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="p-7">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{p.location} · {p.duration}</p>
                    <h3 className="font-display text-2xl text-forest group-hover:text-sage transition-colors">{p.title}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    {p.originalPrice && (
                      <p className="font-sans text-xs text-forest/30 line-through">R{p.originalPrice.toLocaleString()}</p>
                    )}
                    <p className="font-display text-2xl text-forest">R{p.price.toLocaleString()}</p>
                    <p className="font-sans text-xs text-forest/40">per person</p>
                  </div>
                </div>

                <ul className="space-y-1.5 mb-5">
                  {p.includes.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 font-sans text-xs text-forest/60">
                      <span className="w-1 h-1 rounded-full bg-gold shrink-0" />{item}
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between border-t border-black/6 pt-4">
                  <span className="font-sans text-xs text-forest/40">{p.rating ? `★ ${p.rating} (${p.reviews} reviews)` : 'Curated by Visit Drakensberg'}</span>
                  <span className="font-sans text-sm text-forest group-hover:text-gold transition-colors inline-flex items-center gap-1.5">
                    View package <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </main>
  )
}

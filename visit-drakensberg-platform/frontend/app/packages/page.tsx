'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { getPublishedPackages, PACKAGE_CATEGORIES, PACKAGE_CATEGORY_LABELS, type PackageCategory } from '@/lib/packages'

// Filter tabs mirror the vocabulary curated in the Package Builder
// (/admin/packages) — see lib/packages.ts PACKAGE_CATEGORIES.
const TABS: { label: string; slug: PackageCategory | '' }[] = [
  { label: 'All', slug: '' },
  ...PACKAGE_CATEGORIES.map(c => ({ label: PACKAGE_CATEGORY_LABELS[c], slug: c })),
]

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
  categories: PackageCategory[]
}

export default function PackagesPage() {
  const [cards, setCards] = useState<PackageCard[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<PackageCategory | ''>('')

  useEffect(() => {
    getPublishedPackages().then(live => {
      setCards(live.map(p => ({
        id: p.id,
        title: p.title,
        duration: `${p.durationNights} night${p.durationNights !== 1 ? 's' : ''}`,
        price: p.pricePerPerson,
        originalPrice: p.originalPrice,
        location: p.region || 'Drakensberg',
        img: p.image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&q=80',
        includes: p.components.map(c => c.title).filter(Boolean).slice(0, 5),
        tag: p.featured ? (p.tag || 'Featured') : p.tag || undefined,
        categories: p.categories ?? [],
      })))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = cards.filter(c => !category || c.categories.includes(category))

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

      <section className="bg-white border-b border-black/8 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto flex gap-8 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.slug || 'all'}
              onClick={() => setCategory(t.slug)}
              className={`font-sans text-sm py-4 border-b-2 transition-all whitespace-nowrap ${
                category === t.slug
                  ? 'text-forest border-forest'
                  : 'text-forest/50 border-transparent hover:text-forest hover:border-forest'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        {!loading && cards.length === 0 && (
          <p className="font-sans text-sm text-forest/40 py-16 text-center">No packages published yet — check back soon.</p>
        )}
        {!loading && cards.length > 0 && filtered.length === 0 && (
          <p className="font-sans text-sm text-forest/40 py-16 text-center">No packages in {TABS.find(t => t.slug === category)?.label} yet — try another category.</p>
        )}
        <div className="grid lg:grid-cols-2 gap-8">
          {filtered.map((p) => (
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

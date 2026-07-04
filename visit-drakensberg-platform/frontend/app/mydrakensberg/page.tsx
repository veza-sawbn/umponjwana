'use client'

import { useState } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import { Clock, ArrowRight } from 'lucide-react'

const CATEGORIES = ['All', 'Culture', 'Heritage', 'Wildlife', 'Cuisine', 'Hiking Stories', 'History', 'Conservation']

const ARTICLES = [
  {
    slug: 'san-bushmen-rock-art-giants-castle',
    title: "The Ancient Language of the San: Rock Art at Giant's Castle",
    excerpt: "Over 5,000 individual paintings document the spiritual world of the San Bushmen who once called the Drakensberg home. Walking through the Main Caves at Giant's Castle is a journey into one of the world's oldest artistic traditions.",
    category: 'Heritage',
    author: 'Lerato Sithole',
    authorRole: 'Heritage Guide & Historian',
    readTime: '8 min',
    image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=900&q=80',
    featured: true,
  },
  {
    slug: 'tugela-falls-chain-ladder-guide',
    title: 'Climbing the Chain Ladder: What Nobody Tells You',
    excerpt: "The iconic iron rungs fixed into the sheer basalt face of the Amphitheatre. An honest account of what to expect — the exposure, the wind, and the view that makes it all worth it.",
    category: 'Hiking Stories',
    author: 'Sipho Dlamini',
    authorRole: 'FGASA Mountain Guide',
    readTime: '6 min',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=700&q=80',
    featured: false,
  },
  {
    slug: 'bearded-vulture-lammergeier',
    title: "Africa's Rarest Raptor: The Bearded Vulture of the Berg",
    excerpt: "The lammergeier — bone-breaker — is one of the most extraordinary birds on the planet. The Drakensberg is its last South African stronghold. Here is how to find one.",
    category: 'Wildlife',
    author: 'Anele Mokoena',
    authorRole: 'Birding & Flora Specialist',
    readTime: '5 min',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=700&q=80',
    featured: false,
  },
  {
    slug: 'zulu-cuisine-foothills',
    title: 'Eating in the Foothills: A Guide to Zulu Cuisine',
    excerpt: "Umngqusho. Amasi. Inyama yenkukhu. The villages that border the Berg offer an authentic culinary encounter that most visitors miss entirely. A food lover's guide to eating locally.",
    category: 'Cuisine',
    author: 'Nomvula Khumalo',
    authorRole: 'Food Writer & Cultural Guide',
    readTime: '7 min',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=700&q=80',
    featured: false,
  },
  {
    slug: 'battle-of-isandlwana-history',
    title: "Shadow of the Berg: The Anglo-Zulu War's Hidden History",
    excerpt: "The foothills of the Drakensberg witnessed some of the most decisive battles in South African history. From Isandlwana to Rorke's Drift, this is a landscape written in conflict.",
    category: 'History',
    author: 'Prof. J. van der Berg',
    authorRole: 'Historian & Author',
    readTime: '12 min',
    image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=700&q=80',
    featured: false,
  },
  {
    slug: 'conservation-umdoni-wetlands',
    title: 'Saving the Umdoni Wetlands: Conservation at the Edge',
    excerpt: "Ezemvelo KZN Wildlife rangers work daily to protect the high-altitude wetlands that feed the rivers of the escarpment. A story of climate resilience and community partnership.",
    category: 'Conservation',
    author: 'Dr. Thabo Ndlovu',
    authorRole: 'Conservation Ecologist',
    readTime: '9 min',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=700&q=80',
    featured: false,
  },
]

export default function MyDrakensbergPage() {
  const [activeCategory, setActiveCategory] = useState('All')

  const filtered = activeCategory === 'All' ? ARTICLES : ARTICLES.filter(a => a.category === activeCategory)
  const featured = ARTICLES.find(a => a.featured)
  const grid = filtered.filter(a => !a.featured || activeCategory !== 'All')

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      {/* Hero */}
      <section className="bg-[#000000] text-white pt-32 pb-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-4 block">MyDrakensberg</span>
          <h1 className="font-display italic text-6xl lg:text-8xl mb-6 max-w-3xl">Stories from the Berg</h1>
          <p className="font-sans text-lg text-white/50 max-w-xl leading-relaxed">
            In-depth writing on the culture, history, wildlife and landscapes of the Drakensberg — from guides, historians, naturalists and storytellers who know the Berg deeply.
          </p>
        </div>
      </section>

      {/* Category filter */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-30">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="flex gap-0 overflow-x-auto">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`px-5 py-4 font-sans text-sm whitespace-nowrap border-b-2 transition-colors ${
                  activeCategory === c
                    ? 'border-[#2d6a4f] text-[#2d6a4f]'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        {/* Featured article */}
        {activeCategory === 'All' && featured && (
          <Link href={`/mydrakensberg/${featured.slug}`} className="group block mb-14">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 overflow-hidden border border-gray-200">
              <div className="lg:col-span-3 h-64 lg:h-auto overflow-hidden">
                <img src={featured.image} alt={featured.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="lg:col-span-2 bg-[#000000] text-white p-8 lg:p-10 flex flex-col justify-between">
                <div>
                  <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] block mb-4">Featured · {featured.category}</span>
                  <h2 className="font-display italic text-3xl lg:text-4xl mb-4 leading-tight group-hover:text-[#C9A96E] transition-colors">{featured.title}</h2>
                  <p className="font-sans text-sm text-white/50 leading-relaxed">{featured.excerpt}</p>
                </div>
                <div className="flex items-center justify-between mt-8">
                  <div>
                    <p className="font-sans text-sm text-white">{featured.author}</p>
                    <p className="font-sans text-xs text-white/40">{featured.authorRole}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[#C9A96E]">
                    <span className="font-sans text-xs flex items-center gap-1"><Clock size={11} />{featured.readTime}</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Article grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {grid.map(article => (
            <Link key={article.slug} href={`/mydrakensberg/${article.slug}`} className="group bg-white border border-gray-200 overflow-hidden hover:border-[#2d6a4f] transition-colors">
              <div className="h-52 overflow-hidden">
                <img loading="lazy" decoding="async" src={article.image} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-6">
                <span className="font-sans text-[10px] tracking-[0.14em] uppercase text-[#C9A96E] mb-3 block">{article.category}</span>
                <h3 className="font-display italic text-xl text-[#000000] mb-3 leading-tight group-hover:text-[#2d6a4f] transition-colors">{article.title}</h3>
                <p className="font-sans text-sm text-gray-500 leading-relaxed line-clamp-3">{article.excerpt}</p>
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                  <div>
                    <p className="font-sans text-xs font-medium text-gray-700">{article.author}</p>
                    <p className="font-sans text-xs text-gray-400">{article.authorRole}</p>
                  </div>
                  <span className="font-sans text-xs text-gray-400 flex items-center gap-1"><Clock size={10} />{article.readTime}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}

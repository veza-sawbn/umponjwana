'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import Editable from '@/components/editor/Editable'
import { useSiteSection } from '@/lib/use-site-section'
import { Clock, ArrowRight, Loader2 } from 'lucide-react'
import { getPublishedPosts, estimateReadTime, type BlogPost } from '@/lib/blog-posts'

const CATEGORIES = ['All', 'Culture', 'Heritage', 'Wildlife', 'Cuisine', 'Hiking Stories', 'History', 'Conservation']

type Article = {
  slug: string
  title: string
  excerpt: string
  category: string
  author: string
  authorRole: string
  readTime: string
  image: string
}

function toArticle(post: BlogPost): Article {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? '',
    category: post.category ?? '',
    author: post.author_name ?? '',
    authorRole: post.author_role ?? '',
    readTime: estimateReadTime(post.body),
    image: post.featured_image ?? '',
  }
}

export default function MyDrakensbergPage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const c = useSiteSection('stories_page')

  useEffect(() => {
    let cancelled = false
    getPublishedPosts()
      .then(rows => { if (!cancelled) setPosts(rows) })
      .catch(() => { if (!cancelled) setPosts([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const articles = useMemo(() => posts.map(toArticle), [posts])
  // Most recent published post leads the page as the featured story — only
  // while browsing "All"; a category filter shows every matching post in the grid.
  const featured = activeCategory === 'All' ? articles[0] : undefined
  const filtered = activeCategory === 'All'
    ? articles.slice(1)
    : articles.filter(a => a.category === activeCategory)

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      {/* Hero */}
      <section className="bg-[#000000] text-white pt-32 pb-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <Editable section="stories_page" fieldKey="eyebrow" value={c.eyebrow} label="Eyebrow" type="text">
            <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-4 block">{c.eyebrow}</span>
          </Editable>
          <Editable section="stories_page" fieldKey="heading" value={c.heading} label="Heading" type="text">
            <h1 className="font-display italic text-6xl lg:text-8xl mb-6 max-w-3xl">{c.heading}</h1>
          </Editable>
          <Editable section="stories_page" fieldKey="subheading" value={c.subheading} label="Subheading" type="textarea">
            <p className="font-sans text-lg text-white/50 max-w-xl leading-relaxed">
              {c.subheading}
            </p>
          </Editable>
        </div>
      </section>

      {/* Category filter */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-30">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="flex gap-0 overflow-x-auto">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-4 font-sans text-sm whitespace-nowrap border-b-2 transition-colors ${
                  activeCategory === cat
                    ? 'border-[#2d6a4f] text-[#2d6a4f]'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-gray-400 font-sans text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading stories…
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-24 font-sans text-sm text-gray-400">
            No stories published yet. Check back soon.
          </div>
        ) : (
          <>
            {/* Featured article */}
            {featured && (
              <Link href={`/mydrakensberg/${featured.slug}`} className="group block mb-14">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 overflow-hidden border border-gray-200">
                  <div className="lg:col-span-3 h-64 lg:h-auto overflow-hidden bg-gray-100">
                    {featured.image && (
                      <img src={featured.image} alt={featured.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    )}
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
            {filtered.length === 0 ? (
              <div className="text-center py-16 font-sans text-sm text-gray-400">
                No stories in this category yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(article => (
                  <Link key={article.slug} href={`/mydrakensberg/${article.slug}`} className="group bg-white border border-gray-200 overflow-hidden hover:border-[#2d6a4f] transition-colors">
                    <div className="h-52 overflow-hidden bg-gray-100">
                      {article.image && (
                        <img loading="lazy" decoding="async" src={article.image} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      )}
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
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}

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
import { useEditMode } from '@/lib/edit-mode-context'
import Editable from '@/components/editor/Editable'
import { getTrails, type Trail } from '@/lib/trails'

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
    name: 'North Berg',
    subtitle: 'Royal Natal · Bergville · Amphitheatre',
    desc: 'Home to the iconic Amphitheatre and Tugela Falls — the second highest waterfall in the world. Gateway town: Bergville.',
    img: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=900&q=80',
    href: '/regions#northern',
  },
  {
    name: 'Central Berg',
    subtitle: 'Cathedral Peak · Winterton · Champagne Valley',
    desc: 'Alpine meadows, the richest San rock art in the world and dramatic escarpment views stretching to Lesotho. Gateway town: Winterton.',
    img: 'https://images.unsplash.com/photo-1542587222-e14b891ee40b?w=900&q=80',
    href: '/regions#central',
  },
  {
    name: 'South Berg',
    subtitle: 'Sani Pass · Underberg · Himeville',
    desc: 'The legendary Sani Pass climbs to Lesotho through a raw mountain landscape. Boutique villages Himeville and Underberg sit at its foot.',
    img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=900&q=80',
    href: '/regions#southern',
  },
]

const DIFF_COLOR: Record<string, string> = {
  Easy: '#4A7251',
  Moderate: '#C9A96E',
  Strenuous: '#c0392b',
  Hard: '#c0392b',
}

/* ─── Edit-mode hero ─────────────────────────────────────────────────────────── */

function HeroSection({ hero }: { hero: typeof SITE_CONTENT_DEFAULTS.hero }) {
  const editMode = useEditMode()
  const headline = editMode?.getValue('hero', 'headline', hero.headline) ?? hero.headline
  const subheadline = editMode?.getValue('hero', 'subheadline', hero.subheadline) ?? hero.subheadline
  const locationLabel = editMode?.getValue('hero', 'location_label', hero.location_label) ?? hero.location_label
  const imageUrl = String(editMode?.getValue('hero', 'image_url', hero.image_url) ?? hero.image_url)
  const overlayOpacity = Number(editMode?.getValue('hero', 'overlay_opacity', hero.overlay_opacity) ?? hero.overlay_opacity)

  return (
    <section className="relative h-screen min-h-[600px] flex flex-col">
      <div className="absolute inset-0">
        {hero.video_url ? (
          <video src={hero.video_url} autoPlay muted loop playsInline className="w-full h-full object-cover" />
        ) : (
          <Editable section="hero" fieldKey="image_url" value={imageUrl} label="Background Image" type="image">
            <img src={imageUrl} alt="Drakensberg mountains" className="w-full h-full object-cover" />
          </Editable>
        )}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/60"
          style={{ opacity: overlayOpacity / 100 + 0.3 }}
        />
      </div>

      <motion.div
        className="relative flex-1 flex flex-col justify-end pb-20 pt-32 lg:pt-0 px-6 lg:px-20 max-w-[1440px] mx-auto w-full"
        variants={staggerContainer(0.12, 0.2)}
        initial="hidden"
        animate="show"
      >
        <Editable section="hero" fieldKey="location_label" value={locationLabel} label="Location Label" type="text">
          <motion.p variants={fadeUp} className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-4">
            {locationLabel}
          </motion.p>
        </Editable>
        <Editable section="hero" fieldKey="headline" value={headline} label="Headline" type="textarea">
          <motion.h1 variants={fadeUp} className="font-display text-4xl sm:text-7xl lg:text-8xl text-white leading-[0.9] mb-6 max-w-3xl" style={{ whiteSpace: 'pre-line' }}>
            {headline}
          </motion.h1>
        </Editable>
        <Editable section="hero" fieldKey="subheadline" value={subheadline} label="Subheadline" type="textarea">
          <motion.p variants={fadeUp} className="font-sans text-base text-white/70 max-w-md mb-10 font-light leading-relaxed">
            {subheadline}
          </motion.p>
        </Editable>
        <motion.div variants={fadeUp} className="max-w-2xl">
          <SearchBar />
        </motion.div>
      </motion.div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40">
        <ChevronDown className="w-5 h-5 animate-bounce-slow" />
      </div>
    </section>
  )
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [hero, setHero] = useState(SITE_CONTENT_DEFAULTS.hero)
  const [promos, setPromos] = useState(SITE_CONTENT_DEFAULTS.promotions)
  const [promoBannerDismissed, setPromoBannerDismissed] = useState(false)
  const [trails, setTrails] = useState<Trail[]>([])

  useEffect(() => {
    getAllSiteContent().then(content => {
      setHero(content.hero)
      setPromos(content.promotions)
    })
    getTrails().then(all => setTrails(all.filter(t => t.status === 'published').slice(0, 4)))
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
      <HeroSection hero={hero} />

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

          {trails.length === 0 ? (
            <p className="font-sans text-sm text-white/30 py-8">Trails will appear here once published.</p>
          ) : (
            <div className="divide-y divide-white/10">
              {trails.map((t, i) => (
                <Link key={t.id} href={`/hikes/${t.id}`} className="group flex items-center justify-between py-5 hover:pl-2 transition-all duration-200">
                  <div className="flex items-center gap-6">
                    <span className="font-sans text-2xl text-white/15 font-light tabular-nums w-8">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h3 className="font-display text-lg text-white group-hover:text-gold transition-colors">{t.name}</h3>
                      <p className="font-sans text-xs text-white/35 mt-0.5">{t.distance} · {t.elevation} · {t.duration}</p>
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
          )}
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

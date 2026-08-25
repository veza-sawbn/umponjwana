'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowRight, ChevronDown, X } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { publicSupabase } from '@/lib/supabase-public'
import { motion, AnimatePresence } from 'framer-motion'
import SearchBar from '@/components/search/SearchBar'
import Footer from '@/components/layout/Footer'
import { getAllSiteContent, SITE_CONTENT_DEFAULTS, type HomeCard } from '@/lib/site-content'
import { useSiteSection } from '@/lib/use-site-section'
import { staggerContainer, staggerChild, fadeUp } from '@/lib/motion'
import { useEditMode } from '@/lib/edit-mode-context'
import Editable from '@/components/editor/Editable'
import EditableSection from '@/components/editor/EditableSection'
import EditableCard from '@/components/editor/EditableCard'
import { getTrails, type Trail } from '@/lib/trails'
import { getUpcomingExperiences, type TrekkingExperience } from '@/lib/experiences'
import { getSupplierEntities } from '@/lib/supplier-entities'
import { getActivities, type Activity } from '@/lib/activities'
import { trackEvent, AnalyticsEvent } from '@/lib/analytics'
import { getPublishedPosts, type BlogPost } from '@/lib/blog-posts'

/* ─── Data ─────────────────────────────────────────────────────────────────── */

const DIFF_COLOR: Record<string, string> = {
  Easy: '#4A7251',
  Moderate: '#C9A96E',
  Strenuous: '#c0392b',
  Hard: '#c0392b',
}

type PublicEvent = {
  id: string
  supplierId: string
  title: string
  event_type: 'event' | 'special'
  location: string
  starts_at: string
  ends_at?: string
  ticket_price: number
  is_published: boolean
}

// No image field exists on the real supplier event record — a colour stands
// in for a fake photo, same treatment as the full /events listing.
const EVENT_TYPE_BG: Record<PublicEvent['event_type'], string> = {
  event: '#1a1a2e',
  special: '#2d6a4f',
}

type MiniListItemData = {
  id: string
  href: string
  title: string
  meta: string
  badgeLabel: string
  badgeColor: string
  img?: string
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

/** Hidden cards render dimmed inside the editor and not at all on the live site. */
function useVisibleCards(cards: HomeCard[], inEditor: boolean) {
  return inEditor ? cards : cards.filter(c => c.visible !== false)
}

function cardDimClass(card: HomeCard, inEditor: boolean) {
  return inEditor && card.visible === false ? 'opacity-35' : ''
}

/* ─── Hero ───────────────────────────────────────────────────────────────────── */

const HERO_SLIDE_SECONDS = 7
const HERO_FADE_SECONDS = 1.5
const HERO_OVERSCALE = 1.12

function HeroCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0)
  const hasCycledRef = useRef(false)

  useEffect(() => {
    setIndex(0)
    hasCycledRef.current = false
    images.forEach(src => { const img = new window.Image(); img.src = src })
    if (images.length < 2) return
    const id = setInterval(() => {
      hasCycledRef.current = true
      setIndex(i => (i + 1) % images.length)
    }, HERO_SLIDE_SECONDS * 1000)
    return () => clearInterval(id)
  }, [images])

  const panFromLeft = index % 2 === 0
  const isFirstSlide = !hasCycledRef.current

  return (
    <AnimatePresence>
      <motion.div
        key={index}
        className="absolute inset-0 overflow-hidden"
        initial={{ opacity: isFirstSlide ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: HERO_FADE_SECONDS, ease: 'easeInOut' }}
      >
        <motion.img
          src={images[index]}
          alt="Drakensberg mountains"
          className="w-full h-full object-cover"
          fetchPriority={isFirstSlide ? 'high' : 'auto'}
          loading="eager"
          initial={{ scale: HERO_OVERSCALE, x: panFromLeft ? '-3%' : '3%', y: '-2%' }}
          animate={{ scale: HERO_OVERSCALE, x: panFromLeft ? '3%' : '-3%', y: '2%' }}
          transition={{ duration: HERO_SLIDE_SECONDS + HERO_FADE_SECONDS, ease: 'linear' }}
        />
      </motion.div>
    </AnimatePresence>
  )
}

function HeroSection({ hero }: { hero: typeof SITE_CONTENT_DEFAULTS.hero }) {
  const editMode = useEditMode()
  const headline = editMode?.getValue('hero', 'headline', hero.headline) ?? hero.headline
  const subheadline = editMode?.getValue('hero', 'subheadline', hero.subheadline) ?? hero.subheadline
  const locationLabel = editMode?.getValue('hero', 'location_label', hero.location_label) ?? hero.location_label
  const imageUrl = String(editMode?.getValue('hero', 'image_url', hero.image_url) ?? hero.image_url)
  const carouselImages = (editMode?.getValue('hero', 'images', hero.images) ?? hero.images) as string[]
  const overlayOpacity = Number(editMode?.getValue('hero', 'overlay_opacity', hero.overlay_opacity) ?? hero.overlay_opacity)

  return (
    <EditableSection id="hero" label="Hero" className="relative h-screen min-h-[600px] flex flex-col">
      <div className="absolute inset-0 bg-slate-900">
        {hero.video_url ? (
          <video src={hero.video_url} autoPlay muted loop playsInline className="w-full h-full object-cover" />
        ) : carouselImages.length > 1 ? (
          <HeroCarousel images={carouselImages} />
        ) : (
          <Editable section="hero" fieldKey="image_url" value={imageUrl} label="Background Image" type="image">
            <img
              src={imageUrl}
              alt="Drakensberg mountains"
              className="w-full h-full object-cover"
              fetchPriority="high"
              loading="eager"
            />
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
        <motion.div variants={fadeUp} className="w-full">
          <SearchBar />
        </motion.div>
      </motion.div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40">
        <ChevronDown className="w-5 h-5 animate-bounce-slow" />
      </div>
    </EditableSection>
  )
}

/* ─── Events & Experiences columns ──────────────────────────────────────────── */

function MiniListItem({ item }: { item: MiniListItemData }) {
  return (
    <Link href={item.href} className="group flex items-center gap-4 py-4 border-b border-black/6 last:border-0">
      <div className="w-16 h-16 shrink-0 overflow-hidden bg-mist">
        {item.img ? (
          <img loading="lazy" decoding="async" src={item.img} alt={item.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full" style={{ background: item.badgeColor }} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[10px] tracking-[0.12em] uppercase mb-0.5" style={{ color: item.badgeColor }}>{item.badgeLabel}</p>
        <h4 className="font-display text-lg text-forest leading-snug truncate group-hover:text-sage transition-colors">{item.title}</h4>
        <p className="font-sans text-xs text-forest/40 mt-0.5">{item.meta}</p>
      </div>
    </Link>
  )
}

function ExperienceColumn({ title, viewAllHref, items, emptyText }: { title: string; viewAllHref: string; items: MiniListItemData[]; emptyText: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-xl text-forest">{title}</h3>
        <Link href={viewAllHref} className="font-sans text-xs text-forest/40 hover:text-forest transition-colors flex items-center gap-1 whitespace-nowrap">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="font-sans text-sm text-forest/35 py-6">{emptyText}</p>
      ) : (
        <div>{items.map(item => <MiniListItem key={item.id} item={item} />)}</div>
      )}
    </div>
  )
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [hero, setHero] = useState(SITE_CONTENT_DEFAULTS.hero)
  const [promos, setPromos] = useState(SITE_CONTENT_DEFAULTS.promotions)
  const hs = useSiteSection('home_sections') as unknown as Record<string, string>
  const cards = useSiteSection('home_cards')
  const layout = useSiteSection('home_layout')
  const editMode = useEditMode()
  const inEditor = Boolean(editMode)
  const [promoBannerDismissed, setPromoBannerDismissed] = useState(false)
  const [trails, setTrails] = useState<Trail[]>([])
  const [scheduledHikes, setScheduledHikes] = useState<TrekkingExperience[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<PublicEvent[]>([])
  const [featuredActivities, setFeaturedActivities] = useState<Activity[]>([])
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [stories, setStories] = useState<BlogPost[]>([])

  const trailImageById = useMemo(() => new Map(trails.map(t => [t.id, t.image])), [trails])

  const categories = useVisibleCards(cards.categories ?? [], inEditor)
  const regions = useVisibleCards(cards.regions ?? [], inEditor)

  async function subscribeNewsletter(e: React.FormEvent) {
    e.preventDefault()
    const email = newsletterEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address.')
      return
    }
    setSubscribing(true)
    try {
      const { error } = await supabase.from('vd_newsletter_subscribers').insert({ email })
      // 23505 = already subscribed; treat as success.
      if (error && error.code !== '23505') throw error
      // Record explicit marketing consent (§22) and the funnel event (§3) —
      // best-effort, never blocks the subscribe confirmation the visitor sees.
      supabase.rpc('vd_set_consent', {
        p_email: email, p_consent_type: 'marketing_email', p_granted: true, p_source: 'newsletter_footer',
      }).then(({ error: consentError }) => { if (consentError) console.error('[newsletter] consent record failed:', consentError) })
      trackEvent(AnalyticsEvent.NEWSLETTER_SIGNUP, { source: 'home_footer' })
      toast.success('You’re on the list — see you in the next dispatch.')
      setNewsletterEmail('')
    } catch {
      toast.error('Subscription failed. Please try again later.')
    } finally {
      setSubscribing(false)
    }
  }

  useEffect(() => {
    getAllSiteContent().then(content => {
      setHero(content.hero)
      setPromos(content.promotions)
    })
    // Public, session-less client for all of the below: this is anonymous
    // catalogue data every visitor sees, and it must not depend on the
    // visitor's (possibly stale/broken) auth session — see lib/supabase-public.ts.
    getTrails(publicSupabase)
      .then(all => setTrails(all.filter(t => t.status === 'published')))
      .catch(() => setTrails([]))
    getUpcomingExperiences(publicSupabase)
      .then(exps => setScheduledHikes(exps.slice(0, 3)))
      .catch(() => setScheduledHikes([]))
    getSupplierEntities<any>('events', undefined, publicSupabase)
      .then((all: PublicEvent[]) => {
        const now = new Date().toISOString()
        setUpcomingEvents(
          all
            .filter(e => e.is_published && (e.ends_at || e.starts_at) >= now)
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
            .slice(0, 3),
        )
      })
      .catch(() => setUpcomingEvents([]))
    getActivities(publicSupabase)
      .then(all => setFeaturedActivities(all.filter(a => a.status === 'active').slice(0, 3)))
      .catch(() => setFeaturedActivities([]))
    getPublishedPosts()
      .then(posts => setStories(posts.slice(0, 3)))
      .catch(() => setStories([]))
  }, [])

  /* ── Reorderable sections ── */

  const statsSection = (
    <EditableSection key="stats" id="stats" label="Stats Strip" className="bg-forest text-white">
      <motion.div
        className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10 grid grid-cols-2 md:grid-cols-4 gap-8"
        variants={staggerContainer(0.07)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
      >
        {[1, 2, 3, 4].map((i) => (
          <motion.div key={i} variants={staggerChild}>
            <Editable section="home_sections" fieldKey={`stat_${i}_value`} value={hs[`stat_${i}_value`]} label={`Stat ${i} Value`} type="text">
              <p className="font-display text-3xl text-gold">{hs[`stat_${i}_value`]}</p>
            </Editable>
            <Editable section="home_sections" fieldKey={`stat_${i}_label`} value={hs[`stat_${i}_label`]} label={`Stat ${i} Label`} type="text">
              <p className="font-sans text-xs text-white/40 mt-1 tracking-wide uppercase">{hs[`stat_${i}_label`]}</p>
            </Editable>
          </motion.div>
        ))}
      </motion.div>
    </EditableSection>
  )

  const categoriesSection = (
    <EditableSection key="categories" id="categories" label="Categories" className="bg-mist">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20">
        <div className="mb-10">
          <Editable section="home_sections" fieldKey="categories_eyebrow" value={hs.categories_eyebrow} label="Categories Eyebrow" type="text">
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">{hs.categories_eyebrow}</p>
          </Editable>
          <Editable section="home_sections" fieldKey="categories_heading" value={hs.categories_heading} label="Categories Heading" type="text">
            <h2 className="font-display text-4xl text-forest">{hs.categories_heading}</h2>
          </Editable>
        </div>
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          variants={staggerContainer(0.06)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          {categories.map((cat, index) => (
            <motion.div key={cat.id} variants={staggerChild} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }} className={cardDimClass(cat, inEditor)}>
              <EditableCard contentKey="home_cards" fieldKey="categories" index={index} label={String(cat.label ?? 'Category Card')}>
                <Link href={String(cat.href || '/')} className="group relative overflow-hidden aspect-[3/4] block">
                  <img loading="lazy" decoding="async"
                    src={String(cat.img)}
                    alt={String(cat.label)}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ willChange: 'transform' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <span className="absolute bottom-4 left-4 font-display text-xl text-white">{cat.label}</span>
                </Link>
              </EditableCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </EditableSection>
  )

  const regionsSection = (
    <EditableSection key="regions" id="regions" label="Regions" className="bg-white">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <Editable section="home_sections" fieldKey="regions_eyebrow" value={hs.regions_eyebrow} label="Regions Eyebrow" type="text">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">{hs.regions_eyebrow}</p>
            </Editable>
            <Editable section="home_sections" fieldKey="regions_heading" value={hs.regions_heading} label="Regions Heading" type="text">
              <h2 className="font-display text-4xl text-forest">{hs.regions_heading}</h2>
            </Editable>
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
          {regions.map((r, index) => (
            <motion.div key={r.id} variants={staggerChild} className={cardDimClass(r, inEditor)}>
              <EditableCard contentKey="home_cards" fieldKey="regions" index={index} label={String(r.name ?? 'Region Card')}>
                <Link href={String(r.href || '/regions')} className="group block">
                  <div className="relative overflow-hidden aspect-[4/3] mb-4">
                    <img loading="lazy" decoding="async"
                      src={String(r.img)}
                      alt={String(r.name)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      style={{ willChange: 'transform' }}
                    />
                  </div>
                  <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{r.subtitle}</p>
                  <h3 className="font-display text-2xl text-forest mb-2">{r.name}</h3>
                  <p className="font-sans text-sm text-forest/55 leading-relaxed">{r.desc}</p>
                </Link>
              </EditableCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </EditableSection>
  )

  const storiesSection = (
    <EditableSection key="stories" id="stories" label="Stories" className="bg-white">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <Editable section="home_sections" fieldKey="stories_eyebrow" value={hs.stories_eyebrow} label="Stories Eyebrow" type="text">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">{hs.stories_eyebrow}</p>
            </Editable>
            <Editable section="home_sections" fieldKey="stories_heading" value={hs.stories_heading} label="Stories Heading" type="text">
              <h2 className="font-display text-4xl text-forest">{hs.stories_heading}</h2>
            </Editable>
          </div>
          <Link href="/mydrakensberg" className="hidden sm:flex items-center gap-2 font-sans text-sm text-forest/50 hover:text-forest transition-colors">
            All stories <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {stories.length === 0 ? (
          <p className="font-sans text-sm text-forest/40 py-6">
            No stories published yet — publish one under Admin → Blog & Content.
          </p>
        ) : (
          <motion.div
            className="grid md:grid-cols-3 gap-8"
            variants={staggerContainer(0.08)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            {stories.map(s => (
              <motion.div key={s.id} variants={staggerChild} whileHover={{ y: -3 }} transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}>
                <Link href={`/mydrakensberg/${s.slug}`} className="group block">
                  <div className="relative overflow-hidden aspect-[3/2] mb-4 bg-forest/5">
                    {s.featured_image && (
                      <img loading="lazy" decoding="async" src={s.featured_image} alt={s.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" style={{ willChange: 'transform' }} />
                    )}
                  </div>
                  <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-2">
                    {s.category}{s.published_at ? ` · ${new Date(s.published_at).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}` : ''}
                  </p>
                  <h3 className="font-display text-xl text-forest leading-snug group-hover:text-sage transition-colors">{s.title}</h3>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </EditableSection>
  )

  const trailsSection = (
    <EditableSection key="trails" id="trails" label="Top Trails" className="bg-forest">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <Editable section="home_sections" fieldKey="trails_eyebrow" value={hs.trails_eyebrow} label="Trails Eyebrow" type="text">
              <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-2">{hs.trails_eyebrow}</p>
            </Editable>
            <Editable section="home_sections" fieldKey="trails_heading" value={hs.trails_heading} label="Trails Heading" type="text">
              <h2 className="font-display text-4xl text-white">{hs.trails_heading}</h2>
            </Editable>
          </div>
          <Link href="/hikes" className="hidden sm:flex items-center gap-2 font-sans text-sm text-white/40 hover:text-white transition-colors">
            All hikes <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {trails.length === 0 ? (
          <p className="font-sans text-sm text-white/30 py-8">Trails will appear here once published.</p>
        ) : (
          <div className="divide-y divide-white/10">
            {trails.slice(0, 4).map((t, i) => (
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
    </EditableSection>
  )

  const scheduledHikeItems: MiniListItemData[] = scheduledHikes.map(e => ({
    id: e.id,
    href: `/experiences/${e.id}`,
    title: e.title,
    meta: `${fmtShortDate(e.departureDate)} · ${e.durationDays} day${e.durationDays !== 1 ? 's' : ''}`,
    badgeLabel: e.difficulty || 'Hike',
    badgeColor: DIFF_COLOR[e.difficulty] || '#4A7251',
    img: trailImageById.get(e.trailId),
  }))

  const eventItems: MiniListItemData[] = upcomingEvents.map(ev => ({
    id: ev.id,
    href: '/events',
    title: ev.title,
    meta: `${fmtShortDate(ev.starts_at)}${ev.location ? ' · ' + ev.location : ''}`,
    badgeLabel: ev.event_type === 'special' ? 'Special' : 'Event',
    badgeColor: EVENT_TYPE_BG[ev.event_type],
  }))

  const activityItems: MiniListItemData[] = featuredActivities.map(a => ({
    id: a.id,
    href: `/activities/${a.id}`,
    title: a.name,
    meta: `${a.category}${a.pricePerPerson ? ' · R' + a.pricePerPerson.toLocaleString() : ''}`,
    badgeLabel: a.category || 'Experience',
    badgeColor: '#C9A96E',
    img: a.photos?.[0],
  }))

  const experiencesSection = (
    <EditableSection key="experiences" id="experiences" label="Events & Experiences" className="bg-white">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20">
        <div className="mb-10">
          <Editable section="home_sections" fieldKey="experiences_eyebrow" value={hs.experiences_eyebrow} label="Experiences Eyebrow" type="text">
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">{hs.experiences_eyebrow}</p>
          </Editable>
          <Editable section="home_sections" fieldKey="experiences_heading" value={hs.experiences_heading} label="Experiences Heading" type="text">
            <h2 className="font-display text-4xl text-forest">{hs.experiences_heading}</h2>
          </Editable>
        </div>

        <motion.div
          className="grid md:grid-cols-3 gap-10"
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          <motion.div variants={staggerChild}>
            <ExperienceColumn
              title="Scheduled Hikes"
              viewAllHref="/hikes"
              items={scheduledHikeItems}
              emptyText="New guided departures will appear here once suppliers schedule them."
            />
          </motion.div>
          <motion.div variants={staggerChild}>
            <ExperienceColumn
              title="Events & Specials"
              viewAllHref="/events"
              items={eventItems}
              emptyText="No upcoming events right now — check back soon."
            />
          </motion.div>
          <motion.div variants={staggerChild}>
            <ExperienceColumn
              title="Experiences"
              viewAllHref="/activities"
              items={activityItems}
              emptyText="Guided activities and adventures will appear here soon."
            />
          </motion.div>
        </motion.div>
      </div>
    </EditableSection>
  )

  const newsletterSection = (
    <EditableSection key="newsletter" id="newsletter" label="Newsletter" className="bg-mist">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20">
        <div className="max-w-xl">
          <Editable section="home_sections" fieldKey="newsletter_eyebrow" value={hs.newsletter_eyebrow} label="Newsletter Eyebrow" type="text">
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-3">{hs.newsletter_eyebrow}</p>
          </Editable>
          <Editable section="home_sections" fieldKey="newsletter_heading" value={hs.newsletter_heading} label="Newsletter Heading" type="text">
            <h2 className="font-display text-4xl text-forest mb-4">{hs.newsletter_heading}</h2>
          </Editable>
          <Editable section="home_sections" fieldKey="newsletter_body" value={hs.newsletter_body} label="Newsletter Body" type="textarea">
            <p className="font-sans text-sm text-forest/55 mb-8 leading-relaxed">
              {hs.newsletter_body}
            </p>
          </Editable>
          <form className="flex gap-0 max-w-md" onSubmit={subscribeNewsletter}>
            <label htmlFor="newsletter-email" className="sr-only">Email address</label>
            <input
              id="newsletter-email"
              type="email"
              required
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="Your email address"
              className="flex-1 px-4 py-3 bg-white border border-black/10 font-sans text-sm text-forest placeholder:text-forest/30 focus:outline-none focus:border-forest transition-colors"
            />
            <button
              type="submit"
              disabled={subscribing}
              className="px-6 py-3 bg-forest text-white font-sans text-sm hover:bg-sage transition-colors whitespace-nowrap disabled:opacity-60"
            >
              {subscribing ? 'Subscribing…' : 'Subscribe'}
            </button>
          </form>
        </div>
      </div>
    </EditableSection>
  )

  const reorderable: Record<string, React.ReactNode> = {
    stats: statsSection,
    categories: categoriesSection,
    regions: regionsSection,
    stories: storiesSection,
    trails: trailsSection,
    experiences: experiencesSection,
    newsletter: newsletterSection,
  }

  // Render in the admin-configured order; unknown/missing ids fall back to the
  // default order so newly added sections always appear.
  const configured = (layout.section_order ?? []).filter(id => id in reorderable)
  const missing = Object.keys(reorderable).filter(id => !configured.includes(id))
  const orderedSections = [...configured, ...missing].map(id => reorderable[id])

  return (
    <main className="bg-mist min-h-screen">

      {/* ── Promo Banner (admin-controlled) ── */}
      {promos.enabled && !promoBannerDismissed && (
        <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-2.5 font-sans text-sm text-white" style={{ backgroundColor: promos.banner_color }}>
          <span />
          <Link href={promos.banner_link} className="hover:underline">{promos.banner_text}</Link>
          <button onClick={() => setPromoBannerDismissed(true)} className="text-white/60 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Hero ── */}
      <HeroSection hero={hero} />

      {/* ── Reorderable sections ── */}
      {orderedSections}

      {/* ── Footer ── */}
      <EditableSection id="footer" label="Footer">
        <Footer />
      </EditableSection>
    </main>
  )
}

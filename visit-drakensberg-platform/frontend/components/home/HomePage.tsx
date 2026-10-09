'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import SafeImage from '@/components/ui/SafeImage'
import toast from 'react-hot-toast'
import { ArrowRight, ChevronDown, X } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { publicSupabase } from '@/lib/supabase-public'
import { motion, AnimatePresence } from 'framer-motion'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay } from 'swiper/modules'
import 'swiper/css'
import HeroCarousel from '@/components/media/HeroCarousel'
import { useSwiperAutoplay, CAROUSEL_SPEED_MS } from '@/lib/carousel-autoplay'
import Footer from '@/components/layout/Footer'
import TripPlanningTools from '@/components/home/TripPlanningTools'
import TopDestinations from '@/components/home/TopDestinations'
import RecommendedThisSeason from '@/components/home/RecommendedThisSeason'
import { FeaturedExperiencesCarousel, CarouselNav, trekkingExperienceToFeatured, type FeaturedExperience } from '@/components/home/FeaturedExperiences'
import type { Swiper as SwiperInstance } from 'swiper'
import { loadSiteContent, SITE_CONTENT_DEFAULTS, type HomeCard, type SiteContent } from '@/lib/site-content'
import type { Region } from '@/lib/regions'
import { useSiteSection } from '@/lib/use-site-section'
import { objectPositionStyle } from '@/lib/image-position'
import { staggerContainer, staggerChild, fadeUp } from '@/lib/motion'
import { useEditMode } from '@/lib/edit-mode-context'
import Editable from '@/components/editor/Editable'
import EditableSection from '@/components/editor/EditableSection'
import EditableCard from '@/components/editor/EditableCard'
import { ExploreLink, homeContainer, homeTone, homeType } from '@/components/home/home-style'
import { getTrailSummaries, type Trail } from '@/lib/trails'
import { getFeaturedAttractions, ATTRACTION_KIND_LABEL, type Attraction } from '@/lib/attractions'
import { getUpcomingExperiences, type TrekkingExperience } from '@/lib/experiences'
import { isEventUpcoming } from '@/lib/upcoming'
import { getSupplierEntities } from '@/lib/supplier-entities'
import { getActivities, type Activity } from '@/lib/activities'
import { trackEvent, AnalyticsEvent } from '@/lib/analytics'
import { getPublishedPosts, type BlogPost } from '@/lib/blog-posts'
import {
  getPublishedPackages, isGroupPriced, packageGroupSize, packageHeadlinePrice,
  type MarketplacePackage,
} from '@/lib/packages'
import { formatMoney } from '@/lib/allocation'

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

/**
 * Mobile-only presentation of the Regions section — a swipeable Swiper
 * carousel rendering the same RegionCardBody as the desktop grid it
 * replaces below the `sm` breakpoint. Looping needs enough cards to feel
 * like a loop rather than glitch, so it falls back to a plain (still
 * swipeable) row. Auto-advances on the shared house cadence — paused on
 * touch/drag, off-screen, and while the visual editor is open so it doesn't
 * fight admin clicks — and resumes afterwards. See lib/carousel-autoplay.ts.
 */
function RegionsCarousel({ regions, inEditor }: { regions: HomeCard[]; inEditor: boolean }) {
  const canLoop = regions.length > 2
  const autoplay = useSwiperAutoplay({ slideCount: regions.length, enabled: !inEditor })

  return (
    <Swiper
      modules={[Autoplay]}
      loop={canLoop}
      speed={CAROUSEL_SPEED_MS}
      {...autoplay}
      slidesPerView={1.15}
      spaceBetween={12}
      grabCursor
      className="!pb-1"
    >
      {regions.map((r, index) => (
        <SwiperSlide key={r.id} className={`h-auto self-stretch ${cardDimClass(r, inEditor)}`}>
          <EditableCard contentKey="home_cards" fieldKey="regions" index={index} label={String(r.name ?? 'Region Card')}>
            <RegionCardBody region={r} />
          </EditableCard>
        </SwiperSlide>
      ))}
    </Swiper>
  )
}

/* ─── Hero ───────────────────────────────────────────────────────────────────── */

function HeroSection({ hero }: { hero: typeof SITE_CONTENT_DEFAULTS.hero }) {
  const editMode = useEditMode()
  const headline = editMode?.getValue('hero', 'headline', hero.headline) ?? hero.headline
  const subheadline = editMode?.getValue('hero', 'subheadline', hero.subheadline) ?? hero.subheadline
  const locationLabel = editMode?.getValue('hero', 'location_label', hero.location_label) ?? hero.location_label
  const imageUrl = String(editMode?.getValue('hero', 'image_url', hero.image_url) ?? hero.image_url)
  const carouselImages = (editMode?.getValue('hero', 'images', hero.images) ?? hero.images) as string[]
  const overlayOpacity = Number(editMode?.getValue('hero', 'overlay_opacity', hero.overlay_opacity) ?? hero.overlay_opacity)
  // Which part of the photo the hero crops around. This hero is the most
  // aggressive crop on the site — near-square on a phone, a wide letterbox on
  // a desktop — so a centred crop routinely loses the subject.
  const imagePosition = String(editMode?.getValue('hero', 'image_position', hero.image_position) ?? hero.image_position)
  const carouselPositions = (editMode?.getValue('hero', 'image_positions', hero.image_positions) ?? hero.image_positions) as Record<string, string>

  return (
    <EditableSection id="hero" label="Hero" className="relative h-[80vh] min-h-[480px] lg:h-screen lg:min-h-[600px] flex flex-col">
      <div className="absolute inset-0 bg-slate-900">
        {hero.video_url ? (
          <video src={hero.video_url} autoPlay muted loop playsInline className="w-full h-full object-cover" />
        ) : carouselImages.length > 1 ? (
          <HeroCarousel images={carouselImages} positions={carouselPositions} />
        ) : (
          <Editable section="hero" fieldKey="image_url" value={imageUrl} label="Background Image" type="image">
            <SafeImage
              src={imageUrl}
              alt="Drakensberg mountains"
              fill
              priority
              sizes="100vw"
              className="object-cover"
              style={objectPositionStyle(imagePosition)}
            />
          </Editable>
        )}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/60"
          style={{ opacity: overlayOpacity / 100 + 0.3 }}
        />
      </div>

      {/* -translate-y-[15%]: this block fills the hero's height, so the text
          sits 15% of the hero higher than its bottom-aligned resting place. */}
      <motion.div
        className="relative flex-1 flex flex-col justify-end pb-20 pt-[102px] lg:pt-0 px-6 lg:px-20 max-w-[1440px] mx-auto w-full -translate-y-[15%]"
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
          <motion.h1 variants={fadeUp} className="font-sans font-bold text-4xl sm:text-7xl lg:text-8xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-3xl" style={{ whiteSpace: 'pre-line' }}>
            {headline}
          </motion.h1>
        </Editable>
        <Editable section="hero" fieldKey="subheadline" value={subheadline} label="Subheadline" type="textarea">
          <motion.p variants={fadeUp} className="font-sans text-base text-white/70 max-w-md font-light leading-relaxed">
            {subheadline}
          </motion.p>
        </Editable>
      </motion.div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40">
        <ChevronDown className="w-5 h-5 animate-bounce-slow" />
      </div>
    </EditableSection>
  )
}

/* ─── Regions ────────────────────────────────────────────────────────────────── */

const light = homeTone.light
const dark = homeTone.dark

// Shared by the mobile carousel and the desktop grid so both render the
// exact same card — only the surrounding layout differs.
function RegionCardBody({ region: r }: { region: HomeCard }) {
  return (
    <Link href={String(r.href || '/regions')} className={`${homeType.cardLink} ${light.focus}`}>
      <div className={`${homeType.media} ${light.media}`}>
        <SafeImage
          src={String(r.img)}
          alt={String(r.name)}
          fill
          loading="lazy"
          sizes="(max-width: 640px) 90vw, 31vw"
          className={homeType.image}
          style={{ willChange: 'transform' }}
        />
      </div>
      <div className="pt-5">
        {r.subtitle && <p className={`${homeType.eyebrow} ${light.eyebrow} mb-1`}>{r.subtitle}</p>}
        <h3 className={`${homeType.cardTitle} ${light.title} mb-2`}>{r.name}</h3>
        {r.desc && <p className={`${homeType.cardBody} ${light.body} line-clamp-3`}>{r.desc}</p>}
      </div>
    </Link>
  )
}

/* ─── Section header ─────────────────────────────────────────────────────────── */

/**
 * The shared homepage band header: a small eyebrow, the bold heading and,
 * under it, the "Explore all →" link — the Top Destinations layout. Copy is
 * CMS-editable via home_sections.<id>_eyebrow / <id>_heading.
 */
function SectionHeader({ id, label, hs, tone, link, subheadingKey, aside }: {
  id: string
  label: string
  hs: Record<string, string>
  tone: 'light' | 'dark'
  link?: { href: string; label?: string }
  subheadingKey?: string
  aside?: React.ReactNode
}) {
  const t = homeTone[tone]
  return (
    <div className="flex items-end justify-between gap-6 mb-7 lg:mb-9">
      <div className="max-w-3xl">
        <Editable section="home_sections" fieldKey={`${id}_eyebrow`} value={hs[`${id}_eyebrow`]} label={`${label} Eyebrow`} type="text">
          <p className={`font-sans text-xs tracking-[0.2em] uppercase ${t.eyebrow} mb-3`}>{hs[`${id}_eyebrow`]}</p>
        </Editable>
        <Editable section="home_sections" fieldKey={`${id}_heading`} value={hs[`${id}_heading`]} label={`${label} Heading`} type="text">
          <h2 className={`${homeType.heading} ${t.heading}`}>{hs[`${id}_heading`]}</h2>
        </Editable>
        {subheadingKey && (
          <Editable section="home_sections" fieldKey={subheadingKey} value={hs[subheadingKey]} label={`${label} Subheading`} type="text">
            <p className={`font-sans text-base ${t.subheading} mt-4`}>{hs[subheadingKey]}</p>
          </Editable>
        )}
        {link && <ExploreLink href={link.href} tone={tone} className="mt-3 lg:mt-4">{link.label ?? 'Explore all'}</ExploreLink>}
      </div>
      {aside}
    </div>
  )
}

/* ─── Journeys ───────────────────────────────────────────────────────────────── */

function JourneyCardBody({ pkg }: { pkg: MarketplacePackage }) {
  const nights = pkg.durationNights
  return (
    <Link href={`/packages/${pkg.id}`} className={`${homeType.cardLink} ${light.focus}`}>
      {/* A package without its own photo shows a plain block, not a stock image. */}
      <div className={`${homeType.media} bg-mist`}>
        <SafeImage
          src={pkg.image}
          alt={pkg.title}
          fill
          loading="lazy"
          sizes="(max-width: 640px) 88vw, (max-width: 1024px) 45vw, 30vw"
          className={homeType.image}
          style={{ willChange: 'transform' }}
        />
        {pkg.tag && (
          <span className="absolute top-3 left-3 font-sans text-[10px] tracking-[0.15em] uppercase bg-gold text-forest rounded-full px-3 py-1">
            {pkg.tag}
          </span>
        )}
      </div>
      <div className="pt-5">
        <p className={`${homeType.eyebrow} ${light.eyebrow} mb-1`}>
          {pkg.region || 'Drakensberg'} · {nights} night{nights !== 1 ? 's' : ''}
        </p>
        <h3 className={`${homeType.cardTitle} ${light.title} mb-3`}>{pkg.title}</h3>
        <div className="flex items-center justify-between">
          <span>
            {pkg.originalPrice && (
              <span className="font-sans text-xs text-forest/30 line-through mr-1.5">{formatMoney(pkg.originalPrice)}</span>
            )}
            <span className="font-sans font-semibold text-lg text-forest">{formatMoney(packageHeadlinePrice(pkg))}</span>
            <span className="font-sans text-xs text-forest/40"> {isGroupPriced(pkg) ? `/ ${packageGroupSize(pkg)} guests` : 'pp'}</span>
          </span>
          <span className="font-sans text-sm text-forest/60 group-hover:text-brown-700 transition-colors inline-flex items-center gap-1">
            View <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  )
}

/**
 * Curated-journeys carousel — a promotional showcase of published packages,
 * always presented as a Swiper carousel (unlike Regions, which only swaps
 * to a carousel on mobile) since it's meant to read as a scrolling reel of
 * deals rather than a fixed grid. Peeks progressively more of the next
 * card as the viewport widens. Auto-advances on the shared house cadence
 * (paused on touch/drag, off-screen, and while the visual editor is open)
 * and resumes afterwards. See lib/carousel-autoplay.ts.
 */
function JourneysCarousel({ journeys }: { journeys: MarketplacePackage[] }) {
  const editMode = useEditMode()
  const inEditor = Boolean(editMode)
  const canLoop = journeys.length > 3
  const autoplay = useSwiperAutoplay({ slideCount: journeys.length, enabled: !inEditor })

  return (
    <Swiper
      modules={[Autoplay]}
      loop={canLoop}
      speed={CAROUSEL_SPEED_MS}
      {...autoplay}
      spaceBetween={32}
      grabCursor
      slidesPerView={1.15}
      breakpoints={{
        640: { slidesPerView: 2.15 },
        1024: { slidesPerView: 3 },
      }}
      className="!pb-1"
    >
      {journeys.map(pkg => (
        <SwiperSlide key={pkg.id} className="h-auto self-stretch">
          <JourneyCardBody pkg={pkg} />
        </SwiperSlide>
      ))}
    </Swiper>
  )
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

/**
 * The homepage body. app/page.tsx (a Server Component) loads the CMS
 * content and region records and passes them in, so the first HTML already
 * carries the real hero, copy and photos; it also seeds useSiteSection via
 * SiteContentSeedProvider. Without server data (a failed read), it falls
 * back to the defaults and the client refresh below, as before.
 */
export default function HomePage({ initialContent, initialRegions }: { initialContent?: Partial<SiteContent>; initialRegions?: Region[] }) {
  const [hero, setHero] = useState(initialContent?.hero ?? SITE_CONTENT_DEFAULTS.hero)
  const [promos, setPromos] = useState(initialContent?.promotions ?? SITE_CONTENT_DEFAULTS.promotions)
  const hs = useSiteSection('home_sections') as unknown as Record<string, string>
  const cards = useSiteSection('home_cards')
  const layout = useSiteSection('home_layout')
  const editMode = useEditMode()
  const inEditor = Boolean(editMode)
  const [promoBannerDismissed, setPromoBannerDismissed] = useState(false)
  const [trails, setTrails] = useState<Trail[]>([])
  const [attractions, setAttractions] = useState<Attraction[]>([])
  const [scheduledHikes, setScheduledHikes] = useState<TrekkingExperience[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<PublicEvent[]>([])
  const [featuredActivities, setFeaturedActivities] = useState<Activity[]>([])
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [stories, setStories] = useState<BlogPost[]>([])
  const [journeys, setJourneys] = useState<MarketplacePackage[]>([])
  const [experienceSwiper, setExperienceSwiper] = useState<SwiperInstance | null>(null)

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
      toast.success('You’re on the list. See you in the next dispatch.')
      setNewsletterEmail('')
    } catch {
      toast.error('Subscription failed. Please try again later.')
    } finally {
      setSubscribing(false)
    }
  }

  useEffect(() => {
    // Background refresh; a failed read keeps what is already shown.
    loadSiteContent().then(content => {
      if (!content) return
      setHero(content.hero)
      setPromos(content.promotions)
    })
    // Public, session-less client for all of the below: this is anonymous
    // catalogue data every visitor sees, and it must not depend on the
    // visitor's (possibly stale/broken) auth session — see lib/supabase-public.ts.
    // Only ever read for .id/.image (trailImageById below) and .name/.region
    // (inside getUpcomingExperiences) — the lightweight summary read is
    // enough. See lib/trails.ts's getTrailSummaries().
    getTrailSummaries(publicSupabase)
      .then(all => setTrails(all.filter(t => t.status === 'published')))
      .catch(() => setTrails([]))
    getFeaturedAttractions(publicSupabase)
      .then(setAttractions)
      .catch(() => setAttractions([]))
    getUpcomingExperiences(publicSupabase)
      .then(exps => setScheduledHikes(exps.slice(0, 3)))
      .catch(() => setScheduledHikes([]))
    getSupplierEntities<any>('events', undefined, publicSupabase)
      .then((all: PublicEvent[]) => {
        setUpcomingEvents(
          all
            .filter(e => e.is_published && isEventUpcoming(e))
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
    getPublishedPackages()
      .then(all => setJourneys([...all].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 8)))
      .catch(() => setJourneys([]))
  }, [])

  /* ── Reorderable sections ── */

  const statsSection = (
    <EditableSection key="stats" id="stats" label="Stats Strip" className="bg-forest text-white">
      <motion.div
        className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-[69px] py-10 lg:py-14 grid grid-cols-2 md:grid-cols-4 gap-8"
        variants={staggerContainer(0.07)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
      >
        {[1, 2, 3, 4].map((i) => (
          <motion.div key={i} variants={staggerChild}>
            <Editable section="home_sections" fieldKey={`stat_${i}_value`} value={hs[`stat_${i}_value`]} label={`Stat ${i} Value`} type="text">
              <p className="font-sans font-bold text-3xl lg:text-[40px] tracking-[-0.02em] text-gold">{hs[`stat_${i}_value`]}</p>
            </Editable>
            <Editable section="home_sections" fieldKey={`stat_${i}_label`} value={hs[`stat_${i}_label`]} label={`Stat ${i} Label`} type="text">
              <p className="font-sans text-[11px] text-white/60 mt-1 tracking-[0.15em] uppercase">{hs[`stat_${i}_label`]}</p>
            </Editable>
          </motion.div>
        ))}
      </motion.div>
    </EditableSection>
  )

  const categoriesSection = (
    <EditableSection key="categories" id="categories" label="Categories" className="bg-mist">
      <div className={homeContainer}>
        <SectionHeader id="categories" label="Categories" hs={hs} tone="light" />
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-8 lg:gap-x-6"
          variants={staggerContainer(0.06)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          {categories.map((cat, index) => (
            <motion.div key={cat.id} variants={staggerChild} className={cardDimClass(cat, inEditor)}>
              <EditableCard contentKey="home_cards" fieldKey="categories" index={index} label={String(cat.label ?? 'Category Card')}>
                <Link href={String(cat.href || '/')} className={`${homeType.cardLink} ${light.focus}`}>
                  <div className={`${homeType.media} ${light.media}`}>
                    <SafeImage
                      src={String(cat.img)}
                      alt=""
                      fill
                      loading="lazy"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className={homeType.image}
                      style={{ willChange: 'transform' }}
                    />
                  </div>
                  <h3 className={`pt-4 font-sans font-semibold text-lg lg:text-xl leading-snug transition-colors ${light.title}`}>{cat.label}</h3>
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
      <div className={homeContainer}>
        <SectionHeader id="regions" label="Regions" hs={hs} tone="light" link={{ href: '/regions' }} />

        {/* Tablet/desktop: static grid */}
        <motion.div
          className="hidden sm:grid sm:grid-cols-3 gap-6 lg:gap-8"
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          {regions.map((r, index) => (
            <motion.div key={r.id} variants={staggerChild} className={cardDimClass(r, inEditor)}>
              <EditableCard contentKey="home_cards" fieldKey="regions" index={index} label={String(r.name ?? 'Region Card')}>
                <RegionCardBody region={r} />
              </EditableCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Mobile: swipeable carousel */}
        <div className="sm:hidden">
          <RegionsCarousel regions={regions} inEditor={inEditor} />
        </div>
      </div>
    </EditableSection>
  )

  const storiesSection = (
    <EditableSection key="stories" id="stories" label="Stories" className="bg-white">
      <div className={homeContainer}>
        <SectionHeader id="stories" label="Stories" hs={hs} tone="light" link={{ href: '/mydrakensberg' }} />

        {stories.length === 0 ? (
          <p className="font-sans text-sm text-forest/60 py-6">
            No stories published yet. Publish one under Admin → Blog & Content.
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
              <motion.div key={s.id} variants={staggerChild}>
                <Link href={`/mydrakensberg/${s.slug}`} className={`${homeType.cardLink} ${light.focus}`}>
                  <div className={`${homeType.media} ${light.media}`}>
                    {s.featured_image && (
                      <SafeImage src={s.featured_image} alt="" fill loading="lazy" sizes="(max-width: 768px) 100vw, 33vw" className={homeType.image} style={{ willChange: 'transform' }} />
                    )}
                  </div>
                  <div className="pt-5">
                    <p className={`${homeType.eyebrow} ${light.eyebrow} mb-1`}>
                      {s.category}{s.published_at ? ` · ${new Date(s.published_at).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}` : ''}
                    </p>
                    <h3 className={`${homeType.cardTitle} ${light.title} mb-2`}>{s.title}</h3>
                    {s.excerpt && <p className={`${homeType.cardBody} ${light.body} line-clamp-3`}>{s.excerpt}</p>}
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </EditableSection>
  )

  // "Top Attractions" — an editorial pick, not a slice of the catalogue.
  //
  // This replaces a "Top Trails" band that rendered the first four published
  // trails and ignored the trail's own "Featured on Homepage" flag, so that
  // checkbox in Admin → Hiking Trails did nothing. Worse, when getTrails()
  // fell back to DEFAULT_TRAILS (an unreachable Supabase, missing env vars)
  // the band listed trails like tugela-falls and giants-castle that are not
  // in the live catalogue at all — and /hikes/[id], reading successfully
  // server-side, 404'd on every one of them.
  //
  // Now the rows are exactly what an admin ticked, across trails, nature
  // reserves and towns (lib/attractions.ts), and every href points at a
  // record that was actually read from the store it links into.
  const attractionsSection = (
    <EditableSection key="attractions" id="attractions" label="Top Attractions" className="bg-forest">
      <div className={homeContainer}>
        <SectionHeader id="attractions" label="Attractions" hs={hs} tone="dark" link={{ href: '/plan', label: 'Plan your trip' }} />

        {attractions.length === 0 ? (
          <p className="font-sans text-sm text-white/60 py-8">
            Nothing featured yet. Tick &ldquo;Featured on Homepage&rdquo; on a trail, nature reserve or town in the admin console.
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {attractions.slice(0, 6).map((a, i) => (
              <Link key={`${a.kind}:${a.id}`} href={a.href} className="group flex items-center justify-between py-5 hover:pl-2 transition-all duration-200">
                <div className="flex items-center gap-6 min-w-0">
                  <span className="font-sans text-2xl text-gold/60 font-light tabular-nums w-8 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <h3 className={`font-sans font-semibold text-lg lg:text-xl transition-colors truncate ${dark.title}`}>{a.name}</h3>
                    <p className={`font-sans text-sm mt-0.5 truncate ${dark.body}`}>{a.meta}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  {/* A trail's difficulty is the useful badge; for a reserve or
                      town it is the kind, so a visitor knows what they'd open. */}
                  {a.difficulty ? (
                    <span
                      className="font-sans text-xs rounded-full px-3 py-1 hidden sm:inline"
                      style={{ color: DIFF_COLOR[a.difficulty] ?? '#4A7251', background: (DIFF_COLOR[a.difficulty] ?? '#4A7251') + '22' }}
                    >
                      {a.difficulty}
                    </span>
                  ) : (
                    <span className="font-sans text-xs rounded-full px-3 py-1 text-white/60 bg-white/10 hidden sm:inline">
                      {ATTRACTION_KIND_LABEL[a.kind]}
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-gold transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </EditableSection>
  )

  const scheduledHikeItems: FeaturedExperience[] = scheduledHikes.map(e =>
    trekkingExperienceToFeatured(e, trailImageById.get(e.trailId), DIFF_COLOR[e.difficulty] || '#4A7251'),
  )

  const eventItems: FeaturedExperience[] = upcomingEvents.map(ev => ({
    id: ev.id,
    href: '/events',
    title: ev.title,
    region: ev.location || 'Drakensberg',
    meta: ev.event_type === 'special' ? 'Special' : 'Event',
    date: ev.starts_at,
    price: ev.ticket_price,
    info: ev.location ? `Takes place at ${ev.location}` : undefined,
    fallbackColor: EVENT_TYPE_BG[ev.event_type],
  }))

  const activityItems: FeaturedExperience[] = featuredActivities.map(a => {
    const duration = [a.durationH && `${a.durationH}h`, a.durationM && `${a.durationM}m`].filter(Boolean).join(' ')
    return {
      id: a.id,
      href: `/activities/${a.id}`,
      title: a.name,
      region: a.region || 'Drakensberg',
      meta: [a.category && `${a.category} experience`, duration].filter(Boolean).join(', '),
      price: a.pricePerPerson,
      info: [a.supplierName && `Run by ${a.supplierName}`, a.minAge && `ages ${a.minAge}+`, a.maxGroup && `max ${a.maxGroup} per group`].filter(Boolean).join(' · ') || undefined,
      img: a.photos?.[0],
      fallbackColor: '#C9A96E',
    }
  })

  // One mixed reel — hikes, events/specials and experiences together — in
  // whichever order each list already comes in (soonest-first per source).
  const experienceItems: FeaturedExperience[] = [...scheduledHikeItems, ...eventItems, ...activityItems]

  const experiencesSection = (
    <EditableSection key="experiences" id="experiences" label="Featured Experiences" className="bg-white">
      <div className={homeContainer}>
        <SectionHeader
          id="experiences"
          label="Experiences"
          hs={hs}
          tone="light"
          subheadingKey="experiences_subheading"
          link={{ href: '/activities' }}
          aside={<div className="hidden sm:block shrink-0"><CarouselNav swiper={experienceSwiper} count={experienceItems.length} /></div>}
        />

        {experienceItems.length === 0 ? (
          <p className="font-sans text-sm text-forest/60 py-6">New hikes, events and experiences will appear here once they're scheduled.</p>
        ) : (
          <FeaturedExperiencesCarousel items={experienceItems} onSwiper={setExperienceSwiper} />
        )}
      </div>
    </EditableSection>
  )

  const journeysSection = (
    <EditableSection key="journeys" id="journeys" label="Curated Journeys" className="bg-white">
      <div className={homeContainer}>
        <SectionHeader id="journeys" label="Journeys" hs={hs} tone="light" link={{ href: '/packages' }} />

        {journeys.length === 0 ? (
          <p className="font-sans text-sm text-forest/60 py-8">No packages published yet. Please check back soon.</p>
        ) : (
          <JourneysCarousel journeys={journeys} />
        )}
      </div>
    </EditableSection>
  )

  const newsletterSection = (
    <EditableSection key="newsletter" id="newsletter" label="Newsletter" className="bg-mist">
      <div className={homeContainer}>
        <div className="max-w-xl">
          <Editable section="home_sections" fieldKey="newsletter_eyebrow" value={hs.newsletter_eyebrow} label="Newsletter Eyebrow" type="text">
            <p className={`font-sans text-xs tracking-[0.2em] uppercase ${light.eyebrow} mb-3`}>{hs.newsletter_eyebrow}</p>
          </Editable>
          <Editable section="home_sections" fieldKey="newsletter_heading" value={hs.newsletter_heading} label="Newsletter Heading" type="text">
            <h2 className={`${homeType.heading} ${light.heading} mb-4`}>{hs.newsletter_heading}</h2>
          </Editable>
          <Editable section="home_sections" fieldKey="newsletter_body" value={hs.newsletter_body} label="Newsletter Body" type="textarea">
            <p className={`font-sans text-base ${light.body} mb-8 leading-relaxed`}>
              {hs.newsletter_body}
            </p>
          </Editable>
          <form className="flex gap-2 max-w-md" onSubmit={subscribeNewsletter}>
            <label htmlFor="newsletter-email" className="sr-only">Email address</label>
            <input
              id="newsletter-email"
              type="email"
              required
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="Your email address"
              className="flex-1 min-w-0 px-4 py-3 bg-white border border-black/10 rounded-xl font-sans text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:border-forest transition-colors"
            />
            <button
              type="submit"
              disabled={subscribing}
              className="px-6 py-3 rounded-xl bg-gold text-forest font-sans font-semibold text-sm hover:bg-brown-600 transition-colors whitespace-nowrap disabled:opacity-60"
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
    experiences: experiencesSection,
    stories: storiesSection,
    attractions: attractionsSection,
    journeys: journeysSection,
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

      {/* ── Travel hub (components/home/*) ── */}
      <TripPlanningTools />
      <TopDestinations initialRegions={initialRegions} />
      <RecommendedThisSeason />

      {/* ── Reorderable sections ── */}
      {orderedSections}

      {/* ── Footer ── */}
      <EditableSection id="footer" label="Footer">
        <Footer />
      </EditableSection>
    </main>
  )
}

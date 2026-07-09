'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Info, ShieldCheck, Sunrise } from 'lucide-react'
import PanoramaViewer from '@/components/panorama/PanoramaViewer'
import TrailCard from '@/components/trails/TrailCard'
import Footer from '@/components/layout/Footer'
import EditablePageHeader from '@/components/editor/EditablePageHeader'
import type { Trail } from '@/components/trails/TrailCard'

/* ─── Reserve data ───────────────────────────────────────────────────────── */
interface Peak {
  name: string
  elevation: number
  difficulty: 'accessible' | 'moderate' | 'expert'
}

interface Reserve {
  id: string
  name: string
  shortName: string
  tagline: string
  description: string
  image: string
  viewpointName: string
  latitude: number
  longitude: number
  peaks: Peak[]
  trails: Trail[]
  bestTime: string
  permits: string
  facilities: string[]
}

const RESERVES: Reserve[] = [
  {
    id: 'ukhahlamba',
    name: 'uKhahlamba-Drakensberg Park',
    shortName: 'uKhahlamba',
    tagline: 'UNESCO World Heritage Site · KwaZulu-Natal',
    description:
      'The flagship Drakensberg reserve, inscribed as a UNESCO World Heritage Site in 2000. Stretching across 243,000 hectares of soaring basalt cliffs, ancient San rock art, and highland wilderness, uKhahlamba-Drakensberg Park is one of Africa\'s most spectacular protected areas. The escarpment reaches its highest points here, with peaks exceeding 3,400 metres providing dramatic vistas across the Kingdom of Lesotho.',
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1400&q=85',
    viewpointName: 'Amphitheatre Viewpoint',
    latitude: -28.7522,
    longitude: 28.9714,
    peaks: [
      { name: 'Champagne Castle', elevation: 3377, difficulty: 'expert' },
      { name: 'Cathkin Peak', elevation: 3149, difficulty: 'expert' },
      { name: 'Monks Cowl', elevation: 3234, difficulty: 'expert' },
      { name: 'Sterkhorn', elevation: 3084, difficulty: 'expert' },
      { name: 'Ndedema Dome', elevation: 3085, difficulty: 'moderate' },
      { name: "Dragon's Back", elevation: 3017, difficulty: 'moderate' },
    ],
    trails: [
      {
        id: 'uk-t1',
        name: 'Ndedema Gorge Trail',
        area: 'uKhahlamba-Drakensberg',
        difficulty: 'moderate',
        distance_km: 22,
        elevation_gain_m: 680,
        duration_hours: 9,
        rating: 4.8,
        review_count: 201,
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
        tags: ['Rock Art', 'Gorge', 'Wilderness'],
      },
      {
        id: 'uk-t2',
        name: 'Champagne Castle Approach',
        area: 'Central Berg',
        difficulty: 'expert',
        distance_km: 19,
        elevation_gain_m: 1100,
        duration_hours: 10,
        rating: 4.9,
        review_count: 88,
        image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
        tags: ['Summit', 'Technical', 'Views'],
        is_featured: true,
      },
      {
        id: 'uk-t3',
        name: 'Contour Path — Monk\'s Cowl',
        area: 'Central Berg',
        difficulty: 'moderate',
        distance_km: 12,
        elevation_gain_m: 350,
        duration_hours: 5,
        rating: 4.7,
        review_count: 143,
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
        tags: ['Scenic', 'Contour', 'Birding'],
      },
    ],
    bestTime: 'April–September (dry season). Avoid December–February (afternoon thunderstorms).',
    permits: 'Ezemvelo KZN Wildlife permit required. R200/person/night for overnight hikes. Day visitors R70/person.',
    facilities: ['Campsite', 'Chalets', 'Guided hikes', 'Visitor centre', 'Restaurant', 'Curio shop'],
  },
  {
    id: 'royal-natal',
    name: 'Royal Natal National Park',
    shortName: 'Royal Natal',
    tagline: 'Home of the Amphitheatre · Northern Berg',
    description:
      'Famous for the iconic Amphitheatre — a 5-kilometre curved basalt cliff wall rising 1,200 metres from the valley floor — Royal Natal National Park is arguably the most dramatic landscape in the Drakensberg. Tugela Falls, the world\'s second highest waterfall at 947 metres, plunges from the escarpment in five separate cascades. The park encompasses 8,094 hectares of pristine mountain terrain with exceptional hiking opportunities for all levels.',
    image: 'https://images.unsplash.com/photo-1439853949212-36589f9df9d7?w=1400&q=85',
    viewpointName: 'Thendele Camp Viewpoint',
    latitude: -28.6939,
    longitude: 28.9453,
    peaks: [
      { name: 'The Sentinel', elevation: 3165, difficulty: 'moderate' },
      { name: 'Eastern Buttress', elevation: 3047, difficulty: 'expert' },
      { name: 'Inner Tower', elevation: 2986, difficulty: 'expert' },
      { name: 'Outer Tower', elevation: 3005, difficulty: 'expert' },
    ],
    trails: [
      {
        id: 'rn-t1',
        name: 'Tugela Falls Circuit',
        area: 'Royal Natal National Park',
        difficulty: 'hard',
        distance_km: 14,
        elevation_gain_m: 948,
        duration_hours: 7,
        rating: 4.95,
        review_count: 412,
        image: 'https://images.unsplash.com/photo-1439853949212-36589f9df9d7?w=800&q=80',
        tags: ['Waterfall', 'Iconic', 'Views'],
        is_featured: true,
      },
      {
        id: 'rn-t2',
        name: 'Gorge Trail',
        area: 'Royal Natal National Park',
        difficulty: 'easy',
        distance_km: 9,
        elevation_gain_m: 200,
        duration_hours: 3.5,
        rating: 4.7,
        review_count: 328,
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
        tags: ['Gorge', 'Beginner', 'Swimming'],
      },
      {
        id: 'rn-t3',
        name: 'Sentinel Peak Hike',
        area: 'Royal Natal National Park',
        difficulty: 'moderate',
        distance_km: 12,
        elevation_gain_m: 600,
        duration_hours: 6,
        rating: 4.85,
        review_count: 189,
        image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
        tags: ['Chain Ladders', 'Summit', 'Views'],
      },
    ],
    bestTime: 'May–August (clear skies, dry). Wildflowers in spring (September–November).',
    permits: 'SANParks permit required. R372/adult/day (international). R186/adult/day (SADC). Chalets must be pre-booked.',
    facilities: ['Thendele Camp (chalets)', 'Mahai Campsite', 'Day visitor area', 'Ranger station', 'Nature walks'],
  },
  {
    id: 'giants-castle',
    name: "Giant's Castle Reserve",
    shortName: "Giant's Castle",
    tagline: 'San Rock Art & Bearded Vultures · Central Berg',
    description:
      "Giant's Castle Reserve protects one of the Drakensberg's most significant San rock art sites — the Main Caves shelter contains over 550 individual paintings. The reserve is also the only place in South Africa where the endangered Bearded Vulture (Lammergeier) can be reliably seen, with a supplementary feeding hide drawing these magnificent birds from November to April. At 3,314 metres, Giant's Castle Peak dominates the reserve skyline.",
    image: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=1400&q=85',
    viewpointName: "Giant's Castle Main Camp Viewpoint",
    latitude: -29.2289,
    longitude: 29.4883,
    peaks: [
      { name: "Giant's Castle", elevation: 3314, difficulty: 'expert' },
      { name: 'Cleft Peak', elevation: 3281, difficulty: 'expert' },
      { name: 'Nkosazane', elevation: 3071, difficulty: 'moderate' },
    ],
    trails: [
      {
        id: 'gc-t1',
        name: 'Main Caves Rock Art Trail',
        area: "Giant's Castle Reserve",
        difficulty: 'easy',
        distance_km: 3,
        elevation_gain_m: 80,
        duration_hours: 2,
        rating: 4.8,
        review_count: 276,
        image: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80',
        tags: ['Rock Art', 'Cultural', 'Guided'],
      },
      {
        id: 'gc-t2',
        name: "Giant's Castle Summit Route",
        area: "Giant's Castle Reserve",
        difficulty: 'expert',
        distance_km: 24,
        elevation_gain_m: 1300,
        duration_hours: 12,
        rating: 4.9,
        review_count: 67,
        image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
        tags: ['Summit', 'Overnight', 'Technical'],
        is_featured: true,
      },
      {
        id: 'gc-t3',
        name: 'Lammergeier Hide Trail',
        area: "Giant's Castle Reserve",
        difficulty: 'easy',
        distance_km: 5,
        elevation_gain_m: 150,
        duration_hours: 2.5,
        rating: 4.85,
        review_count: 142,
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
        tags: ['Birding', 'Vulture Hide', 'Wildlife'],
      },
    ],
    bestTime: 'November–April for Bearded Vulture feeding hide. June–August for summit hikes.',
    permits: 'Ezemvelo KZN Wildlife permit. Main Caves guided tour R60/person. Vulture hide bookings essential — R250/person.',
    facilities: ['Giant\'s Castle Camp (chalets)', 'Camping', 'Vulture hide', 'Museum', 'Guided rock art tours', 'Horse trails'],
  },
  {
    id: 'injisuthi',
    name: 'Injisuthi',
    shortName: 'Injisuthi',
    tagline: 'Remote wilderness & Battle Cave · Northern Central Berg',
    description:
      'One of the most remote and least-visited of the major Drakensberg reserves, Injisuthi rewards those who seek it out with pristine wilderness, exceptional San rock art at Battle Cave (over 700 individual figures), and some of the best multi-day hiking in the range. The reserve encompasses the headwaters of the Injisuthi River and offers access to Champagne Castle from the north — a dramatic contrast to the southern approach.',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=85',
    viewpointName: 'Injisuthi Camp Ridge',
    latitude: -29.0372,
    longitude: 29.5214,
    peaks: [
      { name: 'Champagne Castle', elevation: 3377, difficulty: 'expert' },
      { name: 'Rockeries Tower', elevation: 2853, difficulty: 'accessible' },
      { name: 'Outer Tower', elevation: 3005, difficulty: 'expert' },
    ],
    trails: [
      {
        id: 'inj-t1',
        name: 'Battle Cave Trail',
        area: 'Injisuthi',
        difficulty: 'easy',
        distance_km: 6,
        elevation_gain_m: 120,
        duration_hours: 3,
        rating: 4.9,
        review_count: 118,
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
        tags: ['Rock Art', 'Cultural', 'Guided Only'],
      },
      {
        id: 'inj-t2',
        name: 'Injisuthi Contour Path',
        area: 'Injisuthi',
        difficulty: 'easy',
        distance_km: 9,
        elevation_gain_m: 320,
        duration_hours: 3.5,
        rating: 4.7,
        review_count: 164,
        image: 'https://images.unsplash.com/photo-1439853949212-36589f9df9d7?w=800&q=80',
        tags: ['Beginner', 'Views', 'Dog-friendly'],
      },
      {
        id: 'inj-t3',
        name: 'Champagne Castle North Face',
        area: 'Injisuthi',
        difficulty: 'expert',
        distance_km: 26,
        elevation_gain_m: 1450,
        duration_hours: 14,
        rating: 4.95,
        review_count: 34,
        image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
        tags: ['Summit', 'Serious Hike', 'Remote'],
        is_featured: true,
      },
    ],
    bestTime: 'April–October. Very remote — carry all food and fuel. Cell coverage is non-existent.',
    permits: 'Ezemvelo KZN Wildlife permit. Battle Cave guided tour is mandatory R80/person. Book 3 months ahead in peak season.',
    facilities: ['Injisuthi Camp (chalets)', 'Campsite', 'Guided rock art tours', 'Environmental officer on site'],
  },
]

/* ─── Difficulty badge ───────────────────────────────────────────────────── */
const DIFF_COLORS = {
  accessible: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  moderate: { bg: 'bg-amber-100', text: 'text-amber-700' },
  expert: { bg: 'bg-red-100', text: 'text-red-700' },
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function NatureReservesPage() {
  const [selectedId, setSelectedId] = useState<string>(RESERVES[0].id)
  const reserve = RESERVES.find((r) => r.id === selectedId) ?? RESERVES[0]

  return (
    <main className="bg-mist min-h-screen pt-16">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <EditablePageHeader section="reserves_page" subClassName="max-w-2xl" />

      {/* ── Reserve selector ─────────────────────────────────────────────── */}
      <div className="sticky top-16 z-40 bg-white border-b border-black/8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-1">
            {RESERVES.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`shrink-0 font-sans text-sm font-medium px-5 py-3 rounded-lg transition-all duration-200 whitespace-nowrap ${
                  selectedId === r.id
                    ? 'bg-forest text-white'
                    : 'text-forest/60 hover:text-forest hover:bg-forest/5'
                }`}
              >
                {r.shortName}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Reserve content ──────────────────────────────────────────────── */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">

        {/* Reserve header */}
        <div className="mb-10">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-forest mb-2">
            {reserve.name}
          </h2>
          <p className="font-sans text-sage text-sm font-medium mb-5">{reserve.tagline}</p>
          <p className="font-sans text-forest/60 font-light leading-relaxed text-lg max-w-3xl">
            {reserve.description}
          </p>
        </div>

        {/* Panorama viewer */}
        <div className="rounded-3xl overflow-hidden shadow-card-hover mb-16">
          <PanoramaViewer
            spotName={reserve.viewpointName}
            latitude={reserve.latitude}
            longitude={reserve.longitude}
          />
        </div>

        {/* Peaks grid */}
        <div className="mb-16">
          <h3 className="font-display text-3xl font-bold text-forest mb-6">
            Key Peaks
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {reserve.peaks.map((peak) => {
              const dc = DIFF_COLORS[peak.difficulty]
              return (
                <div
                  key={peak.name}
                  className="bg-white rounded-2xl p-5 border border-forest/8 hover:border-gold/50 hover:shadow-gold transition-all duration-200"
                >
                  <div className="w-8 h-0.5 bg-gold mb-3" />
                  <p className="font-display text-lg font-bold text-forest leading-tight mb-1">
                    {peak.name}
                  </p>
                  <p className="font-sans text-gold text-sm font-semibold mb-3">
                    {peak.elevation.toLocaleString()} m
                  </p>
                  <span
                    className={`font-sans text-xs font-medium px-2.5 py-1 rounded-full ${dc.bg} ${dc.text}`}
                  >
                    {peak.difficulty.charAt(0).toUpperCase() + peak.difficulty.slice(1)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Trails */}
        <div className="mb-16">
          <div className="flex items-end justify-between mb-6">
            <h3 className="font-display text-3xl font-bold text-forest">
              Trails in {reserve.shortName}
            </h3>
            <Link
              href="/hikes"
              className="font-sans text-sm font-medium text-sage hover:text-forest transition-colors"
            >
              View all hikes →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reserve.trails.map((trail) => (
              <TrailCard key={trail.id} trail={trail} />
            ))}
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Best time */}
          <div className="bg-forest rounded-2xl p-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center">
                <Sunrise className="h-5 w-5 text-gold" />
              </div>
              <p className="font-sans text-xs font-semibold tracking-widest uppercase text-white/40">Best Time to Visit</p>
            </div>
            <p className="font-sans text-white/70 text-sm leading-relaxed">{reserve.bestTime}</p>
          </div>

          {/* Permits */}
          <div className="bg-forest rounded-2xl p-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-gold" />
              </div>
              <p className="font-sans text-xs font-semibold tracking-widest uppercase text-white/40">Permits & Fees</p>
            </div>
            <p className="font-sans text-white/70 text-sm leading-relaxed">{reserve.permits}</p>
          </div>

          {/* Facilities */}
          <div className="bg-forest rounded-2xl p-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center">
                <Info className="h-5 w-5 text-gold" />
              </div>
              <p className="font-sans text-xs font-semibold tracking-widest uppercase text-white/40">Facilities</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {reserve.facilities.map((f) => (
                <span
                  key={f}
                  className="font-sans text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 text-white/70"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}

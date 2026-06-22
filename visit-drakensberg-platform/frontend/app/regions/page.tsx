import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Footer from '@/components/layout/Footer'

const REGIONS = [
  {
    id: 'northern',
    name: 'Northern Berg',
    subtitle: 'Royal Natal National Park · Amphitheatre',
    desc: 'The Amphitheatre — a 5 km sheer basalt cliff — anchors the Northern Berg. The Tugela River drops 948 metres over five falls here, making it the second highest waterfall on Earth. Royal Natal National Park offers some of the most dramatic scenery in Africa.',
    highlights: ['Tugela Falls Circuit', 'Amphitheatre via Chain Ladder', 'Policemans Helmet', 'Mont-aux-Sources'],
    img: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=1200&q=85',
    accentImg: 'https://images.unsplash.com/photo-1542587222-e14b891ee40b?w=600&q=80',
    stay: '/stays?region=northern',
    hike: '/hikes?region=northern',
  },
  {
    id: 'central',
    name: 'Central Berg',
    subtitle: 'Cathedral Peak · Giants Castle · Champagne Valley',
    desc: 'Cathedral Peak rises to 3,004 m at the heart of the Central Berg, surrounded by the richest concentration of San rock art in the world. Giants Castle Game Reserve protects bearded vultures and herds of eland against a backdrop of jagged peaks.',
    highlights: ['Cathedral Peak Summit', 'Giants Castle Hike', 'Injasuti Cave', 'Champagne Castle'],
    img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1200&q=85',
    accentImg: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600&q=80',
    stay: '/stays?region=central',
    hike: '/hikes?region=central',
  },
  {
    id: 'southern',
    name: 'Southern Berg',
    subtitle: 'Sani Pass · Mkhomazi · Underberg',
    desc: 'The Sani Pass climbs 1,332 m in 9 km through a series of hairpin bends carved into the escarpment, crossing into the mountain Kingdom of Lesotho at 2,873 m. The Mkhomazi Wilderness Area below is one of the least visited and most pristine parts of the berg.',
    highlights: ['Sani Pass 4x4', 'Mkhomazi Wilderness', 'Garden Castle', 'Mzimkhulu Gorge'],
    img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=85',
    accentImg: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80',
    stay: '/stays?region=southern',
    hike: '/hikes?region=southern',
  },
]

export const metadata = {
  title: 'Regions — Visit Drakensberg',
  description: 'Explore the Northern, Central and Southern Drakensberg — three distinct alpine worlds.',
}

export default function RegionsPage() {
  return (
    <main className="bg-mist pt-16">
      {/* Header */}
      <section className="bg-forest text-white py-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-4">Where to go</p>
          <h1 className="font-display text-5xl lg:text-7xl text-white leading-none mb-6">
            Choose your Berg
          </h1>
          <p className="font-sans text-base text-white/50 max-w-xl leading-relaxed">
            The Drakensberg stretches 200 km through KwaZulu-Natal. Each region has its own character, wildlife and network of trails.
          </p>
        </div>
      </section>

      {/* Region sections */}
      {REGIONS.map((r, i) => (
        <section key={r.id} id={r.id} className={`py-20 ${i % 2 === 0 ? 'bg-white' : 'bg-mist'}`}>
          <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
            <div className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${i % 2 === 1 ? 'lg:[direction:rtl]' : ''}`}>
              {/* Images */}
              <div className="relative [direction:ltr]">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={r.img} alt={r.name} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-6 -right-4 w-48 h-36 overflow-hidden border-4 border-white shadow-card hidden md:block">
                  <img src={r.accentImg} alt="" className="w-full h-full object-cover" />
                </div>
              </div>

              {/* Text */}
              <div className="[direction:ltr]">
                <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-3">{r.subtitle}</p>
                <h2 className="font-display text-4xl lg:text-5xl text-forest mb-6">{r.name}</h2>
                <p className="font-sans text-base text-forest/60 leading-relaxed mb-8">{r.desc}</p>

                <div className="mb-8">
                  <p className="font-sans text-xs tracking-[0.15em] uppercase text-forest/30 mb-3">Highlights</p>
                  <ul className="space-y-2">
                    {r.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-3 font-sans text-sm text-forest/70">
                        <span className="w-1 h-1 rounded-full bg-gold" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-4">
                  <Link href={r.stay} className="font-sans text-sm px-5 py-2.5 bg-forest text-white hover:bg-sage transition-colors">
                    Browse Stays
                  </Link>
                  <Link href={r.hike} className="font-sans text-sm px-5 py-2.5 border border-forest text-forest hover:bg-forest hover:text-white transition-colors inline-flex items-center gap-2">
                    View Hikes <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      <Footer />
    </main>
  )
}

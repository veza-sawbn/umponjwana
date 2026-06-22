import Link from 'next/link'
import Footer from '@/components/layout/Footer'

const FEATURED = {
  tag: 'Adventure',
  title: 'Five days on the Drakensberg Grand Traverse',
  excerpt: 'The Grand Traverse is one of the great mountain routes in Africa — 65 kilometres of high escarpment between the Sentinel car park and the Garden Castle. We went in winter.',
  img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1400&q=85',
  date: 'November 2024',
  readTime: '12 min read',
  href: '/stories/grand-traverse',
}

const ARTICLES = [
  {
    tag: 'Wildlife',
    title: 'The bearded vulture — rarest raptor in Southern Africa',
    excerpt: 'Giants Castle is one of the last strongholds of the Lammergeier. We spent three days at the hide.',
    img: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80',
    date: 'March 2025',
    readTime: '8 min read',
    href: '/stories/bearded-vulture',
  },
  {
    tag: 'Culture',
    title: 'Reading the rock: San art and the spirit world',
    excerpt: 'More than 35,000 individual San rock paintings survive in the Drakensberg. A guide to understanding what you\'re looking at.',
    img: 'https://images.unsplash.com/photo-1529946179074-1f3cf40c0a0e?w=800&q=80',
    date: 'January 2025',
    readTime: '10 min read',
    href: '/stories/san-rock-art',
  },
  {
    tag: 'Travel',
    title: 'The Sani Pass in a day — what to know',
    excerpt: 'At 2,873 m the Sani Pass is the highest mountain pass in South Africa. Here\'s how to do it safely.',
    img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
    date: 'October 2024',
    readTime: '7 min read',
    href: '/stories/sani-pass',
  },
  {
    tag: 'Nature',
    title: 'Proteas and pincushions — the floral kingdom of the Berg',
    excerpt: 'The high altitude grasslands of the Drakensberg support over 2,150 plant species, many found nowhere else on Earth.',
    img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=800&q=80',
    date: 'September 2024',
    readTime: '6 min read',
    href: '/stories/flora',
  },
  {
    tag: 'Adventure',
    title: 'Abseiling the Amphitheatre — 200 metres of free air',
    excerpt: 'The Chain Ladder is the conventional descent. Abseiling is the other option. We chose the ropes.',
    img: 'https://images.unsplash.com/photo-1542587222-e14b891ee40b?w=800&q=80',
    date: 'August 2024',
    readTime: '5 min read',
    href: '/stories/abseil',
  },
  {
    tag: 'Food',
    title: 'Where to eat on the way to the Berg',
    excerpt: 'The N3 from Johannesburg to the Drakensberg passes through Harrismith and Mooi River — here are the stops worth making.',
    img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    date: 'July 2024',
    readTime: '4 min read',
    href: '/stories/food',
  },
]

export const metadata = {
  title: 'Stories — Visit Drakensberg',
  description: 'Editorial dispatches from the Drakensberg escarpment.',
}

export default function StoriesPage() {
  return (
    <main className="bg-white pt-16">
      {/* Header */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16 border-b border-black/8">
        <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/30 mb-4">Journal</p>
        <h1 className="font-display text-5xl lg:text-7xl text-forest leading-none">
          Stories from<br />the Berg
        </h1>
      </section>

      {/* Featured article */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-14">
        <Link href={FEATURED.href} className="group grid lg:grid-cols-2 gap-0 items-stretch">
          <div className="overflow-hidden aspect-[4/3] lg:aspect-auto">
            <img
              src={FEATURED.img}
              alt={FEATURED.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-103"
            />
          </div>
          <div className="bg-mist p-10 lg:p-16 flex flex-col justify-center">
            <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-4">
              {FEATURED.tag} · {FEATURED.date} · {FEATURED.readTime}
            </p>
            <h2 className="font-display text-3xl lg:text-4xl text-forest leading-snug mb-6 group-hover:text-sage transition-colors">
              {FEATURED.title}
            </h2>
            <p className="font-sans text-sm text-forest/55 leading-relaxed mb-8">{FEATURED.excerpt}</p>
            <span className="font-sans text-sm text-forest inline-flex items-center gap-2 group-hover:gap-3 transition-all">
              Read the story →
            </span>
          </div>
        </Link>
      </section>

      {/* Article grid */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-20">
        <div className="h-px bg-black/8 mb-14" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
          {ARTICLES.map((a) => (
            <Link key={a.href} href={a.href} className="group block">
              <div className="overflow-hidden aspect-[3/2] mb-5">
                <img
                  src={a.img}
                  alt={a.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-2">
                {a.tag} · {a.date}
              </p>
              <h3 className="font-display text-xl text-forest leading-snug mb-3 group-hover:text-sage transition-colors">
                {a.title}
              </h3>
              <p className="font-sans text-sm text-forest/50 leading-relaxed line-clamp-2">{a.excerpt}</p>
              <p className="font-sans text-xs text-forest/30 mt-3">{a.readTime}</p>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  )
}

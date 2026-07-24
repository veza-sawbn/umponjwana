'use client'

import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import { Clock, ArrowLeft, MapPin, Mountain, Bird, ChefHat, Sword, Leaf, ArrowRight } from 'lucide-react'

const ARTICLES: Record<string, {
  slug: string
  title: string
  excerpt: string
  category: string
  author: string
  authorRole: string
  authorBio: string
  readTime: string
  image: string
  body: { heading?: string; text: string }[]
  relatedListings: { title: string; type: string; href: string; image: string; location: string }[]
  relatedArticles: { slug: string; title: string; category: string; image: string }[]
}> = {
  'san-bushmen-rock-art-giants-castle': {
    slug: 'san-bushmen-rock-art-giants-castle',
    title: "The Ancient Language of the San: Rock Art at Giant's Castle",
    excerpt: "Over 5,000 individual paintings document the spiritual world of the San Bushmen who once called the Drakensberg home.",
    category: 'Heritage',
    author: 'Lerato Sithole',
    authorRole: 'Heritage Guide & Historian',
    authorBio: "Lerato has guided visitors through the Drakensberg's cultural heritage sites for over 15 years. She holds a Master's degree in African Heritage Studies from the University of KwaZulu-Natal and consults for Ezemvelo KZN Wildlife on San rock art preservation.",
    readTime: '8 min',
    image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1400&q=90',
    body: [
      { text: "The ochre hands reach out from the overhang — some overlapping, some isolated, pressed flat against the sandstone in a gesture that crosses twelve thousand years. You stand at the entrance of the Main Caves at Giant's Castle and feel immediately that you are in the presence of something that demands silence." },
      { heading: 'A Living Cosmology', text: "The San did not draw on cave walls to record hunts or document fauna, though the paintings are full of eland, rhino, and hartebeest. These images are windows into a shamanistic belief system of extraordinary complexity. The eland — the largest antelope in Africa — was considered the most sacred animal, the one most associated with the spirit world and with the potency of the trance dance." },
      { text: "When a San shaman entered a trance state, induced through hours of rhythmic dancing and hyperventilation, they believed they were crossing into the spirit world. What they experienced there — the sense of flight, of transformation, of encountering supernatural creatures — they painted on rock upon returning. The paintings are therefore not representations of the physical world but records of spiritual experience." },
      { heading: "5,000 Paintings and One Site", text: "Giant's Castle is among the finest repositories of San rock art in Southern Africa. The Main Caves site alone contains over 500 individual images, while the broader reserve encompasses several thousand more across dozens of sites. The paintings span at least 3,000 years of continuous occupation." },
      { text: "The colours — red-brown ochre, white kaolin, black manganese oxide — have survived millennia in the sheltered overhangs. The San ground these pigments with animal fat and applied them with their fingers, sticks, or bundles of animal hair. The result is a mark of extraordinary intimacy: you are looking at the direct contact of a human hand against stone." },
      { heading: 'Visiting Responsibly', text: "The Main Caves are accessible only with a guide from Giant's Castle Rest Camp. Touch nothing. The oils from human skin accelerate deterioration of the pigments. Flash photography is prohibited. These are not rules designed to inconvenience visitors — they are the minimum conditions for preserving something irreplaceable." },
      { text: "Go in the morning. The low angle of light reveals detail invisible at midday. The guides at Giant's Castle are, without exception, extraordinarily knowledgeable, and a slow walk through the site with one of them will reshape your understanding of what it means to be human in southern Africa." },
    ],
    relatedListings: [
      { title: "Giant's Castle Rest Camp", type: 'Stay', href: '/stays', image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400&q=80', location: "Giant's Castle, Central Berg" },
      { title: 'San Rock Art Full-Day Tour', type: 'Activity', href: '/activities', image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80', location: "Giant's Castle" },
    ],
    relatedArticles: [
      { slug: 'battle-of-isandlwana-history', title: "Shadow of the Berg: The Anglo-Zulu War's Hidden History", category: 'History', image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=400&q=80' },
      { slug: 'zulu-cuisine-foothills', title: 'Eating in the Foothills: A Guide to Zulu Cuisine', category: 'Cuisine', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80' },
      { slug: 'conservation-umdoni-wetlands', title: 'Saving the Umdoni Wetlands: Conservation at the Edge', category: 'Conservation', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
    ],
  },
  'tugela-falls-chain-ladder-guide': {
    slug: 'tugela-falls-chain-ladder-guide',
    title: 'Climbing the Chain Ladder: What Nobody Tells You',
    excerpt: "The iconic iron rungs fixed into the sheer basalt face of the Amphitheatre. An honest account of what to expect.",
    category: 'Hiking Stories',
    author: 'Sipho Dlamini',
    authorRole: 'FGASA Mountain Guide',
    authorBio: "Sipho is a registered FGASA Level 3 guide with 20 years of experience leading hikes in the uKhahlamba-Drakensberg Park. He has summited the Amphitheatre via the Chain Ladder over 400 times and holds the route record for the Tugela Falls Circuit.",
    readTime: '6 min',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1400&q=90',
    body: [
      { text: "Nobody tells you how exposed it is until you are on it. The Chain Ladder at the Amphitheatre is 30 metres of near-vertical iron rungs bolted into basalt, with nothing below you but a 600-metre drop into the Royal Natal National Park. The wind usually arrives without warning. Your hands will be cold." },
      { heading: 'What the Photos Miss', text: "Every image of the Chain Ladder is taken from below, which makes it look manageable — a short scramble to a ledge. This is a deception. The ladder is set against a rock face that angles outward at its top section, meaning that by the end you are leaning back against nothing but your grip and the mountain's geometry. People with a mild fear of heights have done it fine. People who thought they had no fear of heights have discovered otherwise." },
      { heading: 'The Practical Details', text: "The hike from the Sentinel car park to the base of the Chain Ladder is 4km and takes roughly 90 minutes on the well-maintained path. The ladder itself takes between 20 and 45 minutes depending on congestion and conditions. A second, shorter ladder immediately follows the first. Above the ladders, the plateau opens into the Lesotho highveld — one of the most extraordinary landscapes on the continent." },
      { text: "Tugela Falls, the world's second-highest waterfall at 948 metres, is a 20-minute walk from the top of the ladders. In winter it freezes entirely. In summer after heavy rain it is a white thundering column visible from 30km away. Either way, you will not be prepared for it." },
      { heading: 'Start at 05:00', text: "The Sentinel car park fills by 08:00 on weekends. The Chain Ladder bottlenecks badly when both ascending and descending hikers meet on the rungs. Start before dawn, use a headlamp for the first section, and you will have the ladders to yourself. The sunrise from the Amphitheatre rim, looking east over KwaZulu-Natal, is among the finest views in Africa." },
    ],
    relatedListings: [
      { title: 'Tendele Tented Camp', type: 'Stay', href: '/stays', image: 'https://images.unsplash.com/photo-1533873984035-25970ab07461?w=400&q=80', location: 'Royal Natal National Park' },
      { title: 'Guided Rock Climbing', type: 'Activity', href: '/activities', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', location: 'Amphitheatre' },
    ],
    relatedArticles: [
      { slug: 'bearded-vulture-lammergeier', title: "Africa's Rarest Raptor: The Bearded Vulture of the Berg", category: 'Wildlife', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80' },
      { slug: 'conservation-umdoni-wetlands', title: 'Saving the Umdoni Wetlands: Conservation at the Edge', category: 'Conservation', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
      { slug: 'san-bushmen-rock-art-giants-castle', title: "The Ancient Language of the San: Rock Art at Giant's Castle", category: 'Heritage', image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80' },
    ],
  },
  'bearded-vulture-lammergeier': {
    slug: 'bearded-vulture-lammergeier',
    title: "Africa's Rarest Raptor: The Bearded Vulture of the Berg",
    excerpt: "The lammergeier — bone-breaker — is one of the most extraordinary birds on the planet. The Drakensberg is its last South African stronghold.",
    category: 'Wildlife',
    author: 'Anele Mokoena',
    authorRole: 'Birding & Flora Specialist',
    authorBio: "Anele has led specialist birding tours in the Drakensberg for 12 years and has contributed to Ezemvelo KZN Wildlife's bearded vulture monitoring programme. She is a registered field guide and bird ringers' assistant with Birds South Africa.",
    readTime: '5 min',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1400&q=90',
    body: [
      { text: "The bearded vulture — Gypaetus barbatus, the lammergeier, the bone-breaker — is not like other vultures. It does not gather with the mob at carcasses. It waits. When the other scavengers have stripped everything they can, the bearded vulture descends and takes what remains: the bones. Then it carries them aloft, sometimes to 200 metres, and drops them onto flat rocks to crack them and access the marrow." },
      { heading: 'The Last Stronghold', text: "The uKhahlamba-Drakensberg Park holds the only self-sustaining population of bearded vultures in Southern Africa — approximately 200 individuals, down from an estimated 600 a century ago. Poisoning (both deliberate and accidental, from poisoned carcasses set for jackals), collision with power lines, and disturbance at nest sites have reduced them to this remnant." },
      { heading: 'Where to Find One', text: "Sani Pass and the high ridge above Giant's Castle offer the best chances. The birds are most active in the early morning and late afternoon. They soar the high thermals over the escarpment and are unmistakeable in flight: a 2.8-metre wingspan, rusty-orange underparts stained by iron-oxide mud the birds deliberately apply to their plumage, and the distinctive wedge-shaped tail that separates them from all other large raptors." },
      { text: "In the breeding season (May–August), pairs display together over the escarpment ridge — long, slow, parallel soaring flights that can last hours. Nest sites are on inaccessible cliff ledges; if you see a large bird repeatedly visiting a particular section of cliff between May and August, watch from a distance and do not approach." },
    ],
    relatedListings: [
      { title: "Giant's Castle Rest Camp", type: 'Stay', href: '/stays', image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400&q=80', location: "Giant's Castle, Central Berg" },
      { title: 'Berg Photography Tour', type: 'Activity', href: '/activities', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80', location: 'Northern Berg' },
    ],
    relatedArticles: [
      { slug: 'conservation-umdoni-wetlands', title: 'Saving the Umdoni Wetlands: Conservation at the Edge', category: 'Conservation', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
      { slug: 'tugela-falls-chain-ladder-guide', title: 'Climbing the Chain Ladder: What Nobody Tells You', category: 'Hiking Stories', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80' },
      { slug: 'san-bushmen-rock-art-giants-castle', title: "The Ancient Language of the San: Rock Art at Giant's Castle", category: 'Heritage', image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80' },
    ],
  },
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Heritage: <Mountain size={12} />,
  Wildlife: <Bird size={12} />,
  Cuisine: <ChefHat size={12} />,
  History: <Sword size={12} />,
  Conservation: <Leaf size={12} />,
  'Hiking Stories': <Mountain size={12} />,
}

export default function ArticleDetailPage() {
  const params = useParams()
  const slug = typeof params.slug === 'string' ? params.slug : Array.isArray(params.slug) ? params.slug[0] : ''
  const article = ARTICLES[slug]
  if (!article) notFound()

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      {/* Hero */}
      <section className="bg-[#000000] text-white pt-32 pb-0">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-12">
          <Link href="/mydrakensberg" className="inline-flex items-center gap-2 font-sans text-xs text-white/40 hover:text-white transition-colors mb-8">
            <ArrowLeft size={12} />
            Back to Stories
          </Link>
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1.5 font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E]">
              {CATEGORY_ICONS[article.category]}
              {article.category}
            </span>
          </div>
          <h1 className="font-display italic text-5xl lg:text-7xl mb-8 max-w-4xl leading-tight">{article.title}</h1>
          <p className="font-sans text-lg text-white/50 max-w-2xl leading-relaxed mb-10">{article.excerpt}</p>
          <div className="flex items-center gap-6 pb-12 border-b border-white/10">
            <div>
              <p className="font-sans text-sm font-medium text-white">{article.author}</p>
              <p className="font-sans text-xs text-white/40">{article.authorRole}</p>
            </div>
            <span className="font-sans text-xs text-white/30 flex items-center gap-1.5">
              <Clock size={11} />
              {article.readTime} read
            </span>
          </div>
        </div>

        {/* Hero image */}
        <div className="w-full h-[50vh] lg:h-[60vh] overflow-hidden">
          <img src={article.image} alt={article.title} className="w-full h-full object-cover opacity-80" />
        </div>
      </section>

      {/* Content */}
      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Article body */}
          <div className="lg:col-span-2">
            <div className="prose prose-lg max-w-none">
              {article.body.map((block, i) => (
                <div key={i} className="mb-6">
                  {block.heading && (
                    <h2 className="font-display italic text-2xl text-[#000000] mb-3">{block.heading}</h2>
                  )}
                  <p className="font-sans text-base text-gray-700 leading-relaxed">{block.text}</p>
                </div>
              ))}
            </div>

            {/* Related articles */}
            <div className="mt-14 pt-10 border-t border-gray-200">
              <h3 className="font-display italic text-2xl text-[#000000] mb-6">More Stories</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {article.relatedArticles.map(rel => (
                  <Link key={rel.slug} href={`/mydrakensberg/${rel.slug}`} className="group bg-white border border-gray-200 overflow-hidden hover:border-[#2d6a4f] transition-colors">
                    <div className="h-36 overflow-hidden">
                      <img src={rel.image} alt={rel.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="p-4">
                      <span className="font-sans text-[10px] tracking-[0.14em] uppercase text-[#C9A96E] mb-2 block">{rel.category}</span>
                      <p className="font-display italic text-base text-[#000000] leading-tight group-hover:text-[#2d6a4f] transition-colors">{rel.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">

            {/* Author card */}
            <div className="bg-white border border-gray-200 p-6">
              <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-gray-400 block mb-4">About the Author</span>
              <p className="font-display italic text-xl text-[#000000] mb-0.5">{article.author}</p>
              <p className="font-sans text-xs text-[#C9A96E] mb-4">{article.authorRole}</p>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">{article.authorBio}</p>
            </div>

            {/* Plan your visit */}
            <div className="bg-[#000000] text-white p-6">
              <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] block mb-4">Plan Your Visit</span>
              <p className="font-display italic text-xl mb-5">Listings mentioned in this article</p>
              <div className="space-y-3">
                {article.relatedListings.map(listing => (
                  <Link key={listing.href} href={listing.href} className="group flex gap-3 border border-white/10 hover:border-[#C9A96E] transition-colors p-3">
                    <div className="w-16 h-16 shrink-0 overflow-hidden">
                      <img src={listing.image} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-sans text-[10px] tracking-[0.12em] uppercase text-[#C9A96E]">{listing.type}</span>
                      <p className="font-display italic text-base text-white leading-tight mt-0.5">{listing.title}</p>
                      <p className="font-sans text-xs text-white/40 flex items-center gap-1 mt-1"><MapPin size={9} />{listing.location}</p>
                    </div>
                    <ArrowRight size={14} className="shrink-0 text-white/20 group-hover:text-[#C9A96E] transition-colors self-center ml-auto" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Explore MyDrakensberg */}
            <div className="bg-white border border-gray-200 p-6">
              <p className="font-display italic text-lg text-[#000000] mb-3">More from MyDrakensberg</p>
              <p className="font-sans text-sm text-gray-500 mb-4">In-depth writing on culture, history, wildlife and landscapes from people who know the Berg deeply.</p>
              <Link href="/mydrakensberg" className="inline-flex items-center gap-2 font-sans text-sm text-[#2d6a4f] hover:underline">
                Browse all stories <ArrowRight size={13} />
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}

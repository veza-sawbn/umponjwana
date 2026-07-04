'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import { CheckCircle, Star, MapPin, ArrowLeft } from 'lucide-react'

const GUIDES: Record<string, any> = {
  g1: { full_name: 'Sipho Dlamini', bio: 'Born and raised in the shadow of the Drakensberg, Sipho has spent 15 years guiding across the full escarpment. He holds a FGASA Level 3 certificate and has led expeditions as far north as the Royal Natal and as far south as Mkhomazi. Sipho is known for his encyclopaedic knowledge of San rock art and his ability to bring the ancient stories to life in the field.', languages: ['English', 'Zulu', 'Sotho'], specialties: ['Rock climbing', 'Birding', 'San rock art', 'Multi-day traverses'], certificate_number: 'FGASA-****-3', guide_number: 'TBCSA-G-0091', color: 'bg-[#2d6a4f]', initials: 'SD', member_since: '2019', rating: 4.9, review_count: 87 },
  g2: { full_name: 'Anele Mokoena', bio: 'Anele is a passionate conservationist with a deep love for the endemic flora of the Drakensberg. She completed her Botanical Society training and has since led hundreds of wildflower identification walks across the Central Berg. Her calm, patient approach makes her ideal for family groups and photography enthusiasts.', languages: ['English', 'Xhosa'], specialties: ['Day hikes', 'Wildflower identification', 'Photography'], certificate_number: 'FGASA-****-2', guide_number: 'TBCSA-G-0144', color: 'bg-[#4A7251]', initials: 'AM', member_since: '2021', rating: 4.8, review_count: 54 },
  g3: { full_name: 'Thabo Ndlovu', bio: 'A former park ranger who turned his skills into a guiding career, Thabo specialises in multi-day wilderness traverses and survival skills. His experience as a ranger gives him an unmatched understanding of animal behaviour and weather patterns in the high Berg.', languages: ['English', 'Zulu', 'Afrikaans'], specialties: ['Multi-day hikes', 'Survival skills', 'Wildlife tracking'], certificate_number: 'FGASA-****-3', guide_number: 'TBCSA-G-0203', color: 'bg-[#8B4513]', initials: 'TN', member_since: '2020', rating: 4.9, review_count: 112 },
}

const REVIEWS = [
  { name: 'Sarah T.', rating: 5, date: 'June 2026', comment: 'Absolutely incredible experience. Our guide was knowledgeable, safety-conscious and genuinely passionate about sharing the Berg. Would book again in a heartbeat.' },
  { name: 'James F.', rating: 5, date: 'May 2026', comment: 'Learned more about San rock art in one day than I have in years of reading. The guide found sites I never would have discovered on my own.' },
  { name: 'Priya N.', rating: 4, date: 'April 2026', comment: 'Wonderful birding walk. Spotted 34 species including the bearded vulture. Very professional and well-organised from start to finish.' },
]

const OFFERED_ACTIVITIES = [
  { title: 'Guided San Rock Art Tour', location: "Giant's Castle", duration: '1 day', price: 620 },
  { title: 'Amphitheatre Summit Experience', location: 'Royal Natal', duration: '6–8 hrs', price: 480 },
  { title: 'Birding & Berg Walk', location: 'Cathedral Peak', duration: '4 hrs', price: 320 },
]

export default function GuideProfilePage() {
  const { id } = useParams() as { id: string }
  const guide = GUIDES[id] || GUIDES['g1']

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      <section className={`${guide.color} text-white py-20 px-6 lg:px-12 mt-16`}>
        <div className="max-w-[1440px] mx-auto">
          <Link href="/guides" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={16} /> All Guides
          </Link>
          <div className="flex items-end gap-8">
            <div className="w-24 h-24 bg-white/10 flex items-center justify-center shrink-0">
              <span className="font-display italic text-4xl text-white/50">{guide.initials}</span>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-display italic text-4xl lg:text-5xl">{guide.full_name}</h1>
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 font-sans text-xs text-white">
                  <CheckCircle size={12} /> Verified Guide
                </span>
              </div>
              <div className="flex items-center gap-4 font-sans text-sm text-white/70">
                <span>★ {guide.rating} <span className="text-white/40">({guide.review_count} reviews)</span></span>
                <span>Member since {guide.member_since}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            {/* Bio */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">About</h2>
              <p className="font-sans text-gray-700 leading-relaxed">{guide.bio}</p>
            </div>

            {/* Languages & Specialties */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-3">Languages</h3>
                <div className="flex flex-wrap gap-2">
                  {guide.languages.map((l: string) => <span key={l} className="bg-[#F7F5F2] border border-gray-200 px-3 py-1.5 font-sans text-sm">{l}</span>)}
                </div>
              </div>
              <div>
                <h3 className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-3">Specialties</h3>
                <div className="flex flex-wrap gap-2">
                  {guide.specialties.map((s: string) => <span key={s} className="bg-[#C9A96E]/10 text-[#2d6a4f] px-3 py-1.5 font-sans text-sm">{s}</span>)}
                </div>
              </div>
            </div>

            {/* Certification */}
            <div className="bg-[#2d6a4f]/5 border border-[#2d6a4f]/20 p-6">
              <h3 className="font-display italic text-lg text-[#2d6a4f] mb-4">Certifications & Registration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">FGASA Certificate</p>
                  <p className="font-sans text-sm font-medium">{guide.certificate_number}</p>
                </div>
                <div>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">TBCSA Guide Number</p>
                  <p className="font-sans text-sm font-medium">{guide.guide_number}</p>
                </div>
              </div>
              <p className="font-sans text-xs text-gray-500 mt-3">Certificate numbers are partially masked for security. Full verification available on request.</p>
            </div>

            {/* Reviews */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display italic text-2xl text-[#000000]">Guest Reviews</h2>
                <div className="flex items-center gap-2">
                  <Star size={18} className="text-[#C9A96E] fill-[#C9A96E]" />
                  <span className="font-display italic text-xl">{guide.rating}</span>
                  <span className="font-sans text-sm text-gray-400">({guide.review_count} reviews)</span>
                </div>
              </div>
              <div className="space-y-5">
                {REVIEWS.map((r, i) => (
                  <div key={i} className="bg-white border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f]">{r.name[0]}</div>
                        <div>
                          <p className="font-sans text-sm font-medium">{r.name}</p>
                          <p className="font-sans text-xs text-gray-400">{r.date}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: r.rating }).map((_, j) => <Star key={j} size={12} className="text-[#C9A96E] fill-[#C9A96E]" />)}
                      </div>
                    </div>
                    <p className="font-sans text-sm text-gray-700 leading-relaxed">{r.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-[#2d6a4f] text-white p-6">
              <h3 className="font-display italic text-xl mb-4">Book with {guide.full_name.split(' ')[0]}</h3>
              <p className="font-sans text-sm text-white/70 mb-6">Choose an experience below and secure your spot on the next available date.</p>
              <Link href="/activities" className="block text-center bg-[#C9A96E] text-[#2d2d2d] py-3 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors">
                Browse Experiences →
              </Link>
            </div>

            <div>
              <h3 className="font-display italic text-xl text-[#000000] mb-4">Offered Experiences</h3>
              <div className="space-y-3">
                {OFFERED_ACTIVITIES.map(act => (
                  <div key={act.title} className="bg-white border border-gray-200 p-4">
                    <h4 className="font-display italic text-lg mb-1">{act.title}</h4>
                    <div className="flex items-center gap-2 text-xs font-sans text-gray-500 mb-3">
                      <MapPin size={11} /> {act.location} · {act.duration}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="font-display italic text-xl text-[#2d6a4f]">R {act.price}</p>
                      <Link href="/activities" className="font-sans text-xs text-[#2d6a4f] hover:underline">Book →</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

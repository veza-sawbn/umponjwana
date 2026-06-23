'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { CheckCircle, Filter } from 'lucide-react'

const GUIDES = [
  { id: 'g1', full_name: 'Sipho Dlamini', bio: 'Born and raised in the shadow of the Drakensberg, Sipho has guided for over 15 years across the full range.', languages: ['English', 'Zulu', 'Sotho'], specialties: ['Rock climbing', 'Birding', 'San rock art'], guide_number: 'TBCSA-G-0091', initials: 'SD', color: 'bg-[#2d6a4f]' },
  { id: 'g2', full_name: 'Anele Mokoena', bio: 'Passionate conservationist and wildflower expert. Anele leads day hikes focused on the endemic flora of the Berg.', languages: ['English', 'Xhosa'], specialties: ['Day hikes', 'Wildflower identification', 'Photography'], guide_number: 'TBCSA-G-0144', initials: 'AM', color: 'bg-[#4A7251]' },
  { id: 'g3', full_name: 'Thabo Ndlovu', bio: 'Former park ranger turned guide. Thabo specialises in multi-day traverses and wilderness survival.', languages: ['English', 'Zulu', 'Afrikaans'], specialties: ['Multi-day hikes', 'Survival skills', 'Wildlife tracking'], guide_number: 'TBCSA-G-0203', initials: 'TN', color: 'bg-[#8B4513]' },
  { id: 'g4', full_name: 'Lerato Sithole', bio: 'A San rock art scholar and qualified heritage guide. Lerato brings ancient stories to life at every site she visits.', languages: ['English', 'Sotho', 'Zulu'], specialties: ['San rock art', 'Heritage tours', 'Cultural history'], guide_number: 'TBCSA-G-0312', initials: 'LS', color: 'bg-[#1a1a2e]' },
  { id: 'g5', full_name: 'Bongani Khumalo', bio: 'Mountain biker and adventure guide with deep knowledge of the Drakensberg foothills and escarpment routes.', languages: ['English', 'Zulu'], specialties: ['Mountain biking', 'Abseiling', 'Rock climbing'], guide_number: 'TBCSA-G-0445', initials: 'BK', color: 'bg-[#c0392b]' },
  { id: 'g6', full_name: 'Nomvula Zwane', bio: 'Specialist birding guide with a life list of over 800 species. Expert in the endemic birds of the Drakensberg.', languages: ['English', 'Zulu', 'Sotho', 'Swazi'], specialties: ['Birding', 'Nature walks', 'Wildlife photography'], guide_number: 'TBCSA-G-0567', initials: 'NZ', color: 'bg-[#C9A96E]' },
]

const SPECIALTIES = ['All', 'Hiking', 'Rock climbing', 'Birding', 'San rock art', 'Photography']

export default function GuidesPage() {
  const [filter, setFilter] = useState('All')

  const filtered = filter === 'All' ? GUIDES : GUIDES.filter(g =>
    g.specialties.some(s => s.toLowerCase().includes(filter.toLowerCase()))
  )

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#2d6a4f] text-white py-20 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-4">Expert Local Knowledge</p>
          <h1 className="font-display italic text-5xl lg:text-6xl mb-4">Meet Your Guides</h1>
          <p className="font-sans text-lg text-white/70 max-w-2xl">
            Every guide on Visit Drakensberg holds a FGASA certificate and a TBCSA guide registration number, verified by our team before they lead a single experience.
          </p>
        </div>
      </section>

      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-4 flex items-center gap-3 overflow-x-auto">
          <Filter size={14} className="text-gray-400 shrink-0" />
          {SPECIALTIES.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 font-sans text-sm whitespace-nowrap transition-colors ${filter === s ? 'bg-[#2d6a4f] text-white' : 'border border-gray-300 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f]'}`}
            >
              {s}
            </button>
          ))}
          <span className="ml-auto font-sans text-sm text-gray-400 shrink-0">{filtered.length} guide{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map(guide => (
            <div key={guide.id} className="bg-white border border-gray-200 group">
              <div className={`${guide.color} aspect-[4/3] flex items-center justify-center`}>
                <span className="font-display italic text-6xl text-white/30">{guide.initials}</span>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-display italic text-2xl text-[#000000]">{guide.full_name}</h3>
                  <span className="flex items-center gap-1 text-[#2d6a4f] font-sans text-xs mt-1">
                    <CheckCircle size={12} /> Verified
                  </span>
                </div>
                <p className="font-sans text-sm text-gray-600 mb-4 leading-relaxed line-clamp-3">{guide.bio}</p>
                <div className="mb-3">
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">Speaks</p>
                  <div className="flex flex-wrap gap-1.5">
                    {guide.languages.map(l => <span key={l} className="bg-[#F7F5F2] px-2.5 py-1 font-sans text-xs text-gray-700">{l}</span>)}
                  </div>
                </div>
                <div className="mb-5">
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">Specialties</p>
                  <div className="flex flex-wrap gap-1.5">
                    {guide.specialties.map(s => <span key={s} className="bg-[#C9A96E]/10 px-2.5 py-1 font-sans text-xs text-[#2d6a4f]">{s}</span>)}
                  </div>
                </div>
                <Link
                  href={`/guides/${guide.id}`}
                  className="block text-center border border-[#2d6a4f] text-[#2d6a4f] py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
                >
                  View Profile
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}

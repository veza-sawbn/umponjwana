'use client'

import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import { Filter, UserCheck } from 'lucide-react'
import { useState } from 'react'

const SPECIALTIES = ['All', 'Hiking', 'Rock climbing', 'Birding', 'San rock art', 'Photography']

export default function GuidesPage() {
  const [filter, setFilter] = useState('All')

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

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
          <span className="ml-auto font-sans text-sm text-gray-400 shrink-0">0 guides</span>
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-24 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-[#2d6a4f]/10 flex items-center justify-center mb-6">
          <UserCheck size={28} className="text-[#2d6a4f]" />
        </div>
        <h2 className="font-display italic text-3xl text-[#000000] mb-3">No guides listed yet</h2>
        <p className="font-sans text-base text-gray-500 max-w-md mb-8 leading-relaxed">
          Registered guides will appear here once they have been verified. If you are a guide, apply through your supplier dashboard.
        </p>
        <Link
          href="/auth/signup"
          className="inline-block border border-[#2d6a4f] text-[#2d6a4f] px-6 py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
        >
          Register as a Guide
        </Link>
      </main>

      <Footer />
    </div>
  )
}

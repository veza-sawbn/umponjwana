'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Plus, Trash2, CheckCircle, Clock, XCircle, User } from 'lucide-react'

interface Guide {
  id: string
  full_name: string
  bio: string
  languages: string[]
  specialties: string[]
  certificate_number: string
  guide_number: string
  verification_status: 'pending' | 'verified' | 'rejected'
  photo_url?: string
}

const INIT: Guide[] = [
  {
    id: '1',
    full_name: 'Sipho Dlamini',
    bio: 'Born and raised in the Drakensberg, Sipho has been guiding for over 15 years.',
    languages: ['English', 'Zulu', 'Sotho'],
    specialties: ['Rock climbing', 'Birding', 'San rock art'],
    certificate_number: 'FGASA-12345',
    guide_number: 'TBCSA-G-0091',
    verification_status: 'verified',
  },
  {
    id: '2',
    full_name: 'Anele Mokoena',
    bio: 'Passionate hiker and nature conservationist.',
    languages: ['English', 'Xhosa'],
    specialties: ['Day hikes', 'Wildflower identification'],
    certificate_number: 'FGASA-98765',
    guide_number: 'TBCSA-G-0144',
    verification_status: 'pending',
  },
]

const statusConfig = {
  verified: { label: 'Verified', icon: CheckCircle, color: 'text-[#2d6a4f] bg-[#2d6a4f]/10' },
  pending: { label: 'Pending Review', icon: Clock, color: 'text-[#C9A96E] bg-[#C9A96E]/10' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600 bg-red-50' },
}

export default function GuidesPage() {
  const [guides, setGuides] = useState<Guide[]>(INIT)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    bio: '',
    languages: '',
    specialties: '',
    certificate_number: '',
    guide_number: '',
  })

  function handleAdd() {
    if (!form.full_name) return
    const newGuide: Guide = {
      id: Date.now().toString(),
      full_name: form.full_name,
      bio: form.bio,
      languages: form.languages.split(',').map(s => s.trim()).filter(Boolean),
      specialties: form.specialties.split(',').map(s => s.trim()).filter(Boolean),
      certificate_number: form.certificate_number,
      guide_number: form.guide_number,
      verification_status: 'pending',
    }
    setGuides(prev => [...prev, newGuide])
    setForm({ full_name: '', bio: '', languages: '', specialties: '', certificate_number: '', guide_number: '' })
    setShowForm(false)
  }

  function handleDelete(id: string) {
    setGuides(prev => prev.filter(g => g.id !== id))
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#2d6a4f] text-white py-16 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/supplier" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h1 className="font-display italic text-4xl lg:text-5xl">Manage Guides</h1>
          <p className="mt-3 text-white/70 font-sans text-lg">
            Register guides and instructors for your activities. Each guide undergoes verification before appearing publicly.
          </p>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="flex items-center justify-between mb-8">
          <p className="font-sans text-gray-600">{guides.length} guide{guides.length !== 1 ? 's' : ''} registered</p>
          <button
            onClick={() => setShowForm(v => !v)}
            className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm font-medium hover:bg-[#235a3f] transition-colors"
          >
            <Plus size={16} />
            Add Guide
          </button>
        </div>

        {showForm && (
          <div className="bg-white border border-gray-200 p-8 mb-8">
            <h2 className="font-display italic text-2xl text-[#2d6a4f] mb-6">Register New Guide</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Full Name *</label>
                <input
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="Guide's full name"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">FGASA / Guiding Certificate Number</label>
                <input
                  value={form.certificate_number}
                  onChange={e => setForm(f => ({ ...f, certificate_number: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="e.g. FGASA-12345"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">TBCSA Guide Number</label>
                <input
                  value={form.guide_number}
                  onChange={e => setForm(f => ({ ...f, guide_number: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="e.g. TBCSA-G-0001"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Languages (comma-separated)</label>
                <input
                  value={form.languages}
                  onChange={e => setForm(f => ({ ...f, languages: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="English, Zulu, Sotho"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Specialties (comma-separated)</label>
                <input
                  value={form.specialties}
                  onChange={e => setForm(f => ({ ...f, specialties: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="Rock climbing, Birding, San rock art"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none"
                  placeholder="Brief biography visible to guests..."
                />
              </div>
            </div>
            <div className="mt-4 p-4 bg-[#C9A96E]/10 border-l-4 border-[#C9A96E]">
              <p className="font-sans text-sm text-[#2d6a4f]">
                <strong>Verification:</strong> Guides are reviewed within 2–3 business days. Once verified, they appear on your listings. Please ensure certificate details are accurate.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAdd}
                className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm font-medium hover:bg-[#235a3f] transition-colors"
              >
                Register Guide
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="border border-gray-300 text-gray-700 px-6 py-2.5 font-sans text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guides.map(guide => {
            const status = statusConfig[guide.verification_status]
            const StatusIcon = status.icon
            return (
              <div key={guide.id} className="bg-white border border-gray-200">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 bg-[#2d6a4f]/10 flex items-center justify-center">
                      {guide.photo_url ? (
                        <img src={guide.photo_url} alt={guide.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={24} className="text-[#2d6a4f]" />
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans font-medium ${status.color}`}>
                      <StatusIcon size={12} />
                      {status.label}
                    </span>
                  </div>
                  <h3 className="font-display italic text-xl text-[#000000] mb-1">{guide.full_name}</h3>
                  {guide.bio && (
                    <p className="font-sans text-sm text-gray-600 mb-4 line-clamp-2">{guide.bio}</p>
                  )}
                  {guide.languages.length > 0 && (
                    <div className="mb-3">
                      <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Languages</p>
                      <div className="flex flex-wrap gap-1.5">
                        {guide.languages.map(lang => (
                          <span key={lang} className="bg-[#F7F5F2] px-2 py-0.5 font-sans text-xs text-gray-700">{lang}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {guide.specialties.length > 0 && (
                    <div className="mb-4">
                      <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Specialties</p>
                      <div className="flex flex-wrap gap-1.5">
                        {guide.specialties.map(s => (
                          <span key={s} className="bg-[#C9A96E]/10 px-2 py-0.5 font-sans text-xs text-[#2d6a4f]">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(guide.certificate_number || guide.guide_number) && (
                    <div className="border-t border-gray-100 pt-4 space-y-1">
                      {guide.certificate_number && (
                        <p className="font-sans text-xs text-gray-500">Cert: <span className="text-gray-800">{guide.certificate_number}</span></p>
                      )}
                      {guide.guide_number && (
                        <p className="font-sans text-xs text-gray-500">Guide No: <span className="text-gray-800">{guide.guide_number}</span></p>
                      )}
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-100 px-6 py-3 flex justify-end">
                  <button
                    onClick={() => handleDelete(guide.id)}
                    className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-700 font-sans text-sm transition-colors"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {guides.length === 0 && (
          <div className="text-center py-20 bg-white border border-gray-200">
            <User size={40} className="text-gray-300 mx-auto mb-4" />
            <p className="font-display italic text-2xl text-gray-400 mb-2">No guides registered yet</p>
            <p className="font-sans text-gray-500 text-sm">Add guides to show visitors who will be leading their experience.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

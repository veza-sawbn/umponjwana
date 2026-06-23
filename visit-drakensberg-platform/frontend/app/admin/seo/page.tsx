'use client'

import { useState } from 'react'
import { Save, CheckCircle } from 'lucide-react'

const PAGES = [
  { id: 'home', label: 'Homepage', path: '/' },
  { id: 'stays', label: 'Stays Listing', path: '/stays' },
  { id: 'hikes', label: 'Hikes & Trails', path: '/hikes' },
  { id: 'activities', label: 'Activities', path: '/activities' },
  { id: 'events', label: 'Events', path: '/events' },
  { id: 'guides', label: 'Guides Directory', path: '/guides' },
  { id: 'mydrakensberg', label: 'MyDrakensberg', path: '/mydrakensberg' },
]

const DEFAULT_SEO: Record<string, any> = {
  home: { meta_title: 'Visit Drakensberg — Discover the Berg', meta_description: 'Explore accommodation, hiking trails, guided experiences and events in the Drakensberg mountains.', og_title: 'Visit Drakensberg', og_description: 'Plan your Drakensberg adventure.', canonical: 'https://visitdrakensberg.com/' },
  stays: { meta_title: 'Accommodation in the Drakensberg | Visit Drakensberg', meta_description: 'Browse lodges, camps, guesthouses and self-catering options across the Drakensberg.', og_title: 'Drakensberg Accommodation', og_description: 'Find the perfect stay in the Berg.', canonical: 'https://visitdrakensberg.com/stays' },
}

export default function AdminSEOPage() {
  const [activePage, setActivePage] = useState('home')
  const [seoData, setSeoData] = useState(DEFAULT_SEO)
  const [saved, setSaved] = useState(false)

  const current = seoData[activePage] || { meta_title: '', meta_description: '', og_title: '', og_description: '', canonical: '' }

  function update(field: string, value: string) {
    setSeoData(prev => ({ ...prev, [activePage]: { ...current, [field]: value } }))
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">SEO Management</h1>
        </div>
        <button
          onClick={handleSave}
          className={`inline-flex items-center gap-2 px-5 py-2.5 font-sans text-sm transition-colors ${saved ? 'bg-[#2d6a4f] text-white' : 'bg-[#C9A96E] text-[#1a1a1a] hover:bg-[#b8935e]'}`}
        >
          {saved ? <CheckCircle size={15} /> : <Save size={15} />}
          {saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      <div className="flex gap-8">
        {/* Page selector */}
        <aside className="w-48 shrink-0">
          <div className="bg-white border border-gray-200 overflow-hidden">
            {PAGES.map(p => (
              <button
                key={p.id}
                onClick={() => setActivePage(p.id)}
                className={`w-full text-left px-4 py-3 font-sans text-sm border-b border-gray-100 last:border-0 transition-colors ${
                  activePage === p.id ? 'bg-[#2d6a4f] text-white' : 'text-gray-600 hover:bg-[#F7F5F2]'
                }`}
              >
                <p>{p.label}</p>
                <p className={`text-xs mt-0.5 ${activePage === p.id ? 'text-white/50' : 'text-gray-400'}`}>{p.path}</p>
              </button>
            ))}
          </div>
        </aside>

        {/* SEO form */}
        <div className="flex-1 space-y-6">
          <div className="bg-white border border-gray-200 p-6">
            <h2 className="font-display italic text-xl mb-5">Meta Tags</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Meta Title</label>
                <input
                  value={current.meta_title || ''}
                  onChange={e => update('meta_title', e.target.value)}
                  maxLength={60}
                  className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                />
                <div className="flex justify-between mt-1">
                  <p className="font-sans text-xs text-gray-400">Recommended: 50–60 characters</p>
                  <p className={`font-sans text-xs ${(current.meta_title || '').length > 60 ? 'text-red-400' : 'text-gray-400'}`}>
                    {(current.meta_title || '').length}/60
                  </p>
                </div>
              </div>
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Meta Description</label>
                <textarea
                  value={current.meta_description || ''}
                  onChange={e => update('meta_description', e.target.value)}
                  maxLength={160}
                  rows={3}
                  className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none bg-[#F7F5F2]"
                />
                <div className="flex justify-between mt-1">
                  <p className="font-sans text-xs text-gray-400">Recommended: 120–160 characters</p>
                  <p className={`font-sans text-xs ${(current.meta_description || '').length > 160 ? 'text-red-400' : 'text-gray-400'}`}>
                    {(current.meta_description || '').length}/160
                  </p>
                </div>
              </div>
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Canonical URL</label>
                <input
                  value={current.canonical || ''}
                  onChange={e => update('canonical', e.target.value)}
                  className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-6">
            <h2 className="font-display italic text-xl mb-5">Open Graph (Social)</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">OG Title</label>
                <input
                  value={current.og_title || ''}
                  onChange={e => update('og_title', e.target.value)}
                  className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                />
              </div>
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">OG Description</label>
                <textarea
                  value={current.og_description || ''}
                  onChange={e => update('og_description', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none bg-[#F7F5F2]"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white border border-gray-200 p-6">
            <h2 className="font-display italic text-xl mb-4">Search Preview</h2>
            <div className="border border-gray-100 p-4 bg-[#F7F5F2]">
              <p className="font-sans text-xs text-gray-400 mb-1">{current.canonical || `https://visitdrakensberg.com${PAGES.find(p => p.id === activePage)?.path}`}</p>
              <p className="font-sans text-base text-blue-700 mb-1">{current.meta_title || 'Page title'}</p>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">{current.meta_description || 'Page description will appear here.'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

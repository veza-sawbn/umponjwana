'use client'

import { useState, useEffect } from 'react'
import { Save, CheckCircle, Loader2 } from 'lucide-react'
import { getSiteContent, setSiteContent } from '@/lib/site-content'

const PAGES = [
  { id: 'home', label: 'Homepage', path: '/' },
  { id: 'stays', label: 'Stays Listing', path: '/stays' },
  { id: 'hikes', label: 'Hikes & Trails', path: '/hikes' },
  { id: 'activities', label: 'Activities', path: '/activities' },
  { id: 'events', label: 'Events', path: '/events' },
  { id: 'guides', label: 'Guides Directory', path: '/guides' },
  { id: 'mydrakensberg', label: 'MyDrakensberg', path: '/mydrakensberg' },
]

type PageSEO = { meta_title: string; meta_description: string; og_title: string; og_description: string; canonical: string }
type SEOData = Record<string, PageSEO>

const EMPTY_PAGE: PageSEO = { meta_title: '', meta_description: '', og_title: '', og_description: '', canonical: '' }

export default function AdminSEOPage() {
  const [activePage, setActivePage] = useState('home')
  const [seoData, setSeoData] = useState<SEOData>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSiteContent('seo_overrides')
      .then(data => setSeoData(data as SEOData))
      .catch(() => setError('Failed to load SEO settings'))
      .finally(() => setLoading(false))
  }, [])

  const current: PageSEO = (seoData[activePage] as PageSEO | undefined) ?? EMPTY_PAGE

  function update(field: keyof PageSEO, value: string) {
    setSeoData(prev => ({ ...prev, [activePage]: { ...current, [field]: value } }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await setSiteContent('seo_overrides', seoData as any)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError('Failed to save — check your connection and try again.')
    } finally {
      setSaving(false)
    }
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
          disabled={saving || loading}
          className={`inline-flex items-center gap-2 px-5 py-2.5 font-sans text-sm transition-colors disabled:opacity-50 ${saved ? 'bg-[#2d6a4f] text-white' : 'bg-[#C9A96E] text-[#1a1a1a] hover:bg-[#b8935e]'}`}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle size={15} /> : <Save size={15} />}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 font-sans text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-gray-400 font-sans text-sm py-12">
          <Loader2 size={16} className="animate-spin" />
          Loading SEO settings…
        </div>
      ) : (
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
                    value={current.meta_title}
                    onChange={e => update('meta_title', e.target.value)}
                    maxLength={60}
                    className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                  />
                  <div className="flex justify-between mt-1">
                    <p className="font-sans text-xs text-gray-400">Recommended: 50–60 characters</p>
                    <p className={`font-sans text-xs ${current.meta_title.length > 60 ? 'text-red-400' : 'text-gray-400'}`}>
                      {current.meta_title.length}/60
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Meta Description</label>
                  <textarea
                    value={current.meta_description}
                    onChange={e => update('meta_description', e.target.value)}
                    maxLength={160}
                    rows={3}
                    className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none bg-[#F7F5F2]"
                  />
                  <div className="flex justify-between mt-1">
                    <p className="font-sans text-xs text-gray-400">Recommended: 120–160 characters</p>
                    <p className={`font-sans text-xs ${current.meta_description.length > 160 ? 'text-red-400' : 'text-gray-400'}`}>
                      {current.meta_description.length}/160
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Canonical URL</label>
                  <input
                    value={current.canonical}
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
                    value={current.og_title}
                    onChange={e => update('og_title', e.target.value)}
                    className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                  />
                </div>
                <div>
                  <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">OG Description</label>
                  <textarea
                    value={current.og_description}
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
      )}
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import { Copy, Trash2, Upload, X, Check } from 'lucide-react'

type MediaItem = {
  id: string
  type: 'image' | 'video'
  name: string
  url: string
  size: string
  dimensions: string
  used_in: string[]
  uploaded: string
}

const INITIAL_MEDIA: MediaItem[] = [
  { id: 'm1', type: 'image', name: 'amphitheatre-hero.jpg', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80', size: '1.2 MB', dimensions: '1920×1080', used_in: ['Homepage Hero', 'Northern Berg'], uploaded: '10 Jun 2026' },
  { id: 'm2', type: 'image', name: 'giants-castle-rock-art.jpg', url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80', size: '980 KB', dimensions: '1600×900', used_in: ["Giant's Castle", 'Blog Post'], uploaded: '8 Jun 2026' },
  { id: 'm3', type: 'image', name: 'tugela-falls-sunrise.jpg', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80', size: '1.5 MB', dimensions: '2048×1365', used_in: ['Trails Page'], uploaded: '5 Jun 2026' },
  { id: 'm4', type: 'image', name: 'cathedral-peak-summit.jpg', url: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80', size: '2.1 MB', dimensions: '2400×1600', used_in: ['Trails Page', 'Homepage Featured'], uploaded: '1 Jun 2026' },
  { id: 'm5', type: 'image', name: 'bearded-vulture-hide.jpg', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80', size: '760 KB', dimensions: '1280×853', used_in: ['Blog Post'], uploaded: '28 May 2026' },
  { id: 'm6', type: 'image', name: 'zulu-village-foothills.jpg', url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80', size: '890 KB', dimensions: '1440×960', used_in: ['Experiences Page'], uploaded: '20 May 2026' },
  { id: 'm7', type: 'image', name: 'sani-pass-4wd.jpg', url: 'https://images.unsplash.com/photo-1533873984035-25970ab07461?w=800&q=80', size: '1.3 MB', dimensions: '1920×1280', used_in: ['Southern Berg'], uploaded: '15 May 2026' },
  { id: 'm8', type: 'image', name: 'fairy-glen-waterfall.jpg', url: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80', size: '540 KB', dimensions: '1200×800', used_in: ['Trails Page'], uploaded: '10 May 2026' },
]

export default function AdminMediaPage() {
  const [media, setMedia] = useState<MediaItem[]>(INITIAL_MEDIA)
  const [typeFilter, setTypeFilter] = useState<'All' | 'Images' | 'Videos'>('All')
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadUrl, setUploadUrl] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const filtered = media.filter(item => {
    const matchType = typeFilter === 'All' || (typeFilter === 'Images' && item.type === 'image') || (typeFilter === 'Videos' && item.type === 'video')
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.used_in.some(u => u.toLowerCase().includes(search.toLowerCase()))
    return matchType && matchSearch
  })

  function copyUrl(item: MediaItem) {
    navigator.clipboard.writeText(item.url).catch(() => {})
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function remove(id: string) {
    if (selectedItem?.id === id) setSelectedItem(null)
    setMedia(m => m.filter(item => item.id !== id))
  }

  function addFromUrl() {
    if (!uploadUrl || !uploadName) return
    setMedia(m => [...m, {
      id: `m${Date.now()}`,
      type: 'image',
      name: uploadName,
      url: uploadUrl,
      size: 'Unknown',
      dimensions: 'Unknown',
      used_in: [],
      uploaded: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }),
    }])
    setUploadUrl('')
    setUploadName('')
    setShowUpload(false)
  }

  const totalSize = `${(INITIAL_MEDIA.length * 1.1).toFixed(1)} MB`
  const imageCount = media.filter(m => m.type === 'image').length
  const videoCount = media.filter(m => m.type === 'video').length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Media Library</h1>
        </div>
        <button
          onClick={() => setShowUpload(v => !v)}
          className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors"
        >
          {showUpload ? <X size={15} /> : <Upload size={15} />}
          {showUpload ? 'Cancel' : 'Upload'}
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 mb-6">
        {[
          { label: 'Total Items', value: media.length },
          { label: 'Images', value: imageCount },
          { label: 'Videos', value: videoCount },
          { label: 'Total Size', value: totalSize },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 px-4 py-3">
            <p className="font-sans text-[9px] tracking-[0.12em] uppercase text-gray-400">{s.label}</p>
            <p className="font-sans text-xl font-medium">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <h2 className="font-display italic text-xl mb-4">Upload Media</h2>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false) }}
            className={`border-2 border-dashed p-10 text-center mb-5 transition-colors ${dragOver ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 bg-[#F7F5F2]'}`}
          >
            <Upload size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="font-sans text-sm text-gray-500">Drag & drop files here</p>
            <p className="font-sans text-xs text-gray-400 mt-1">Supports JPG, PNG, WebP, MP4</p>
          </div>
          <p className="font-sans text-xs text-gray-400 uppercase tracking-[0.1em] mb-3">Or add by URL</p>
          <div className="flex gap-3">
            <input
              value={uploadName}
              onChange={e => setUploadName(e.target.value)}
              className="border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2] w-48"
              placeholder="filename.jpg"
            />
            <input
              value={uploadUrl}
              onChange={e => setUploadUrl(e.target.value)}
              className="flex-1 border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              placeholder="https://…"
            />
            <button onClick={addFromUrl} className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">Add</button>
          </div>
        </div>
      )}

      {/* Filters + search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-2">
          {(['All', 'Images', 'Videos'] as const).map(f => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-4 py-1.5 font-sans text-xs tracking-[0.08em] uppercase transition-colors ${
                typeFilter === f
                  ? 'bg-[#2d6a4f] text-white'
                  : 'border border-gray-200 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] bg-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search media…"
          className="border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white w-60"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-4">
        {filtered.map(item => (
          <div key={item.id} className="bg-white border border-gray-200 overflow-hidden group">
            <div
              className="h-32 overflow-hidden bg-gray-100 cursor-pointer relative"
              onClick={() => setSelectedItem(item)}
            >
              <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
              <div className="absolute top-2 left-2">
                <span className="font-sans text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 bg-black/70 text-white">
                  {item.type === 'image' ? 'IMAGE' : 'VIDEO'}
                </span>
              </div>
            </div>
            <div className="p-3">
              <p className="font-sans text-xs font-medium text-gray-800 truncate mb-0.5">{item.name}</p>
              <p className="font-sans text-[10px] text-gray-400">{item.size} · {item.dimensions}</p>
              <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
                {item.used_in.map(u => (
                  <span key={u} className="font-sans text-[9px] bg-[#F7F5F2] text-gray-500 px-1.5 py-0.5">{u}</span>
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => copyUrl(item)}
                  className="flex-1 flex items-center justify-center gap-1 border border-gray-200 py-1 font-sans text-[10px] text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
                  title="Copy URL"
                >
                  {copiedId === item.id ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy URL</>}
                </button>
                <button
                  onClick={() => remove(item.id)}
                  className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-sans text-sm text-gray-400">No media found.</p>
        </div>
      )}

      {/* Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-8"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white max-w-3xl w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-display italic text-lg">{selectedItem.name}</h3>
              <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
            </div>
            <img src={selectedItem.url} alt={selectedItem.name} className="w-full max-h-96 object-contain bg-gray-50" />
            <div className="p-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  { label: 'Type', value: selectedItem.type.toUpperCase() },
                  { label: 'Size', value: selectedItem.size },
                  { label: 'Dimensions', value: selectedItem.dimensions },
                  { label: 'Uploaded', value: selectedItem.uploaded },
                ].map(s => (
                  <div key={s.label}>
                    <p className="font-sans text-[9px] tracking-[0.12em] uppercase text-gray-400">{s.label}</p>
                    <p className="font-sans text-sm">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="mb-5">
                <p className="font-sans text-[9px] tracking-[0.12em] uppercase text-gray-400 mb-1">Used In</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedItem.used_in.map(u => (
                    <span key={u} className="font-sans text-xs bg-[#F7F5F2] text-gray-600 px-2 py-0.5">{u}</span>
                  ))}
                  {selectedItem.used_in.length === 0 && <span className="font-sans text-xs text-gray-400">Not used anywhere</span>}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => copyUrl(selectedItem)}
                  className="flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors"
                >
                  {copiedId === selectedItem.id ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy URL</>}
                </button>
                <button onClick={() => setSelectedItem(null)} className="border border-gray-200 text-gray-600 px-5 py-2.5 font-sans text-sm hover:bg-[#F7F5F2] transition-colors">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'

type KeyAttraction = { id: string; name: string; description: string }

type RegionData = {
  name: string
  tagline: string
  heroImage: string
  heroVideo: string
  overview: string
  highlights: string[]
  gettingThere: string
  bestTime: string
  keyAttractions: KeyAttraction[]
  seoTitle: string
  seoDescription: string
}

const REGIONS = [
  'Northern Berg',
  'Central Berg',
  'Southern Berg',
  'Champagne Valley',
  "Giant's Castle",
  'Royal Natal',
  'Sani Pass',
]

function defaultRegion(name: string): RegionData {
  return {
    name,
    tagline: '',
    heroImage: '',
    heroVideo: '',
    overview: '',
    highlights: [],
    gettingThere: '',
    bestTime: '',
    keyAttractions: [],
    seoTitle: `${name} | Visit Drakensberg`,
    seoDescription: '',
  }
}

const INITIAL_DATA: Record<string, RegionData> = {
  'Northern Berg': {
    name: 'Northern Berg',
    tagline: 'Home of the Amphitheatre and Tugela Falls',
    heroImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80',
    heroVideo: '',
    overview: "The Northern Drakensberg is defined by the Amphitheatre — a 5km curved basalt wall rising 1200m from the plain below. It contains Tugela Falls, the world's second-highest waterfall at 948m, and the iconic Chain Ladder route to the summit plateau.",
    highlights: [
      "Tugela Falls — world's 2nd highest waterfall",
      'The Amphitheatre — 5km curved basalt wall',
      'Royal Natal National Park',
      'Chain Ladder summit route',
      'San rock art sites',
    ],
    gettingThere: 'From Johannesburg, take the N3 south toward Harrismith, then follow the R74 toward Bergville. The Sentinel Car Park is approximately 4.5 hours from Johannesburg.',
    bestTime: 'April to September for clear skies and cooler hiking conditions. June–August brings snow to the high peaks. Spring (September–October) for wildflowers.',
    keyAttractions: [
      { id: 'ka1', name: 'Tugela Falls', description: "The world's second-highest waterfall, plunging 948m in five separate falls from the Amphitheatre plateau." },
      { id: 'ka2', name: 'The Chain Ladder', description: '30m of iron rungs bolted into the face of the Amphitheatre, providing access to the summit plateau.' },
    ],
    seoTitle: 'Northern Drakensberg | Amphitheatre & Tugela Falls | Visit Drakensberg',
    seoDescription: "Discover the Northern Drakensberg — home to the Amphitheatre, Tugela Falls (world's 2nd highest waterfall), and the Chain Ladder hiking route.",
  },
}

REGIONS.forEach(r => {
  if (!INITIAL_DATA[r]) INITIAL_DATA[r] = defaultRegion(r)
})

export default function AdminRegionsPage() {
  const [selectedRegion, setSelectedRegion] = useState('Northern Berg')
  const [regionData, setRegionData] = useState<Record<string, RegionData>>(INITIAL_DATA)
  const [savedRegion, setSavedRegion] = useState<string | null>(null)

  const data = regionData[selectedRegion]

  function update(field: keyof RegionData, value: unknown) {
    setRegionData(rd => ({
      ...rd,
      [selectedRegion]: { ...rd[selectedRegion], [field]: value },
    }))
  }

  function updateHighlight(index: number, value: string) {
    const next = [...data.highlights]
    next[index] = value
    update('highlights', next)
  }

  function addHighlight() {
    update('highlights', [...data.highlights, ''])
  }

  function removeHighlight(index: number) {
    update('highlights', data.highlights.filter((_, i) => i !== index))
  }

  function updateAttraction(id: string, field: keyof KeyAttraction, value: string) {
    update('keyAttractions', data.keyAttractions.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  function addAttraction() {
    update('keyAttractions', [...data.keyAttractions, { id: `ka${Date.now()}`, name: '', description: '' }])
  }

  function removeAttraction(id: string) {
    update('keyAttractions', data.keyAttractions.filter(a => a.id !== id))
  }

  function save() {
    setSavedRegion(selectedRegion)
    setTimeout(() => setSavedRegion(null), 2000)
  }

  const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
  const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
        <h1 className="font-display italic text-3xl text-[#000000]">Regions</h1>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left region list */}
        <div className="w-52 shrink-0 bg-white border border-gray-200">
          {REGIONS.map(r => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className={`w-full text-left px-4 py-3 font-sans text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                selectedRegion === r
                  ? 'bg-[#2d6a4f] text-white'
                  : 'text-gray-700 hover:bg-[#F7F5F2]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Right editor */}
        <div className="flex-1 bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-6">{selectedRegion}</h2>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Region Name (display)</label>
                <input value={data.name} onChange={e => update('name', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tagline</label>
                <input value={data.tagline} onChange={e => update('tagline', e.target.value)} className={inputCls} placeholder="e.g. Home of the Amphitheatre…" />
              </div>
            </div>

            <div>
              <label className={labelCls}>Hero Image URL</label>
              <input value={data.heroImage} onChange={e => update('heroImage', e.target.value)} className={inputCls} placeholder="https://…" />
              {data.heroImage && (
                <img src={data.heroImage} alt="Hero preview" className="mt-2 h-32 w-full object-cover" />
              )}
            </div>

            <div>
              <label className={labelCls}>Hero Video URL (optional)</label>
              <input value={data.heroVideo} onChange={e => update('heroVideo', e.target.value)} className={inputCls} placeholder="https://…mp4" />
            </div>

            <div>
              <label className={labelCls}>Overview</label>
              <textarea value={data.overview} onChange={e => update('overview', e.target.value)} rows={5} className={`${inputCls} resize-none`} />
            </div>

            {/* Highlights */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls}>Highlights</label>
                <button onClick={addHighlight} className="flex items-center gap-1 font-sans text-xs text-[#2d6a4f] hover:underline">
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="space-y-2">
                {data.highlights.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={h}
                      onChange={e => updateHighlight(i, e.target.value)}
                      className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                      placeholder="Highlight point"
                    />
                    <button onClick={() => removeHighlight(i)} className="p-2 text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                  </div>
                ))}
                {data.highlights.length === 0 && (
                  <p className="font-sans text-xs text-gray-400">No highlights yet. Click + Add to create one.</p>
                )}
              </div>
            </div>

            <div>
              <label className={labelCls}>Getting There</label>
              <textarea value={data.gettingThere} onChange={e => update('gettingThere', e.target.value)} rows={3} className={`${inputCls} resize-none`} />
            </div>

            <div>
              <label className={labelCls}>Best Time to Visit</label>
              <textarea value={data.bestTime} onChange={e => update('bestTime', e.target.value)} rows={3} className={`${inputCls} resize-none`} />
            </div>

            {/* Key Attractions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className={labelCls}>Key Attractions</label>
                <button onClick={addAttraction} className="flex items-center gap-1 font-sans text-xs text-[#2d6a4f] hover:underline">
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="space-y-3">
                {data.keyAttractions.map(a => (
                  <div key={a.id} className="border border-gray-100 p-3 bg-[#F7F5F2]">
                    <div className="flex gap-2 mb-2">
                      <input
                        value={a.name}
                        onChange={e => updateAttraction(a.id, 'name', e.target.value)}
                        className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white"
                        placeholder="Attraction name"
                      />
                      <button onClick={() => removeAttraction(a.id)} className="p-2 text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                    </div>
                    <input
                      value={a.description}
                      onChange={e => updateAttraction(a.id, 'description', e.target.value)}
                      className="w-full border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white"
                      placeholder="Short description"
                    />
                  </div>
                ))}
                {data.keyAttractions.length === 0 && (
                  <p className="font-sans text-xs text-gray-400">No attractions yet. Click + Add to create one.</p>
                )}
              </div>
            </div>

            {/* SEO */}
            <div className="pt-4 border-t border-gray-100">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-3">SEO</p>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>SEO Title</label>
                  <input value={data.seoTitle} onChange={e => update('seoTitle', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>SEO Description</label>
                  <textarea value={data.seoDescription} onChange={e => update('seoDescription', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center gap-4">
            <button
              onClick={save}
              className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors"
            >
              Save Region
            </button>
            {savedRegion === selectedRegion && (
              <span className="flex items-center gap-1.5 font-sans text-sm text-[#2d6a4f]">
                <Check size={15} /> Saved ✓
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

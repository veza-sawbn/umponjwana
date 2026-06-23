'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Star, Check, X } from 'lucide-react'

type Trail = {
  id: string
  name: string
  region: string
  difficulty: 'Easy' | 'Moderate' | 'Strenuous'
  distance: string
  duration: string
  elevation: string
  status: 'published' | 'draft'
  featured: boolean
  image: string
  description: string
  trailhead: string
  permit_required: boolean
  permit_cost: number
}

const INITIAL_TRAILS: Trail[] = [
  { id: 't1', name: 'Tugela Falls Circuit', region: 'Northern Berg', difficulty: 'Strenuous', distance: '14km', duration: '6–8 hrs', elevation: '3282m', status: 'published', featured: true, image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80', description: 'The classic circuit to the second-highest waterfall in the world. Includes the iconic Chain Ladder — 30m of iron rungs bolted into the Amphitheatre face.', trailhead: 'Sentinel Car Park, Royal Natal National Park', permit_required: true, permit_cost: 80 },
  { id: 't2', name: 'Cathedral Peak Summit', region: 'Northern Berg', difficulty: 'Strenuous', distance: '12km', duration: '8–10 hrs', elevation: '3004m', status: 'published', featured: true, image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=400&q=80', description: 'A full-day summit attempt on one of the most distinctive peaks of the Drakensberg.', trailhead: 'Cathedral Peak Hotel', permit_required: false, permit_cost: 0 },
  { id: 't3', name: "Giant's Castle via Meander", region: 'Central Berg', difficulty: 'Moderate', distance: '18km', duration: '7–9 hrs', elevation: '2985m', status: 'published', featured: false, image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80', description: 'A traverse past the famous lammergeier hide and San rock art sites.', trailhead: "Giant's Castle Rest Camp", permit_required: true, permit_cost: 100 },
  { id: 't4', name: 'Fairy Glen Waterfall Walk', region: 'Central Berg', difficulty: 'Easy', distance: '7km', duration: '3–4 hrs', elevation: '1400m', status: 'published', featured: false, image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80', description: 'A gentle family-friendly walk through indigenous forest to a series of cascades.', trailhead: 'Champagne Valley', permit_required: false, permit_cost: 0 },
  { id: 't5', name: 'Sani Pass to Lesotho Border', region: 'Southern Berg', difficulty: 'Moderate', distance: '8km', duration: '4–5 hrs', elevation: '2874m', status: 'draft', featured: false, image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80', description: 'Hike up the famous Sani Pass to the Lesotho border post and the highest pub in Africa.', trailhead: 'Sani Pass Lower Gate', permit_required: false, permit_cost: 0 },
]

const REGIONS = ['Northern Berg', 'Central Berg', 'Southern Berg']
const DIFFICULTIES = ['Easy', 'Moderate', 'Strenuous'] as const

const DIFF_STYLE: Record<string, string> = {
  Easy: 'bg-green-50 text-green-700',
  Moderate: 'bg-[#C9A96E]/15 text-[#8B6914]',
  Strenuous: 'bg-red-50 text-red-700',
}

export default function AdminTrailsPage() {
  const [trails, setTrails] = useState<Trail[]>(INITIAL_TRAILS)
  const [regionFilter, setRegionFilter] = useState<string>('All')
  const [editingTrail, setEditingTrail] = useState<Trail | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTrail, setNewTrail] = useState<Omit<Trail, 'id'>>({
    name: '', region: 'Northern Berg', difficulty: 'Moderate', distance: '', duration: '', elevation: '',
    status: 'draft', featured: false, image: '', description: '', trailhead: '', permit_required: false, permit_cost: 0,
  })

  const filtered = trails.filter(t => regionFilter === 'All' || t.region === regionFilter)

  function toggleFeatured(id: string) {
    setTrails(ts => ts.map(t => t.id === id ? { ...t, featured: !t.featured } : t))
  }

  function toggleStatus(id: string) {
    setTrails(ts => ts.map(t => t.id === id ? { ...t, status: t.status === 'published' ? 'draft' : 'published' } : t))
  }

  function remove(id: string) {
    if (editingTrail?.id === id) setEditingTrail(null)
    setTrails(ts => ts.filter(t => t.id !== id))
  }

  function saveEdit() {
    if (!editingTrail) return
    setTrails(ts => ts.map(t => t.id === editingTrail.id ? editingTrail : t))
    setEditingTrail(null)
  }

  function addTrail() {
    if (!newTrail.name) return
    setTrails(ts => [...ts, { id: `t${Date.now()}`, ...newTrail }])
    setNewTrail({ name: '', region: 'Northern Berg', difficulty: 'Moderate', distance: '', duration: '', elevation: '', status: 'draft', featured: false, image: '', description: '', trailhead: '', permit_required: false, permit_cost: 0 })
    setShowAdd(false)
  }

  const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
  const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

  function TrailForm({ trail, onChange, onSave, onCancel, saveLabel }: {
    trail: Omit<Trail, 'id'> | Trail
    onChange: (field: string, value: unknown) => void
    onSave: () => void
    onCancel: () => void
    saveLabel: string
  }) {
    return (
      <div className="bg-white border border-gray-200 p-6 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Trail Name *</label>
            <input value={trail.name} onChange={e => onChange('name', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Region</label>
            <select value={trail.region} onChange={e => onChange('region', e.target.value)} className={inputCls}>
              {REGIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Difficulty</label>
            <select value={trail.difficulty} onChange={e => onChange('difficulty', e.target.value)} className={inputCls}>
              {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Distance</label>
            <input value={trail.distance} onChange={e => onChange('distance', e.target.value)} className={inputCls} placeholder="e.g. 14km" />
          </div>
          <div>
            <label className={labelCls}>Duration</label>
            <input value={trail.duration} onChange={e => onChange('duration', e.target.value)} className={inputCls} placeholder="e.g. 6–8 hrs" />
          </div>
          <div>
            <label className={labelCls}>Elevation</label>
            <input value={trail.elevation} onChange={e => onChange('elevation', e.target.value)} className={inputCls} placeholder="e.g. 3282m" />
          </div>
          <div>
            <label className={labelCls}>Trailhead</label>
            <input value={trail.trailhead} onChange={e => onChange('trailhead', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Image URL</label>
            <input value={trail.image} onChange={e => onChange('image', e.target.value)} className={inputCls} placeholder="https://…" />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={trail.status} onChange={e => onChange('status', e.target.value)} className={inputCls}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className={labelCls}>Description</label>
          <textarea value={trail.description} onChange={e => onChange('description', e.target.value)} rows={4} className={`${inputCls} resize-none`} />
        </div>
        <div className="flex flex-wrap items-center gap-6 mb-5">
          <label className="flex items-center gap-2 font-sans text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={trail.permit_required} onChange={e => onChange('permit_required', e.target.checked)} className="accent-[#2d6a4f]" />
            Permit Required
          </label>
          {trail.permit_required && (
            <div className="flex items-center gap-2">
              <label className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Permit Cost (ZAR)</label>
              <input type="number" value={trail.permit_cost} onChange={e => onChange('permit_cost', Number(e.target.value))} className="border border-gray-200 px-3 py-1.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2] w-24" />
            </div>
          )}
          <label className="flex items-center gap-2 font-sans text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={trail.featured} onChange={e => onChange('featured', e.target.checked)} className="accent-[#2d6a4f]" />
            Featured
          </label>
        </div>
        <div className="flex gap-3">
          <button onClick={onSave} className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">{saveLabel}</button>
          <button onClick={onCancel} className="border border-gray-200 text-gray-600 px-6 py-2.5 font-sans text-sm hover:bg-[#F7F5F2] transition-colors">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Hiking Trails</h1>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setEditingTrail(null) }}
          className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors"
        >
          {showAdd ? <X size={15} /> : <Plus size={15} />}
          {showAdd ? 'Cancel' : '+ Add Trail'}
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-6">
        {['All', ...REGIONS].map(r => (
          <button
            key={r}
            onClick={() => setRegionFilter(r)}
            className={`px-4 py-1.5 font-sans text-xs tracking-[0.08em] uppercase transition-colors ${
              regionFilter === r
                ? 'bg-[#2d6a4f] text-white'
                : 'border border-gray-200 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] bg-white'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Trail grid */}
      <div className="grid grid-cols-2 gap-5">
        {filtered.map(trail => (
          <div key={trail.id} className={`bg-white border transition-colors ${editingTrail?.id === trail.id ? 'border-[#C9A96E]' : 'border-gray-200'}`}>
            <div className="h-40 overflow-hidden relative">
              {trail.image && <img src={trail.image} alt={trail.name} className="w-full h-full object-cover" />}
              <div className="absolute top-2 left-2 flex gap-1.5">
                <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${DIFF_STYLE[trail.difficulty]}`}>{trail.difficulty}</span>
              </div>
              <button
                onClick={() => toggleFeatured(trail.id)}
                className="absolute top-2 right-2 p-1 bg-white/90 hover:bg-white transition-colors"
                title={trail.featured ? 'Remove featured' : 'Mark featured'}
              >
                <Star size={14} className={trail.featured ? 'fill-[#C9A96E] text-[#C9A96E]' : 'text-gray-400'} />
              </button>
            </div>
            <div className="p-4">
              <h3 className="font-display italic text-xl mb-1">{trail.name}</h3>
              <p className="font-sans text-xs text-gray-400 mb-3">{trail.region}</p>
              <div className="flex flex-wrap gap-3 mb-3">
                {[
                  { label: 'Distance', value: trail.distance },
                  { label: 'Duration', value: trail.duration },
                  { label: 'Elevation', value: trail.elevation },
                ].map(s => (
                  <div key={s.label}>
                    <p className="font-sans text-[9px] tracking-[0.12em] uppercase text-gray-400">{s.label}</p>
                    <p className="font-sans text-sm font-medium">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${trail.status === 'published' ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]' : 'bg-gray-100 text-gray-500'}`}>
                  {trail.status}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditingTrail(trail); setShowAdd(false) }}
                    className="p-1.5 text-gray-400 hover:text-[#2d6a4f] transition-colors"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => toggleStatus(trail.id)}
                    className="px-2.5 py-1 border border-gray-200 font-sans text-xs text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
                  >
                    {trail.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => remove(trail.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <TrailForm
          trail={newTrail}
          onChange={(field, value) => setNewTrail(t => ({ ...t, [field]: value }))}
          onSave={addTrail}
          onCancel={() => setShowAdd(false)}
          saveLabel="Add Trail"
        />
      )}

      {/* Edit panel */}
      {editingTrail && (
        <TrailForm
          trail={editingTrail}
          onChange={(field, value) => setEditingTrail(t => t ? { ...t, [field]: value } : t)}
          onSave={saveEdit}
          onCancel={() => setEditingTrail(null)}
          saveLabel="Save Changes"
        />
      )}
    </div>
  )
}

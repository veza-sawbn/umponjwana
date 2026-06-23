'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Star, X, Check, GripVertical, ImagePlus, CalendarDays } from 'lucide-react'
import { Trail, TrailDay, getTrails, saveTrails, DEFAULT_TRAILS } from '@/lib/trails'

const REGIONS = ['Northern Berg', 'Central Berg', 'Southern Berg', 'Royal Natal National Park', 'Champagne Valley', "Giant's Castle", 'Sani Pass']
const DIFFICULTIES = ['Easy', 'Moderate', 'Strenuous'] as const

const DIFF_STYLE: Record<string, string> = {
  Easy: 'bg-green-50 text-green-700',
  Moderate: 'bg-[#C9A96E]/15 text-[#8B6914]',
  Strenuous: 'bg-red-50 text-red-700',
}

const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

function GalleryEditor({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const [newUrl, setNewUrl] = useState('')

  function add() {
    if (!newUrl.trim()) return
    onChange([...images, newUrl.trim()])
    setNewUrl('')
  }

  function remove(i: number) {
    onChange(images.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <label className={labelCls}>Gallery Images</label>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {images.map((url, i) => (
          <div key={i} className="relative group">
            <img src={url} alt="" className="w-full aspect-[4/3] object-cover" />
            <button
              onClick={() => remove(i)}
              className="absolute top-1 right-1 bg-black/70 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {images.length === 0 && (
          <div className="col-span-3 bg-[#F7F5F2] border border-dashed border-gray-300 flex items-center justify-center py-6">
            <span className="font-sans text-xs text-gray-400">No gallery images yet</span>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Paste image URL and press Enter…"
          className={inputCls + ' flex-1'}
        />
        <button onClick={add} className="bg-[#2d6a4f] text-white px-4 py-2 font-sans text-sm hover:bg-[#235a3f] transition-colors flex items-center gap-1.5">
          <ImagePlus size={14} /> Add
        </button>
      </div>
    </div>
  )
}

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  const [newItem, setNewItem] = useState('')

  function add() {
    if (!newItem.trim()) return
    onChange([...items, newItem.trim()])
    setNewItem('')
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }

  function update(i: number, val: string) {
    onChange(items.map((item, idx) => idx === i ? val : item))
  }

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="space-y-2 mb-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              value={item}
              onChange={e => update(i, e.target.value)}
              className={inputCls + ' flex-1'}
            />
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-400 transition-colors p-1 shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder || 'Add item…'}
          className={inputCls + ' flex-1'}
        />
        <button onClick={add} className="border border-[#2d6a4f] text-[#2d6a4f] px-3 py-2 font-sans text-xs hover:bg-[#2d6a4f] hover:text-white transition-colors">
          + Add
        </button>
      </div>
    </div>
  )
}

function DaysEditor({ days, onChange }: { days: TrailDay[]; onChange: (days: TrailDay[]) => void }) {
  const empty: TrailDay = { label: '', distance: '', elevation: '', difficulty: 'Moderate', notes: '' }

  function addDay() {
    onChange([...days, { ...empty, label: `Day ${days.length + 1}` }])
  }

  function removeDay(i: number) {
    onChange(days.filter((_, idx) => idx !== i))
  }

  function updateDay(i: number, field: keyof TrailDay, value: string) {
    onChange(days.map((d, idx) => idx === i ? { ...d, [field]: value } : d))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className={labelCls + ' mb-0'}>Daily Breakdown</label>
        <button onClick={addDay} className="inline-flex items-center gap-1 border border-[#2d6a4f] text-[#2d6a4f] px-3 py-1.5 font-sans text-xs hover:bg-[#2d6a4f] hover:text-white transition-colors">
          <Plus size={12} /> Add Day
        </button>
      </div>
      {days.length === 0 && (
        <div className="bg-[#F7F5F2] border border-dashed border-gray-300 flex items-center justify-center py-6">
          <span className="font-sans text-xs text-gray-400">No days added yet — click Add Day</span>
        </div>
      )}
      <div className="space-y-3">
        {days.map((day, i) => (
          <div key={i} className="border border-gray-200 bg-white p-4 relative">
            <button
              onClick={() => removeDay(i)}
              className="absolute top-3 right-3 text-gray-300 hover:text-red-400 transition-colors"
            >
              <X size={14} />
            </button>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className={labelCls}>Day Label</label>
                <input value={day.label} onChange={e => updateDay(i, 'label', e.target.value)} placeholder={`Day ${i + 1}: From → To`} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Distance</label>
                <input value={day.distance} onChange={e => updateDay(i, 'distance', e.target.value)} placeholder="e.g. 15 km" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Elevation Gain</label>
                <input value={day.elevation} onChange={e => updateDay(i, 'elevation', e.target.value)} placeholder="e.g. +800m" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Difficulty</label>
                <select value={day.difficulty} onChange={e => updateDay(i, 'difficulty', e.target.value as TrailDay['difficulty'])} className={inputCls}>
                  {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className={labelCls}>Notes</label>
                <input value={day.notes ?? ''} onChange={e => updateDay(i, 'notes', e.target.value)} placeholder="Optional notes for this day…" className={inputCls} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrailForm({ trail, onChange, onSave, onCancel, saveLabel, saving }: {
  trail: Trail
  onChange: (field: string, value: unknown) => void
  onSave: () => void
  onCancel: () => void
  saveLabel: string
  saving?: boolean
}) {
  return (
    <div className="bg-white border border-[#C9A96E] p-6 mt-6 space-y-6">
      {/* Core fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
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
          <label className={labelCls}>Overall Difficulty</label>
          <select value={trail.difficulty} onChange={e => onChange('difficulty', e.target.value)} className={inputCls}>
            {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Total Distance</label>
          <input value={trail.distance} onChange={e => onChange('distance', e.target.value)} placeholder="e.g. 14 km" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Duration</label>
          <input value={trail.duration} onChange={e => onChange('duration', e.target.value)} placeholder="e.g. 6–8 hours" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Total Elevation Gain</label>
          <input value={trail.elevation} onChange={e => onChange('elevation', e.target.value)} placeholder="e.g. +1200m" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Trailhead</label>
          <input value={trail.trailhead} onChange={e => onChange('trailhead', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={trail.status} onChange={e => onChange('status', e.target.value)} className={inputCls}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea value={trail.description} onChange={e => onChange('description', e.target.value)} rows={4} className={`${inputCls} resize-none`} />
      </div>

      {/* Hero image */}
      <div>
        <label className={labelCls}>Hero Image URL</label>
        <div className="flex gap-3 items-start">
          <input value={trail.image} onChange={e => onChange('image', e.target.value)} placeholder="https://…" className={inputCls} />
          {trail.image && <img src={trail.image} alt="" className="w-24 h-16 object-cover shrink-0 border border-gray-200" />}
        </div>
      </div>

      {/* Gallery */}
      <GalleryEditor images={trail.gallery} onChange={imgs => onChange('gallery', imgs)} />

      {/* What to bring */}
      <ListEditor
        label="What to Bring"
        items={trail.what_to_bring}
        onChange={items => onChange('what_to_bring', items)}
        placeholder="e.g. 3L water minimum"
      />

      {/* Permit */}
      <div className="flex flex-wrap items-center gap-6">
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
          Featured on Homepage
        </label>
      </div>

      {/* Multi-day toggle */}
      <div className="border-t border-gray-100 pt-6">
        <label className="flex items-center gap-2 font-sans text-sm font-medium text-gray-700 cursor-pointer mb-4">
          <input type="checkbox" checked={trail.is_multi_day} onChange={e => onChange('is_multi_day', e.target.checked)} className="accent-[#2d6a4f]" />
          <CalendarDays size={15} className="text-[#2d6a4f]" />
          Multi-day hike (show daily breakdown on trail page)
        </label>
        {trail.is_multi_day && (
          <DaysEditor days={trail.days} onChange={days => onChange('days', days)} />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 border-t border-gray-100 pt-5">
        <button onClick={onSave} disabled={saving} className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : saveLabel}
        </button>
        <button onClick={onCancel} className="border border-gray-200 text-gray-600 px-6 py-2.5 font-sans text-sm hover:bg-[#F7F5F2] transition-colors">Cancel</button>
      </div>
    </div>
  )
}

const BLANK_TRAIL: Trail = {
  id: '', name: '', region: 'Northern Berg', difficulty: 'Moderate', distance: '', duration: '', elevation: '',
  status: 'draft', featured: false, image: '', gallery: [], description: '', trailhead: '',
  permit_required: false, permit_cost: 0, what_to_bring: [], is_multi_day: false, days: [],
}

export default function AdminTrailsPage() {
  const [trails, setTrails] = useState<Trail[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [regionFilter, setRegionFilter] = useState<string>('All')
  const [editingTrail, setEditingTrail] = useState<Trail | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTrail, setNewTrail] = useState<Trail>({ ...BLANK_TRAIL })

  useEffect(() => {
    getTrails().then(t => { setTrails(t); setLoading(false) })
  }, [])

  const filtered = trails.filter(t => regionFilter === 'All' || t.region === regionFilter)

  async function persistTrails(updated: Trail[]) {
    setSaving(true)
    await saveTrails(updated)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function toggleFeatured(id: string) {
    const updated = trails.map(t => t.id === id ? { ...t, featured: !t.featured } : t)
    setTrails(updated)
    persistTrails(updated)
  }

  function toggleStatus(id: string) {
    const updated = trails.map(t => t.id === id ? { ...t, status: t.status === 'published' ? 'draft' : 'published' } : t)
    setTrails(updated)
    persistTrails(updated)
  }

  function remove(id: string) {
    if (editingTrail?.id === id) setEditingTrail(null)
    const updated = trails.filter(t => t.id !== id)
    setTrails(updated)
    persistTrails(updated)
  }

  async function saveEdit() {
    if (!editingTrail) return
    const updated = trails.map(t => t.id === editingTrail.id ? editingTrail : t)
    setTrails(updated)
    setEditingTrail(null)
    await persistTrails(updated)
  }

  async function addTrail() {
    if (!newTrail.name) return
    const id = newTrail.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const trail = { ...newTrail, id: id || `trail-${Date.now()}` }
    const updated = [...trails, trail]
    setTrails(updated)
    setNewTrail({ ...BLANK_TRAIL })
    setShowAdd(false)
    await persistTrails(updated)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 w-48" />
          <div className="grid grid-cols-2 gap-5">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-60 bg-gray-200" />)}
          </div>
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
          <p className="font-sans text-xs text-gray-400 mt-1">{trails.length} trails · Changes save to Supabase instantly</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-[#2d6a4f] font-sans text-xs">
              <Check size={13} /> Saved
            </span>
          )}
          <button
            onClick={() => { setShowAdd(v => !v); setEditingTrail(null) }}
            className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors"
          >
            {showAdd ? <X size={15} /> : <Plus size={15} />}
            {showAdd ? 'Cancel' : '+ Add Trail'}
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map(trail => (
          <div key={trail.id} className={`bg-white border transition-colors ${editingTrail?.id === trail.id ? 'border-[#C9A96E]' : 'border-gray-200'}`}>
            <div className="h-44 overflow-hidden relative bg-gray-100">
              {trail.image && <img src={trail.image} alt={trail.name} className="w-full h-full object-cover" />}
              <div className="absolute top-2 left-2 flex gap-1.5">
                <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${DIFF_STYLE[trail.difficulty]}`}>{trail.difficulty}</span>
                {trail.is_multi_day && (
                  <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 bg-[#1a1a2e]/80 text-white">Multi-day</span>
                )}
              </div>
              <button
                onClick={() => toggleFeatured(trail.id)}
                className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white transition-colors"
                title={trail.featured ? 'Remove featured' : 'Mark featured'}
              >
                <Star size={13} className={trail.featured ? 'fill-[#C9A96E] text-[#C9A96E]' : 'text-gray-400'} />
              </button>
              {trail.gallery.length > 0 && (
                <span className="absolute bottom-2 right-2 bg-black/60 text-white font-sans text-[10px] px-2 py-0.5">
                  +{trail.gallery.length} photos
                </span>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-display italic text-xl mb-0.5">{trail.name}</h3>
              <p className="font-sans text-xs text-gray-400 mb-3">{trail.region}</p>
              <div className="flex flex-wrap gap-4 mb-3">
                {[
                  { label: 'Distance', value: trail.distance },
                  { label: 'Duration', value: trail.duration },
                  { label: 'Elevation', value: trail.elevation },
                  ...(trail.is_multi_day ? [{ label: 'Days', value: `${trail.days.length}` }] : []),
                ].map(s => (
                  <div key={s.label}>
                    <p className="font-sans text-[9px] tracking-[0.12em] uppercase text-gray-400">{s.label}</p>
                    <p className="font-sans text-sm font-medium">{s.value || '—'}</p>
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
            {/* Inline edit form */}
            {editingTrail?.id === trail.id && (
              <div className="border-t border-[#C9A96E]/40 px-4 pb-4">
                <TrailForm
                  trail={editingTrail}
                  onChange={(field, value) => setEditingTrail(t => t ? { ...t, [field]: value } : t)}
                  onSave={saveEdit}
                  onCancel={() => setEditingTrail(null)}
                  saveLabel="Save Changes"
                  saving={saving}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mt-6">
          <h2 className="font-display italic text-xl mb-2">New Trail</h2>
          <TrailForm
            trail={newTrail}
            onChange={(field, value) => setNewTrail(t => ({ ...t, [field]: value }))}
            onSave={addTrail}
            onCancel={() => setShowAdd(false)}
            saveLabel="Add Trail"
            saving={saving}
          />
        </div>
      )}
    </div>
  )
}

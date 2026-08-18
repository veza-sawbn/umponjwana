'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { getRegions, saveAllRegions, DEFAULT_REGIONS, type Region } from '@/lib/regions'
import { adminMediaSource } from '@/lib/admin-supabase'
import { MediaPicker } from '@/components/media/MediaPicker'

// Reads/writes lib/regions.ts directly — the same module the public site
// renders from — matching app/admin/reserves/page.tsx and
// app/admin/towns/page.tsx exactly. This used to go through a separate
// AdminRegion type/collection in lib/admin-supabase.ts that never wrote a
// `slug` field, so the public read path silently re-derived one from
// `name` on every render; saveAllRegions() normalizes (and so stabilizes)
// the slug on every save instead, the same fix lib/reserves.ts already
// had via saveAllReserves(). See docs/destination-graph/PHASE_G.md.

function blankRegion(): Region {
  return {
    id: `region-${Date.now()}`, slug: '', name: 'New Region', tagline: '', heroImage: '', heroVideo: '',
    overview: '', highlights: [], gettingThere: '', gettingThereSections: [], gettingThereRoutes: [],
    bestTime: '', keyAttractions: [], subregions: [], seoTitle: '', seoDescription: '',
  }
}

export default function AdminRegionsPage() {
  const [regions, setRegions] = useState<Region[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const data = regions.find(r => r.id === selectedId) || regions[0]

  async function load() {
    try {
      // Nothing saved yet: seed the editor with the regions the public site
      // renders by default, so edits update what visitors actually see.
      const stored = await getRegions()
      const items = stored.length > 0 ? stored : DEFAULT_REGIONS
      setRegions(items)
      setSelectedId(items[0]?.id ?? null)
    } catch { setError('Could not load regions from Supabase.') }
  }
  useEffect(() => { load() }, [])

  function replaceCurrent(next: Region) { setRegions(rs => rs.map(r => r.id === data.id ? next : r)) }
  function update(field: keyof Region, value: unknown) { if (data) replaceCurrent({ ...data, [field]: value }) }

  // The list shown in the console is authoritative: every save persists the
  // whole list, so seeded defaults and sibling regions are never dropped.
  async function persist(next: Region[]): Promise<boolean> {
    setError('')
    try { await saveAllRegions(next); return true }
    catch (e: any) {
      setSaved(false)
      setError(`Save failed: ${e?.message || 'unknown error'}. Check that you are signed in as an admin and try again.`)
      return false
    }
  }
  async function save() {
    if (!data) return
    const updated = { ...data, updatedAt: new Date().toISOString() }
    const next = regions.map(r => r.id === data.id ? updated : r)
    if (await persist(next)) { setRegions(next); setSelectedId(updated.id); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }
  async function addRegion() {
    const created = blankRegion()
    const next = [...regions, created]
    if (await persist(next)) { setRegions(next); setSelectedId(created.id) }
  }
  async function deleteRegion() {
    if (!data?.id) return
    const next = regions.filter(r => r.id !== data.id)
    if (await persist(next)) { setRegions(next); setSelectedId(next[0]?.id ?? null) }
  }

  const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
  const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

  if (!data) return (
    <div className="p-8">
      <div className="mb-8"><p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p><h1 className="font-display italic text-3xl text-[#000000]">Regions</h1></div>
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
      <button onClick={addRegion} className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm">Create first region</button>
    </div>
  )

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Regions</h1>
          <p className="font-sans text-xs text-gray-400 mt-1">Create, edit, and remove live region content stored in Supabase.</p>
        </div>
        <button onClick={addRegion} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm"><Plus size={15}/> Add Region</button>
      </div>
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="flex gap-6 items-start">
        <div className="w-52 shrink-0 bg-white border border-gray-200">
          {regions.map(r => (
            <button key={r.id} onClick={() => setSelectedId(r.id)} className={`w-full text-left px-4 py-3 font-sans text-sm border-b border-gray-100 last:border-b-0 ${data.id === r.id ? 'bg-[#2d6a4f] text-white' : 'text-gray-700 hover:bg-[#F7F5F2]'}`}>
              {r.name}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display italic text-xl">{data.name}</h2>
            <button onClick={deleteRegion} className="inline-flex items-center gap-1 text-red-400 font-sans text-xs"><Trash2 size={13}/> Delete region</button>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Region Name</label><input value={data.name} onChange={e => update('name', e.target.value)} className={inputCls}/></div>
              <div><label className={labelCls}>Tagline</label><input value={data.tagline} onChange={e => update('tagline', e.target.value)} className={inputCls}/></div>
            </div>
            <div><label className={labelCls}>Hero Image</label><MediaPicker value={data.heroImage} onChange={url => update('heroImage', url)} source={adminMediaSource} /></div>
            <div><label className={labelCls}>Hero Video</label><MediaPicker value={data.heroVideo} onChange={url => update('heroVideo', url)} source={adminMediaSource} accept="video" /></div>
            <div><label className={labelCls}>Overview</label><textarea value={data.overview} onChange={e => update('overview', e.target.value)} rows={5} className={`${inputCls} resize-none`}/></div>

            <div>
              <div className="flex items-center justify-between mb-2"><label className={labelCls}>Highlights</label><button onClick={() => update('highlights', [...data.highlights, ''])} className="flex items-center gap-1 font-sans text-xs text-[#2d6a4f]"><Plus size={12}/> Add</button></div>
              {data.highlights.map((h, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={h} onChange={e => update('highlights', data.highlights.map((item, index) => index === i ? e.target.value : item))} className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2]"/>
                  <button onClick={() => update('highlights', data.highlights.filter((_, index) => index !== i))} className="p-2 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-3">Getting There</p>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Intro</label>
                  <textarea value={data.gettingThere} onChange={e => update('gettingThere', e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="A short overview — blank lines between paragraphs are preserved on the public page."/>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelCls}>Sections (e.g. By Road, By Air, By Shuttle)</label>
                    <button onClick={() => update('gettingThereSections', [...data.gettingThereSections, { id: `gts${Date.now()}`, title: '', body: '' }])} className="flex items-center gap-1 font-sans text-xs text-[#2d6a4f]"><Plus size={12}/> Add</button>
                  </div>
                  {data.gettingThereSections.map(s => (
                    <div key={s.id} className="border border-gray-100 p-3 bg-[#F7F5F2] mb-3">
                      <div className="flex gap-2 mb-2">
                        <input placeholder="Section title, e.g. By Road" value={s.title} onChange={e => update('gettingThereSections', data.gettingThereSections.map(item => item.id === s.id ? { ...item, title: e.target.value } : item))} className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm bg-white"/>
                        <button onClick={() => update('gettingThereSections', data.gettingThereSections.filter(item => item.id !== s.id))} className="p-2 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button>
                      </div>
                      <textarea placeholder="Section content" value={s.body} onChange={e => update('gettingThereSections', data.gettingThereSections.map(item => item.id === s.id ? { ...item, body: e.target.value } : item))} rows={3} className="w-full border border-gray-200 px-3 py-2 font-sans text-sm bg-white resize-none"/>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelCls}>Distance & Duration Table</label>
                    <button onClick={() => update('gettingThereRoutes', [...data.gettingThereRoutes, { id: `gtr${Date.now()}`, from: '', distance: '', duration: '' }])} className="flex items-center gap-1 font-sans text-xs text-[#2d6a4f]"><Plus size={12}/> Add Row</button>
                  </div>
                  {data.gettingThereRoutes.map(r => (
                    <div key={r.id} className="flex gap-2 mb-2 items-center">
                      <input placeholder="From, e.g. Johannesburg" value={r.from} onChange={e => update('gettingThereRoutes', data.gettingThereRoutes.map(item => item.id === r.id ? { ...item, from: e.target.value } : item))} className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2]"/>
                      <input placeholder="Distance, e.g. 380 km" value={r.distance} onChange={e => update('gettingThereRoutes', data.gettingThereRoutes.map(item => item.id === r.id ? { ...item, distance: e.target.value } : item))} className="w-32 border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2]"/>
                      <input placeholder="Duration, e.g. 4h 30m" value={r.duration} onChange={e => update('gettingThereRoutes', data.gettingThereRoutes.map(item => item.id === r.id ? { ...item, duration: e.target.value } : item))} className="w-32 border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2]"/>
                      <button onClick={() => update('gettingThereRoutes', data.gettingThereRoutes.filter(item => item.id !== r.id))} className="p-2 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div><label className={labelCls}>Best Time to Visit</label><textarea value={data.bestTime} onChange={e => update('bestTime', e.target.value)} rows={3} className={`${inputCls} resize-none`}/></div>

            <div>
              <div className="flex items-center justify-between mb-3"><label className={labelCls}>Key Attractions</label><button onClick={() => update('keyAttractions', [...data.keyAttractions, { id: `ka${Date.now()}`, name: '', description: '' }])} className="flex items-center gap-1 font-sans text-xs text-[#2d6a4f]"><Plus size={12}/> Add</button></div>
              {data.keyAttractions.map(a => (
                <div key={a.id} className="border border-gray-100 p-3 bg-[#F7F5F2] mb-3">
                  <div className="flex gap-2 mb-2">
                    <input value={a.name} onChange={e => update('keyAttractions', data.keyAttractions.map(item => item.id === a.id ? { ...item, name: e.target.value } : item))} className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm bg-white"/>
                    <button onClick={() => update('keyAttractions', data.keyAttractions.filter(item => item.id !== a.id))} className="p-2 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button>
                  </div>
                  <input value={a.description} onChange={e => update('keyAttractions', data.keyAttractions.map(item => item.id === a.id ? { ...item, description: e.target.value } : item))} className="w-full border border-gray-200 px-3 py-2 font-sans text-sm bg-white"/>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3"><label className={labelCls}>Subregions</label><button onClick={() => update('subregions', [...(data.subregions || []), { id: `sr${Date.now()}`, name: '', description: '' }])} className="flex items-center gap-1 font-sans text-xs text-[#2d6a4f]"><Plus size={12}/> Add</button></div>
              {(data.subregions || []).map(s => (
                <div key={s.id} className="border border-gray-100 p-3 bg-[#F7F5F2] mb-3">
                  <div className="flex gap-2 mb-2">
                    <input placeholder="Subregion name" value={s.name} onChange={e => update('subregions', (data.subregions || []).map(item => item.id === s.id ? { ...item, name: e.target.value } : item))} className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm bg-white"/>
                    <button onClick={() => update('subregions', (data.subregions || []).filter(item => item.id !== s.id))} className="p-2 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button>
                  </div>
                  <input placeholder="Short description (optional)" value={s.description} onChange={e => update('subregions', (data.subregions || []).map(item => item.id === s.id ? { ...item, description: e.target.value } : item))} className="w-full border border-gray-200 px-3 py-2 font-sans text-sm bg-white"/>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-3">SEO</p>
              <div className="space-y-4">
                <div><label className={labelCls}>SEO Title</label><input value={data.seoTitle} onChange={e => update('seoTitle', e.target.value)} className={inputCls}/></div>
                <div><label className={labelCls}>SEO Description</label><textarea value={data.seoDescription} onChange={e => update('seoDescription', e.target.value)} rows={2} className={`${inputCls} resize-none`}/></div>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center gap-4">
            <button onClick={save} className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm">Save Region</button>
            {saved && <span className="flex items-center gap-1.5 font-sans text-sm text-[#2d6a4f]"><Check size={15}/> Saved</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

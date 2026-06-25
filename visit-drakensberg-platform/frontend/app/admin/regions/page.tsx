'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { supabase } from '@/lib/auth'

type KeyAttraction = { id: string; name: string; description: string }
type RegionData = { id?: string; name: string; tagline: string; heroImage: string; heroVideo: string; overview: string; highlights: string[]; gettingThere: string; bestTime: string; keyAttractions: KeyAttraction[]; seoTitle: string; seoDescription: string }

function blankRegion(): RegionData { return { name: 'New Region', tagline: '', heroImage: '', heroVideo: '', overview: '', highlights: [], gettingThere: '', bestTime: '', keyAttractions: [], seoTitle: '', seoDescription: '' } }

export default function AdminRegionsPage() {
  const [regions, setRegions] = useState<RegionData[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const data = regions.find(r => r.id === selectedId) || regions[0]

  async function persistRegions(nextRegions: RegionData[]) {
    const { error } = await supabase.from('site_content').upsert(
      { key: 'admin_regions', value: { items: nextRegions }, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (error) throw error
  }

  async function loadRegions() {
    try {
      const { data, error } = await supabase.from('site_content').select('value').eq('key', 'admin_regions').maybeSingle()
      if (error) throw error
      const items = ((data?.value as { items?: RegionData[] } | null)?.items) || []
      setRegions(items)
      setSelectedId(items[0]?.id ?? null)
    } catch {
      setError('Could not load regions from Supabase.')
    }
  }
  useEffect(() => { loadRegions() }, [])

  function replaceCurrent(next: RegionData) { setRegions(rs => rs.map(r => r.id === data.id ? next : r)) }
  function update(field: keyof RegionData, value: unknown) { if (data) replaceCurrent({ ...data, [field]: value }) }
  async function save() {
    if (!data) return
    const region = { ...data, id: data.id || `region-${Date.now()}` }
    const next = data.id ? regions.map(r => r.id === data.id ? region : r) : [...regions, region]
    await persistRegions(next)
    setRegions(next)
    setSelectedId(region.id!)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  async function addRegion() {
    const created = { ...blankRegion(), id: `region-${Date.now()}` }
    const next = [...regions, created]
    await persistRegions(next)
    setRegions(next)
    setSelectedId(created.id)
  }
  async function deleteRegion() {
    if (!data?.id) return
    const next = regions.filter(r => r.id !== data.id)
    await persistRegions(next)
    setRegions(next)
    setSelectedId(next[0]?.id ?? null)
  }

  const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
  const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

  if (!data) return <div className="p-8"><div className="mb-8"><p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p><h1 className="font-display italic text-3xl text-[#000000]">Regions</h1></div>{error && <p className="text-sm text-red-500 mb-4">{error}</p>}<button onClick={addRegion} className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm">Create first region</button></div>

  return <div className="p-8"><div className="mb-8 flex items-center justify-between"><div><p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p><h1 className="font-display italic text-3xl text-[#000000]">Regions</h1><p className="font-sans text-xs text-gray-400 mt-1">Create, edit, and remove region content stored in Supabase.</p></div><button onClick={addRegion} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm"><Plus size={15}/> Add Region</button></div>{error && <p className="text-sm text-red-500 mb-4">{error}</p>}
    <div className="flex gap-6 items-start"><div className="w-52 shrink-0 bg-white border border-gray-200">{regions.map(r => <button key={r.id} onClick={() => setSelectedId(r.id!)} className={`w-full text-left px-4 py-3 font-sans text-sm border-b border-gray-100 last:border-b-0 ${data.id === r.id ? 'bg-[#2d6a4f] text-white' : 'text-gray-700 hover:bg-[#F7F5F2]'}`}>{r.name}</button>)}</div>
      <div className="flex-1 bg-white border border-gray-200 p-6"><div className="flex items-center justify-between mb-6"><h2 className="font-display italic text-xl">{data.name}</h2><button onClick={deleteRegion} className="inline-flex items-center gap-1 text-red-400 font-sans text-xs"><Trash2 size={13}/> Delete region</button></div>
        <div className="space-y-5"><div className="grid grid-cols-2 gap-4"><div><label className={labelCls}>Region Name</label><input value={data.name} onChange={e => update('name', e.target.value)} className={inputCls}/></div><div><label className={labelCls}>Tagline</label><input value={data.tagline} onChange={e => update('tagline', e.target.value)} className={inputCls}/></div></div>
          <div><label className={labelCls}>Hero Image URL</label><input value={data.heroImage} onChange={e => update('heroImage', e.target.value)} className={inputCls}/>{data.heroImage && <img src={data.heroImage} alt="Hero preview" className="mt-2 h-32 w-full object-cover"/>}</div>
          <div><label className={labelCls}>Hero Video URL</label><input value={data.heroVideo} onChange={e => update('heroVideo', e.target.value)} className={inputCls}/></div>
          <div><label className={labelCls}>Overview</label><textarea value={data.overview} onChange={e => update('overview', e.target.value)} rows={5} className={`${inputCls} resize-none`}/></div>
          <div><div className="flex items-center justify-between mb-2"><label className={labelCls}>Highlights</label><button onClick={() => update('highlights', [...data.highlights, ''])} className="flex items-center gap-1 font-sans text-xs text-[#2d6a4f]"><Plus size={12}/> Add</button></div>{data.highlights.map((h, i) => <div key={i} className="flex gap-2 mb-2"><input value={h} onChange={e => update('highlights', data.highlights.map((item, index) => index === i ? e.target.value : item))} className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2]"/><button onClick={() => update('highlights', data.highlights.filter((_, index) => index !== i))} className="p-2 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button></div>)}</div>
          <div><label className={labelCls}>Getting There</label><textarea value={data.gettingThere} onChange={e => update('gettingThere', e.target.value)} rows={3} className={`${inputCls} resize-none`}/></div><div><label className={labelCls}>Best Time to Visit</label><textarea value={data.bestTime} onChange={e => update('bestTime', e.target.value)} rows={3} className={`${inputCls} resize-none`}/></div>
          <div><div className="flex items-center justify-between mb-3"><label className={labelCls}>Key Attractions</label><button onClick={() => update('keyAttractions', [...data.keyAttractions, { id: `ka${Date.now()}`, name: '', description: '' }])} className="flex items-center gap-1 font-sans text-xs text-[#2d6a4f]"><Plus size={12}/> Add</button></div>{data.keyAttractions.map(a => <div key={a.id} className="border border-gray-100 p-3 bg-[#F7F5F2] mb-3"><div className="flex gap-2 mb-2"><input value={a.name} onChange={e => update('keyAttractions', data.keyAttractions.map(item => item.id === a.id ? { ...item, name: e.target.value } : item))} className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm bg-white"/><button onClick={() => update('keyAttractions', data.keyAttractions.filter(item => item.id !== a.id))} className="p-2 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button></div><input value={a.description} onChange={e => update('keyAttractions', data.keyAttractions.map(item => item.id === a.id ? { ...item, description: e.target.value } : item))} className="w-full border border-gray-200 px-3 py-2 font-sans text-sm bg-white"/></div>)}</div>
          <div className="pt-4 border-t border-gray-100"><p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-3">SEO</p><div className="space-y-4"><div><label className={labelCls}>SEO Title</label><input value={data.seoTitle} onChange={e => update('seoTitle', e.target.value)} className={inputCls}/></div><div><label className={labelCls}>SEO Description</label><textarea value={data.seoDescription} onChange={e => update('seoDescription', e.target.value)} rows={2} className={`${inputCls} resize-none`}/></div></div></div>
        </div><div className="mt-8 pt-6 border-t border-gray-100 flex items-center gap-4"><button onClick={save} className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm">Save Region</button>{saved && <span className="flex items-center gap-1.5 font-sans text-sm text-[#2d6a4f]"><Check size={15}/> Saved</span>}</div></div>
    </div></div>
}

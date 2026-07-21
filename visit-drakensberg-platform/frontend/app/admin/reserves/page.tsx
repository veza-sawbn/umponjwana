'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { getReserves, saveAllReserves, type Reserve, type ReservePeak } from '@/lib/reserves'
import { getRegions, DEFAULT_REGIONS, type Region } from '@/lib/regions'

type PeakDifficulty = ReservePeak['difficulty']

function blankReserve(): Reserve {
  return {
    id: `reserve-${Date.now()}`, slug: '', regionSlug: '', name: 'New Reserve', shortName: '', tagline: '',
    description: '', image: '', viewpointName: '', bestTime: '', permits: '', facilities: [], peaks: [],
    seoTitle: '', seoDescription: '',
  }
}

const DIFFICULTIES: PeakDifficulty[] = ['accessible', 'moderate', 'expert']

export default function AdminReservesPage() {
  const [reserves, setReserves] = useState<Reserve[]>([])
  const [regions, setRegions] = useState<Region[]>(DEFAULT_REGIONS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const data = reserves.find(r => r.id === selectedId) || reserves[0]

  async function load() {
    try {
      const [items, regionList] = await Promise.all([getReserves(), getRegions().catch(() => DEFAULT_REGIONS)])
      setReserves(items)
      setRegions(regionList)
      setSelectedId(items[0]?.id ?? null)
    } catch { setError('Could not load reserves from Supabase.') }
  }
  useEffect(() => { load() }, [])

  function replaceCurrent(next: Reserve) { setReserves(rs => rs.map(r => r.id === data.id ? next : r)) }
  function update(field: keyof Reserve, value: unknown) { if (data) replaceCurrent({ ...data, [field]: value }) }

  // The list shown in the console is authoritative: every save persists the
  // whole list, so seeded defaults and sibling reserves are never dropped.
  async function persist(next: Reserve[]): Promise<boolean> {
    setError('')
    try { await saveAllReserves(next); return true }
    catch (e: any) {
      setSaved(false)
      setError(`Save failed: ${e?.message || 'unknown error'}. Check that you are signed in as an admin and try again.`)
      return false
    }
  }
  async function save() {
    if (!data) return
    const updated = { ...data, updatedAt: new Date().toISOString() }
    const next = reserves.map(r => r.id === data.id ? updated : r)
    if (await persist(next)) { setReserves(next); setSelectedId(updated.id); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }
  async function addReserve() {
    const created = blankReserve()
    const next = [...reserves, created]
    if (await persist(next)) { setReserves(next); setSelectedId(created.id) }
  }
  async function deleteReserve() {
    if (!data?.id) return
    const next = reserves.filter(r => r.id !== data.id)
    if (await persist(next)) { setReserves(next); setSelectedId(next[0]?.id ?? null) }
  }

  const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
  const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

  function regionName(slug: string) { return regions.find(r => r.slug === slug)?.name ?? '' }

  if (!data) return (
    <div className="p-8">
      <div className="mb-8"><p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p><h1 className="font-display italic text-3xl text-[#000000]">Nature Reserves</h1></div>
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
      <button onClick={addReserve} className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm">Create first reserve</button>
    </div>
  )

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console · Regions</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Nature Reserves</h1>
          <p className="font-sans text-xs text-gray-400 mt-1">Create, edit, and remove reserves. Each reserve is filed under a region so visitors can navigate them by area.</p>
        </div>
        <button onClick={addReserve} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm"><Plus size={15}/> Add Reserve</button>
      </div>
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="flex gap-6 items-start">
        <div className="w-56 shrink-0 bg-white border border-gray-200">
          {reserves.map(r => (
            <button key={r.id} onClick={() => setSelectedId(r.id)} className={`w-full text-left px-4 py-3 font-sans border-b border-gray-100 last:border-b-0 ${data.id === r.id ? 'bg-[#2d6a4f] text-white' : 'text-gray-700 hover:bg-[#F7F5F2]'}`}>
              <span className="block text-sm">{r.name}</span>
              <span className={`block text-[10px] tracking-[0.1em] uppercase mt-0.5 ${data.id === r.id ? 'text-white/60' : 'text-gray-400'}`}>{regionName(r.regionSlug) || 'Unassigned'}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display italic text-xl">{data.name}</h2>
            <button onClick={deleteReserve} className="inline-flex items-center gap-1 text-red-400 font-sans text-xs"><Trash2 size={13}/> Delete reserve</button>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Reserve Name</label><input value={data.name} onChange={e => update('name', e.target.value)} className={inputCls}/></div>
              <div><label className={labelCls}>Short Name</label><input value={data.shortName} onChange={e => update('shortName', e.target.value)} className={inputCls} placeholder="Tab label, e.g. Royal Natal"/></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Region</label>
                <select value={data.regionSlug} onChange={e => update('regionSlug', e.target.value)} className={inputCls}>
                  <option value="">— Unassigned —</option>
                  {regions.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Tagline</label><input value={data.tagline} onChange={e => update('tagline', e.target.value)} className={inputCls}/></div>
            </div>
            <div><label className={labelCls}>Hero Image URL</label><input value={data.image} onChange={e => update('image', e.target.value)} className={inputCls}/>{data.image && <img src={data.image} alt="Hero preview" className="mt-2 h-32 w-full object-cover"/>}</div>
            <div><label className={labelCls}>Description</label><textarea value={data.description} onChange={e => update('description', e.target.value)} rows={5} className={`${inputCls} resize-none`}/></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Panorama Viewpoint Name</label><input value={data.viewpointName} onChange={e => update('viewpointName', e.target.value)} className={inputCls}/></div>
              <div><label className={labelCls}>Best Time to Visit</label><input value={data.bestTime} onChange={e => update('bestTime', e.target.value)} className={inputCls}/></div>
            </div>
            <div><label className={labelCls}>Permits & Fees</label><textarea value={data.permits} onChange={e => update('permits', e.target.value)} rows={2} className={`${inputCls} resize-none`}/></div>

            {/* Facilities */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls}>Facilities</label>
                <button onClick={() => update('facilities', [...data.facilities, ''])} className="flex items-center gap-1 font-sans text-xs text-[#2d6a4f]"><Plus size={12}/> Add</button>
              </div>
              {data.facilities.map((f, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={f} onChange={e => update('facilities', data.facilities.map((item, index) => index === i ? e.target.value : item))} className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2]"/>
                  <button onClick={() => update('facilities', data.facilities.filter((_, index) => index !== i))} className="p-2 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button>
                </div>
              ))}
            </div>

            {/* Peaks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className={labelCls}>Key Peaks</label>
                <button onClick={() => update('peaks', [...data.peaks, { id: `pk${Date.now()}`, name: '', elevation: 3000, difficulty: 'moderate' as PeakDifficulty }])} className="flex items-center gap-1 font-sans text-xs text-[#2d6a4f]"><Plus size={12}/> Add</button>
              </div>
              {data.peaks.map(p => (
                <div key={p.id} className="flex gap-2 mb-2 items-center">
                  <input value={p.name} placeholder="Peak name" onChange={e => update('peaks', data.peaks.map(item => item.id === p.id ? { ...item, name: e.target.value } : item))} className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2]"/>
                  <input type="number" value={p.elevation} onChange={e => update('peaks', data.peaks.map(item => item.id === p.id ? { ...item, elevation: Number(e.target.value) } : item))} className="w-24 border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2]" placeholder="m"/>
                  <select value={p.difficulty} onChange={e => update('peaks', data.peaks.map(item => item.id === p.id ? { ...item, difficulty: e.target.value as PeakDifficulty } : item))} className="w-32 border border-gray-200 px-2 py-2 font-sans text-sm bg-[#F7F5F2]">
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
                  </select>
                  <button onClick={() => update('peaks', data.peaks.filter(item => item.id !== p.id))} className="p-2 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button>
                </div>
              ))}
            </div>

            {/* SEO */}
            <div className="pt-4 border-t border-gray-100">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-3">SEO</p>
              <div className="space-y-4">
                <div><label className={labelCls}>SEO Title</label><input value={data.seoTitle} onChange={e => update('seoTitle', e.target.value)} className={inputCls}/></div>
                <div><label className={labelCls}>SEO Description</label><textarea value={data.seoDescription} onChange={e => update('seoDescription', e.target.value)} rows={2} className={`${inputCls} resize-none`}/></div>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center gap-4">
            <button onClick={save} className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm">Save Reserve</button>
            {saved && <span className="flex items-center gap-1.5 font-sans text-sm text-[#2d6a4f]"><Check size={15}/> Saved</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

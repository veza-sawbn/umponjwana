'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { getTowns, saveAllTowns, type Town } from '@/lib/towns'
import { getRegions, DEFAULT_REGIONS, type Region } from '@/lib/regions'
import { adminMediaSource } from '@/lib/admin-supabase'
import { MediaPicker } from '@/components/media/MediaPicker'

function blankTown(): Town {
  return {
    id: `town-${Date.now()}`, slug: '', regionSlug: '', name: 'New Town', gateway: '',
    description: '', image: '', highlights: [], seoTitle: '', seoDescription: '',
  }
}

export default function AdminTownsPage() {
  const [towns, setTowns] = useState<Town[]>([])
  const [regions, setRegions] = useState<Region[]>(DEFAULT_REGIONS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const data = towns.find(t => t.id === selectedId) || towns[0]

  async function load() {
    try {
      const [items, regionList] = await Promise.all([getTowns(), getRegions().catch(() => DEFAULT_REGIONS)])
      setTowns(items)
      setRegions(regionList)
      setSelectedId(items[0]?.id ?? null)
    } catch { setError('Could not load towns from Supabase.') }
  }
  useEffect(() => { load() }, [])

  function replaceCurrent(next: Town) { setTowns(ts => ts.map(t => t.id === data.id ? next : t)) }
  function update(field: keyof Town, value: unknown) { if (data) replaceCurrent({ ...data, [field]: value }) }

  async function persist(next: Town[]): Promise<boolean> {
    setError('')
    try { await saveAllTowns(next); return true }
    catch (e: any) {
      setSaved(false)
      setError(`Save failed: ${e?.message || 'unknown error'}. Check that you are signed in as an admin and try again.`)
      return false
    }
  }
  async function save() {
    if (!data) return
    const updated = { ...data, updatedAt: new Date().toISOString() }
    const next = towns.map(t => t.id === data.id ? updated : t)
    if (await persist(next)) { setTowns(next); setSelectedId(updated.id); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }
  async function addTown() {
    const created = blankTown()
    const next = [...towns, created]
    if (await persist(next)) { setTowns(next); setSelectedId(created.id) }
  }
  async function deleteTown() {
    if (!data?.id) return
    const next = towns.filter(t => t.id !== data.id)
    if (await persist(next)) { setTowns(next); setSelectedId(next[0]?.id ?? null) }
  }

  const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
  const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

  function regionName(slug: string) { return regions.find(r => r.slug === slug)?.name ?? '' }

  if (!data) return (
    <div className="p-8">
      <div className="mb-8"><p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p><h1 className="font-display italic text-3xl text-[#000000]">Towns & Cities</h1></div>
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
      <button onClick={addTown} className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm">Create first town</button>
    </div>
  )

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console · Regions</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Towns & Cities</h1>
          <p className="font-sans text-xs text-gray-400 mt-1">Gateway towns and villages, filed under a region so visitors can find where to base themselves.</p>
        </div>
        <button onClick={addTown} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm"><Plus size={15}/> Add Town</button>
      </div>
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="flex gap-6 items-start">
        <div className="w-56 shrink-0 bg-white border border-gray-200">
          {towns.map(t => (
            <button key={t.id} onClick={() => setSelectedId(t.id)} className={`w-full text-left px-4 py-3 font-sans border-b border-gray-100 last:border-b-0 ${data.id === t.id ? 'bg-[#2d6a4f] text-white' : 'text-gray-700 hover:bg-[#F7F5F2]'}`}>
              <span className="block text-sm">{t.name}</span>
              <span className={`block text-[10px] tracking-[0.1em] uppercase mt-0.5 ${data.id === t.id ? 'text-white/60' : 'text-gray-400'}`}>{regionName(t.regionSlug) || 'Unassigned'}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display italic text-xl">{data.name}</h2>
            <button onClick={deleteTown} className="inline-flex items-center gap-1 text-red-400 font-sans text-xs"><Trash2 size={13}/> Delete town</button>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Town Name</label><input value={data.name} onChange={e => update('name', e.target.value)} className={inputCls}/></div>
              <div>
                <label className={labelCls}>Region</label>
                <select value={data.regionSlug} onChange={e => update('regionSlug', e.target.value)} className={inputCls}>
                  <option value="">— Unassigned —</option>
                  {regions.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className={labelCls}>Role / Label</label><input value={data.gateway} onChange={e => update('gateway', e.target.value)} className={inputCls} placeholder="e.g. North Berg gateway"/></div>
            <div><label className={labelCls}>Hero Image</label><MediaPicker value={data.image} onChange={url => update('image', url)} source={adminMediaSource} /></div>
            <div><label className={labelCls}>Description</label><textarea value={data.description} onChange={e => update('description', e.target.value)} rows={4} className={`${inputCls} resize-none`}/></div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls}>Highlights</label>
                <button onClick={() => update('highlights', [...data.highlights, ''])} className="flex items-center gap-1 font-sans text-xs text-[#2d6a4f]"><Plus size={12}/> Add</button>
              </div>
              {data.highlights.map((h, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={h} onChange={e => update('highlights', data.highlights.map((item, index) => index === i ? e.target.value : item))} className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm bg-[#F7F5F2]"/>
                  <button onClick={() => update('highlights', data.highlights.filter((_, index) => index !== i))} className="p-2 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button>
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
            <button onClick={save} className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm">Save Town</button>
            {saved && <span className="flex items-center gap-1.5 font-sans text-sm text-[#2d6a4f]"><Check size={15}/> Saved</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

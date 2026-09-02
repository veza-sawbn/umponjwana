'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Trash2, Upload, X, Check } from 'lucide-react'
import { createAdminMedia, deleteAdminMedia, getAdminMedia, uploadAdminMedia } from '@/lib/admin-supabase'
import { getFieldGuideMediaUsage } from '@/lib/field-guide'

type MediaItem = { id: string; type: 'image' | 'video'; name: string; url: string; size: string; dimensions: string; used_in: string[]; uploaded: string }

export default function AdminMediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [uploadUrl, setUploadUrl] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadMedia() { try { setMedia(await getAdminMedia()) } catch { setError('Could not load media library from Supabase.') } }
  useEffect(() => { loadMedia() }, [])

  const filtered = media.filter(item => item.name.toLowerCase().includes(search.toLowerCase()) || item.used_in.some(u => u.toLowerCase().includes(search.toLowerCase())))
  const imageCount = media.filter(m => m.type === 'image').length
  const videoCount = media.filter(m => m.type === 'video').length

  function copyUrl(item: MediaItem) { navigator.clipboard.writeText(item.url).catch(() => {}); setCopiedId(item.id); setTimeout(() => setCopiedId(null), 2000) }

  // Deleting a file that a layered field guide still points at would leave a
  // hole in a published composition, so the asset is checked before it goes.
  async function remove(item: MediaItem) {
    setError('')
    try {
      const usage = await getFieldGuideMediaUsage(item.url)
      if (usage.length > 0) {
        const where = usage.slice(0, 3).map(u => `${u.page} · ${u.usedAs}`).join('; ')
        setError(`"${item.name}" is still in use — ${where}${usage.length > 3 ? `, and ${usage.length - 3} more` : ''}. Replace it there before deleting.`)
        return
      }
    } catch {
      // Usage lookup is a guard, not a gate: if the RPC is missing (migration
      // not yet applied) the delete still works exactly as it did before.
    }
    await deleteAdminMedia(item.id)
    setMedia(m => m.filter(i => i.id !== item.id))
  }
  async function addFromUrl() {
    if (!uploadUrl || !uploadName) return
    const created = await createAdminMedia({ type: uploadUrl.match(/\.mp4|\.mov|\.webm/i) ? 'video' : 'image', name: uploadName, url: uploadUrl, size: 'External URL', dimensions: 'Unknown', used_in: [] })
    setMedia(m => [...m, created]); setUploadUrl(''); setUploadName(''); setShowUpload(false)
  }
  async function uploadFile(file?: File) {
    if (!file) return
    setBusy(true); setError('')
    try { const created = await uploadAdminMedia(file); setMedia(m => [...m, created]); setShowUpload(false) } catch (e: any) { setError(e?.message || 'Upload failed. Check Supabase Storage bucket configuration.') } finally { setBusy(false) }
  }

  return <div className="p-8">
    <div className="flex items-center justify-between mb-4"><div><p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p><h1 className="font-display italic text-3xl text-[#000000]">Media Library</h1><p className="font-sans text-xs text-gray-400 mt-1">Live media stored in Supabase site content and Storage.</p></div><button onClick={() => setShowUpload(v => !v)} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm">{showUpload ? <X size={15}/> : <Upload size={15}/>} {showUpload ? 'Cancel' : 'Upload'}</button></div>
    {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
    <div className="flex gap-6 mb-6">{[{label:'Total Items',value:media.length},{label:'Images',value:imageCount},{label:'Videos',value:videoCount}].map(s => <div key={s.label} className="bg-white border border-gray-200 px-4 py-3"><p className="font-sans text-[9px] tracking-[0.12em] uppercase text-gray-400">{s.label}</p><p className="font-sans text-xl font-medium">{s.value}</p></div>)}</div>
    {showUpload && <div className="bg-white border border-gray-200 p-6 mb-6"><h2 className="font-display italic text-xl mb-4">Upload Media</h2><input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => uploadFile(e.target.files?.[0])}/><button disabled={busy} onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-200 bg-[#F7F5F2] p-10 text-center mb-5 font-sans text-sm text-gray-500 disabled:opacity-50"><Upload size={28} className="mx-auto mb-2 text-gray-300"/>{busy ? 'Uploading…' : 'Choose JPG, PNG, WebP, or MP4 file'}</button><p className="font-sans text-xs text-gray-400 uppercase tracking-[0.1em] mb-3">Or add by URL</p><div className="flex gap-3"><input value={uploadName} onChange={e => setUploadName(e.target.value)} className="border border-gray-200 px-3 py-2.5 font-sans text-sm bg-[#F7F5F2] w-48" placeholder="filename.jpg"/><input value={uploadUrl} onChange={e => setUploadUrl(e.target.value)} className="flex-1 border border-gray-200 px-3 py-2.5 font-sans text-sm bg-[#F7F5F2]" placeholder="https://…"/><button onClick={addFromUrl} className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm">Add</button></div></div>}
    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search media…" className="border border-gray-200 px-3 py-2 font-sans text-sm bg-white w-60 mb-6"/>
    <div className="grid grid-cols-4 gap-4">{filtered.map(item => <div key={item.id} className="bg-white border border-gray-200 overflow-hidden group"><div className="h-32 overflow-hidden bg-gray-100 relative">{item.type === 'video' ? <video src={item.url} className="w-full h-full object-cover"/> : <img src={item.url} alt={item.name} className="w-full h-full object-cover"/>}<span className="absolute top-2 left-2 font-sans text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 bg-black/70 text-white">{item.type}</span></div><div className="p-3"><p className="font-sans text-xs font-medium text-gray-800 truncate mb-0.5">{item.name}</p><p className="font-sans text-[10px] text-gray-400">{item.size} · {item.dimensions}</p><div className="flex gap-1 mt-2"><button onClick={() => copyUrl(item)} className="flex-1 flex items-center justify-center gap-1 border border-gray-200 py-1 font-sans text-[10px] text-gray-600">{copiedId === item.id ? <><Check size={11}/> Copied!</> : <><Copy size={11}/> Copy URL</>}</button><button onClick={() => remove(item)} title="Delete" className="p-1.5 text-gray-400 hover:text-red-400"><Trash2 size={13}/></button></div></div></div>)}</div>
    {filtered.length === 0 && <div className="py-16 text-center"><p className="font-sans text-sm text-gray-400">No media found.</p></div>}
  </div>
}

'use client'
import { useState, useRef, useEffect } from 'react'
import { Image as ImageIcon, Upload, Loader2, Search, X, Trash2 } from 'lucide-react'

// Shared "pick from your uploaded media, or upload a new file" widget —
// replaces plain paste-a-URL text inputs everywhere. Data-source agnostic:
// pass the admin library (lib/admin-supabase.ts's adminMediaSource) or a
// supplier's own library (lib/supplier-media.ts's supplierMediaSource).

export type PickableMedia = { id: string; type: 'image' | 'video'; name: string; url: string }
export type MediaSource = {
  list: () => Promise<PickableMedia[]>
  upload: (file: File) => Promise<PickableMedia>
}

function MediaLibraryDialog({ source, accept, onPick, onClose }: {
  source: MediaSource
  accept: 'image' | 'video' | 'both'
  onPick: (url: string) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<PickableMedia[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    source.list().then(setItems).catch(() => setError('Could not load your media library.')).finally(() => setLoading(false))
  }, [source])

  async function upload(file?: File) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const created = await source.upload(file)
      setItems(m => [...m, created])
      onPick(created.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const filtered = items.filter(m => (accept === 'both' || m.type === accept) && m.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 z-[1100] bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <p className="font-sans text-sm font-semibold text-gray-900">Your Media Library</p>
          <div className="flex items-center gap-2 flex-1 max-w-xs ml-auto">
            <Search className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="flex-1 font-sans text-sm focus:outline-none" />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={accept === 'both' ? 'image/*,video/*' : `${accept}/*`}
            className="hidden"
            onChange={e => upload(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 bg-[#2d6a4f] text-white px-3 py-1.5 font-sans text-xs disabled:opacity-50 whitespace-nowrap"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? 'Uploading…' : 'Upload New'}
          </button>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        {error && <p className="px-5 py-2 font-sans text-xs text-red-500 bg-red-50">{error}</p>}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center font-sans text-sm text-gray-400">No {accept === 'both' ? 'media' : `${accept}s`} yet — upload one to get started.</p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {filtered.map(item => (
                <button key={item.id} onClick={() => onPick(item.url)} className="group border border-gray-200 hover:border-[#2d6a4f] transition-colors text-left">
                  <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                    {item.type === 'video'
                      ? <video src={item.url} className="w-full h-full object-cover" muted />
                      : <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />}
                  </div>
                  <p className="px-2 py-1.5 font-sans text-[10px] text-gray-500 truncate">{item.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Single media field. Replaces a paste-a-URL text input entirely. */
export function MediaPicker({ value, onChange, source, accept = 'image', label }: {
  value: string
  onChange: (url: string) => void
  source: MediaSource
  accept?: 'image' | 'video' | 'both'
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const isVideo = accept === 'video' || (accept === 'both' && /\.(mp4|webm|mov)(\?|$)/i.test(value))
  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative border border-gray-200 bg-gray-50">
          {isVideo
            ? <video src={value} className="w-full h-32 object-cover" muted />
            : <img src={value} alt="" className="w-full h-32 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
          <button type="button" onClick={() => onChange('')} className="absolute top-1.5 right-1.5 bg-white/90 p-1 text-gray-500 hover:text-red-500" title="Remove">
            <Trash2 size={12} />
          </button>
        </div>
      ) : (
        <div className="border border-dashed border-gray-300 h-24 flex items-center justify-center text-gray-300">
          <ImageIcon size={20} />
        </div>
      )}
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:text-[#245741] transition-colors">
        <Upload size={12} /> {value ? 'Change' : 'Choose'} {label ?? (accept === 'video' ? 'Video' : 'Image')}
      </button>
      {open && (
        <MediaLibraryDialog source={source} accept={accept} onPick={url => { onChange(url); setOpen(false) }} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

/** Multi-image gallery field. */
export function MediaGalleryPicker({ value, onChange, source, max }: {
  value: string[]
  onChange: (urls: string[]) => void
  source: MediaSource
  max?: number
}) {
  const [open, setOpen] = useState(false)
  function add(url: string) {
    if (!value.includes(url)) onChange([...value, url])
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {value.map((url, i) => (
          <div key={i} className="relative aspect-[4/3] border border-gray-200 bg-gray-50">
            <img src={url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <button type="button" onClick={() => remove(i)} className="absolute top-1 right-1 bg-white/90 p-1 text-gray-500 hover:text-red-500">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {(!max || value.length < max) && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="aspect-[4/3] border border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
          >
            <ImageIcon size={16} />
            <span className="font-sans text-[10px]">Add Photo</span>
          </button>
        )}
      </div>
      {open && (
        <MediaLibraryDialog source={source} accept="image" onPick={url => { add(url); setOpen(false) }} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

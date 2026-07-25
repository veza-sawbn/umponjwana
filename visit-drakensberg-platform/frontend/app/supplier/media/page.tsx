'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Image as ImageIcon, Upload, Trash2, X, Loader2 } from 'lucide-react'
import { getMyMedia, uploadMedia, deleteMedia, type MediaItem } from '@/lib/supplier-media'

export default function MediaPage() {
  const [files, setFiles] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<MediaItem | null>(null)

  useEffect(() => {
    getMyMedia().then(setFiles).finally(() => setLoading(false))
  }, [])

  async function addFiles(raw: FileList | null) {
    if (!raw || raw.length === 0) return
    const imageFiles = Array.from(raw).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    setUploading(true)
    try {
      for (const f of imageFiles) {
        const created = await uploadMedia(f)
        setFiles(prev => [created, ...prev])
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault() }
  function onDragEnter(e: React.DragEvent) { e.preventDefault(); setDragging(true) }
  function onDragLeave(e: React.DragEvent) {
    // Only clear when pointer leaves the zone entirely, not when entering a child element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  async function remove(item: MediaItem) {
    setFiles(prev => prev.filter(x => x.id !== item.id))
    if (preview?.id === item.id) setPreview(null)
    try {
      await deleteMedia(item.id, item.url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete file')
      setFiles(prev => [item, ...prev])
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ImageIcon size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Media Library</h1>
        </div>
        <label
          htmlFor="media-upload"
          className={`flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploading ? 'Uploading…' : 'Upload Photos'}
        </label>
      </div>

      <p className="font-sans text-xs text-black/30 -mt-4">
        These are your own uploads — pick from them anywhere you'd normally paste an image URL, for your properties, rooms, activities and guide profiles.
      </p>

      <input
        id="media-upload"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => { addFiles(e.target.files); e.target.value = '' }}
      />

      {/* Drop zone — wrapping label so the whole area is clickable */}
      <label
        htmlFor="media-upload"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors select-none block ${
          dragging ? 'border-[#C9A96E] bg-[#C9A96E]/5' : 'border-black/10 hover:border-[#C9A96E]/40'
        }`}
      >
        <Upload size={24} className={`mb-3 transition-colors ${dragging ? 'text-[#C9A96E]' : 'text-black/20'}`} />
        <p className="font-sans text-sm text-black/40">
          {dragging ? 'Drop to upload' : 'Drag & drop photos here, or click to browse'}
        </p>
        <p className="font-sans text-xs text-black/25 mt-1">JPG, PNG, WebP, GIF, AVIF · max 50 MB per file</p>
      </label>

      {/* Grid */}
      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin text-black/20" /></div>
      ) : files.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-sans text-sm text-black/30">No photos uploaded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map(f => (
            <div key={f.id} className="group rounded-xl overflow-hidden border border-black/8 bg-white relative">
              <button
                onClick={() => remove(f)}
                className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
              <div
                className="h-32 bg-cover bg-center cursor-pointer"
                style={{ backgroundImage: `url(${f.url})` }}
                onClick={() => setPreview(f)}
              />
              <div className="p-3">
                <p className="font-sans text-xs font-medium text-black/70 truncate">{f.name}</p>
                <p className="font-sans text-[10px] text-black/30 mt-0.5">{f.size}{f.dimensions !== '—' ? ` · ${f.dimensions}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6" onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setPreview(null)}>
            <X size={24} />
          </button>
          <img
            src={preview.url}
            alt={preview.name}
            className="max-h-[85vh] max-w-full object-contain"
            onClick={e => e.stopPropagation()}
          />
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 font-sans text-xs text-white/50">{preview.name} · {preview.size}</p>
        </div>
      )}
    </div>
  )
}

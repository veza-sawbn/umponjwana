'use client'
import { Image, Upload } from 'lucide-react'

const MOCK_PHOTOS = [
  { id: '1', name: 'lodge-exterior.jpg', listing: 'Cathedral Peak Mountain Lodge', size: '2.4 MB' },
  { id: '2', name: 'mountain-suite.jpg', listing: 'Cathedral Peak Mountain Lodge', size: '1.8 MB' },
  { id: '3', name: 'family-chalet.jpg',  listing: 'Cathedral Peak Mountain Lodge', size: '3.1 MB' },
  { id: '4', name: 'berg-valley-01.jpg', listing: 'Berg Valley Guesthouse',        size: '2.0 MB' },
  { id: '5', name: 'garden-room.jpg',    listing: 'Berg Valley Guesthouse',        size: '1.5 MB' },
  { id: '6', name: 'hiking-trail.jpg',   listing: 'Cathedral Peak Mountain Lodge', size: '4.2 MB' },
]

const COLORS = ['bg-[#C9A96E]/20', 'bg-[#4A7251]/20', 'bg-black/10', 'bg-amber-100', 'bg-blue-100', 'bg-rose-100']

export default function MediaPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Media Library</h1>
        </div>
        <button className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Upload size={15} /> Upload Photos
        </button>
      </div>

      {/* Upload zone */}
      <div className="border-2 border-dashed border-black/10 rounded-xl p-10 text-center hover:border-[#C9A96E]/30 transition-colors cursor-pointer">
        <Upload size={24} className="text-black/20 mx-auto mb-3" />
        <p className="font-sans text-sm text-black/40">Drag & drop photos here, or click Upload Photos</p>
        <p className="font-sans text-xs text-black/25 mt-1">JPG, PNG, WebP · max 10 MB per file</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {MOCK_PHOTOS.map((p, i) => (
          <div key={p.id} className="group rounded-xl overflow-hidden border border-black/8 bg-white">
            <div className={`h-32 ${COLORS[i % COLORS.length]} flex items-center justify-center`}>
              <Image size={28} className="text-black/20" />
            </div>
            <div className="p-3">
              <p className="font-sans text-xs font-medium text-black/70 truncate">{p.name}</p>
              <p className="font-sans text-[10px] text-black/30 mt-0.5 truncate">{p.listing}</p>
              <p className="font-sans text-[10px] text-black/25">{p.size}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

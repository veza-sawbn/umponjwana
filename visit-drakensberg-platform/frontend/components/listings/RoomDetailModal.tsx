'use client'

import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Users, BedDouble, Sparkles, Moon, Check } from 'lucide-react'

export type RoomDetail = {
  id: string
  name: string
  description: string
  max_guests: number
  price_per_night: number
  amenities: string[]
  images?: string[]
  units?: number
  minNights?: number
  cleaningFee?: number
}

export default function RoomDetailModal({
  room, soldOut, unitsLeft, selected, onSelect, onClose, onZoom,
}: {
  room: RoomDetail
  soldOut: boolean
  unitsLeft: number | null
  selected: boolean
  onSelect: () => void
  onClose: () => void
  onZoom: (url: string) => void
}) {
  const images = room.images ?? []
  const [imageIndex, setImageIndex] = useState(0)
  const current = images[imageIndex]

  useEffect(() => { setImageIndex(0) }, [room.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && images.length > 1) setImageIndex(i => (i - 1 + images.length) % images.length)
      if (e.key === 'ArrowRight' && images.length > 1) setImageIndex(i => (i + 1) % images.length)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [images.length, onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={room.name}
      >
        {/* Gallery */}
        <div className="relative bg-[#1C2B1E]">
          {current ? (
            <button type="button" onClick={() => onZoom(current)} className="block w-full">
              <img src={current} alt={room.name} className="w-full aspect-[16/9] object-cover" />
            </button>
          ) : (
            <div className="w-full aspect-[16/9] flex flex-col items-center justify-center gap-2 text-white/40">
              <BedDouble size={28} />
              <span className="font-sans text-xs">No photos yet</span>
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-2 transition-colors"
          >
            <X size={16} />
          </button>
          {images.length > 1 && (
            <>
              <button
                aria-label="Previous photo"
                onClick={() => setImageIndex(i => (i - 1 + images.length) % images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                aria-label="Next photo"
                onClick={() => setImageIndex(i => (i + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
              <span className="absolute bottom-3 right-3 bg-black/60 text-white font-sans text-xs px-2 py-1">
                {imageIndex + 1} / {images.length}
              </span>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-1.5 p-3 overflow-x-auto bg-[#F7F5F2]">
            {images.map((url, i) => (
              <button
                key={`${url}-${i}`}
                onClick={() => setImageIndex(i)}
                className={`shrink-0 w-20 aspect-[4/3] overflow-hidden border-2 transition-colors ${i === imageIndex ? 'border-[#C9A96E]' : 'border-transparent opacity-70 hover:opacity-100'}`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Details */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-6 mb-4">
            <div>
              <h3 className="font-display italic text-3xl text-[#000000] mb-1">{room.name}</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-sm text-gray-500">
                <span className="flex items-center gap-1.5"><Users size={13} /> Sleeps {room.max_guests}</span>
                {typeof room.units === 'number' && room.units > 0 && (
                  <span className="flex items-center gap-1.5"><BedDouble size={13} /> {room.units} unit{room.units !== 1 ? 's' : ''}</span>
                )}
                {typeof room.minNights === 'number' && room.minNights > 1 && (
                  <span className="flex items-center gap-1.5"><Moon size={13} /> Min {room.minNights} nights</span>
                )}
                {typeof room.cleaningFee === 'number' && room.cleaningFee > 0 && (
                  <span className="flex items-center gap-1.5"><Sparkles size={13} /> R{room.cleaningFee.toLocaleString()} cleaning fee</span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display italic text-3xl text-[#2d6a4f]">R {room.price_per_night.toLocaleString()}</p>
              <p className="font-sans text-xs text-gray-400">per night</p>
            </div>
          </div>

          {soldOut ? (
            <p className="inline-block font-sans text-[10px] tracking-[0.1em] uppercase bg-red-50 text-red-500 px-2 py-1 mb-4">
              Sold out for the selected dates
            </p>
          ) : typeof unitsLeft === 'number' && unitsLeft <= 3 ? (
            <p className="inline-block font-sans text-[10px] tracking-[0.1em] uppercase bg-[#C9A96E]/15 text-[#8B6914] px-2 py-1 mb-4">
              Only {unitsLeft} left for the selected dates
            </p>
          ) : null}

          {room.description && (
            <p className="font-sans text-sm text-gray-700 leading-relaxed mb-5">{room.description}</p>
          )}

          {room.amenities?.length > 0 && (
            <div className="mb-6">
              <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2.5">What this room offers</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {room.amenities.map(a => (
                  <span key={a} className="flex items-center gap-2 font-sans text-sm text-gray-700">
                    <Check size={13} className="text-[#2d6a4f] shrink-0" /> {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => { if (!soldOut) { onSelect(); onClose() } }}
              disabled={soldOut}
              className={`flex-1 py-3 font-sans text-sm font-medium transition-colors ${soldOut ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : selected ? 'bg-[#2d6a4f] text-white' : 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'}`}
            >
              {soldOut ? 'Sold Out' : selected ? '✓ Room Selected' : 'Select This Room'}
            </button>
            <button onClick={onClose} className="px-6 py-3 font-sans text-sm border border-gray-300 text-gray-600 hover:border-gray-500 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { getSupplierEntities, type SupplierEntity } from '@/lib/supplier-entities'

type Review = SupplierEntity & { guest: string; item: string; rating: number; date: string; comment: string }

function Stars({ n }: { n: number }) {
  return <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} className={i < n ? 'text-[#C9A96E] fill-[#C9A96E]' : 'text-black/15'} />)}</div>
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser()
      if (data.user) setReviews(await getSupplierEntities<Review>('reviews', data.user.id))
      setLoading(false)
    }
    load()
  }, [])

  const avg = useMemo(() => reviews.length ? (reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length).toFixed(1) : '0.0', [reviews])

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Star size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Reviews</h1>
        <div className="ml-auto flex items-center gap-2">
          <Stars n={Math.round(+avg)} />
          <span className="font-sans text-sm font-semibold text-black/70">{avg}</span>
          <span className="font-sans text-xs text-black/30">({reviews.length} reviews)</span>
        </div>
      </div>
      {loading ? <p className="font-sans text-sm text-black/40">Loading reviews…</p> : reviews.length === 0 ? <p className="font-sans text-sm text-black/40">No reviews yet. Guest reviews will appear here once bookings are reviewed.</p> : (
        <div className="grid gap-4">{reviews.map(r => <div key={r.id} className="bg-white rounded-xl border border-black/8 p-5"><div className="flex items-center justify-between mb-2"><div><p className="font-sans font-semibold text-black/90 text-sm">{r.guest}</p><p className="font-sans text-xs text-black/40">{r.item} · {r.date}</p></div><Stars n={r.rating} /></div><p className="font-sans text-sm text-black/60 leading-relaxed">{r.comment}</p></div>)}</div>
      )}
    </div>
  )
}

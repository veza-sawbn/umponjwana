'use client'
import { Star } from 'lucide-react'

const MOCK = [
  { id: '1', guest: 'Sarah van der Merwe', item: 'Cathedral Peak Mountain Lodge', rating: 5, date: '2025-06-16', comment: 'Absolutely breathtaking. The staff were incredibly welcoming and the mountain views from the suite were unforgettable.' },
  { id: '2', guest: 'James Fourie',         item: 'Cathedral Peak Mountain Lodge', rating: 5, date: '2025-06-10', comment: 'Best family holiday we\'ve had in years. The kids loved the guided trail and evening braai.' },
  { id: '3', guest: 'Priya Naidoo',         item: 'Berg Valley Guesthouse',        rating: 4, date: '2025-06-02', comment: 'Charming and comfortable. Would have given 5 stars but the wifi was a bit slow.' },
  { id: '4', guest: 'Tom Kruger',            item: 'Berg Valley Guesthouse',        rating: 5, date: '2025-05-28', comment: 'The honeymoon cottage was perfect. Very private and beautifully furnished.' },
]

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={12} className={i < n ? 'text-[#C9A96E] fill-[#C9A96E]' : 'text-black/15'} />
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const avg = (MOCK.reduce((s, r) => s + r.rating, 0) / MOCK.length).toFixed(1)
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Star size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Reviews</h1>
        <div className="ml-auto flex items-center gap-2">
          <Stars n={Math.round(+avg)} />
          <span className="font-sans text-sm font-semibold text-black/70">{avg}</span>
          <span className="font-sans text-xs text-black/30">({MOCK.length} reviews)</span>
        </div>
      </div>

      <div className="grid gap-4">
        {MOCK.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-black/8 p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-sans font-semibold text-black/90 text-sm">{r.guest}</p>
                <p className="font-sans text-xs text-black/40">{r.item} · {r.date}</p>
              </div>
              <Stars n={r.rating} />
            </div>
            <p className="font-sans text-sm text-black/60 leading-relaxed">{r.comment}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

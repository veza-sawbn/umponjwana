'use client'
import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ChevronDown, ChevronUp } from 'lucide-react'

const AMENITIES = ['WiFi', 'Pool', 'Braai', 'Parking', 'Kitchen', 'Air conditioning', 'Pet friendly', 'Mountain views', 'River access', 'Hiking trails']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-gray-200 py-4">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-3">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && children}
    </div>
  )
}

export default function SearchFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(10000)
  const [rating, setRating] = useState('')
  const [amenities, setAmenities] = useState<string[]>([])

  const toggleAmenity = (a: string) =>
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])

  const apply = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('min_price', String(minPrice))
    params.set('max_price', String(maxPrice))
    if (rating) params.set('rating', rating)
    if (amenities.length) params.set('amenities', amenities.join(','))
    router.push(`${pathname}?${params.toString()}`)
  }

  const reset = () => {
    setMinPrice(0); setMaxPrice(10000); setRating(''); setAmenities([])
    router.push(pathname)
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <h3 className="text-base font-bold text-gray-900 mb-2">Filters</h3>

      <Section title="Price range (ZAR)">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>R{minPrice.toLocaleString()}</span>
            <span>R{maxPrice.toLocaleString()}</span>
          </div>
          <input type="range" min={0} max={10000} step={100} value={minPrice} onChange={e => setMinPrice(Number(e.target.value))} className="w-full accent-primary-500" />
          <input type="range" min={0} max={10000} step={100} value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} className="w-full accent-primary-500" />
        </div>
      </Section>

      <Section title="Guest rating">
        {[{ label: '5 stars', value: '5' }, { label: '4+ stars', value: '4' }, { label: '3+ stars', value: '3' }, { label: 'Any', value: '' }].map(r => (
          <label key={r.value} className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="radio" name="rating" value={r.value} checked={rating === r.value} onChange={() => setRating(r.value)} className="accent-primary-500" />
            <span className="text-sm text-gray-700">{r.label}</span>
          </label>
        ))}
      </Section>

      <Section title="Amenities">
        <div className="space-y-2">
          {AMENITIES.map(a => (
            <label key={a} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={amenities.includes(a)} onChange={() => toggleAmenity(a)} className="rounded accent-primary-500" />
              <span className="text-sm text-gray-700">{a}</span>
            </label>
          ))}
        </div>
      </Section>

      <div className="flex gap-2 mt-4">
        <Button onClick={apply} className="flex-1" size="sm">Apply</Button>
        <Button onClick={reset} variant="ghost" size="sm">Reset</Button>
      </div>
    </div>
  )
}

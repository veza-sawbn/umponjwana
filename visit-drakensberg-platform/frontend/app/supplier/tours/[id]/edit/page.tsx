'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

const MOCK: Record<string, {
  name: string; difficulty: string; days: number; minAge: number; maxGroup: number;
  meetingPoint: string; gpsLat: string; gpsLng: string; description: string;
  included: string[]; fitnessNotes: string; cancellation: string;
  pricePerPerson: number; groupDiscount: number; status: string
}> = {
  '1': { name: 'Cathedral Peak Summit Hike', difficulty: 'Challenging', days: 2, minAge: 14, maxGroup: 10, meetingPoint: 'Cathedral Peak Hotel carpark', gpsLat: '-28.9833', gpsLng: '29.2333', description: 'A demanding two-day summit attempt via the Cathedral Ridge route. Spectacular views of the Inner Tower and Column.', included: ['Guides', 'Permits', 'Meals', 'Accommodation'], fitnessNotes: 'Participants must be able to walk 20+ km with elevation gain. No cardiac conditions.', cancellation: '7 days', pricePerPerson: 3800, groupDiscount: 10, status: 'active' },
  '2': { name: 'Amphitheatre Circular Trail', difficulty: 'Moderate', days: 1, minAge: 10, maxGroup: 12, meetingPoint: 'Royal Natal National Park gate', gpsLat: '-28.6833', gpsLng: '28.9167', description: 'One-day circular hike via the Tugela Gorge with views of the Amphitheatre and Tugela Falls.', included: ['Guides', 'Permits'], fitnessNotes: 'Moderate fitness required. Chain ladders involved.', cancellation: '48h', pricePerPerson: 950, groupDiscount: 0, status: 'active' },
  '3': { name: 'Giants Castle Cultural Tour', difficulty: 'Easy', days: 3, minAge: 6, maxGroup: 8, meetingPoint: 'Giants Castle Camp reception', gpsLat: '-29.2333', gpsLng: '29.5000', description: 'Three-day immersive tour combining San rock art sites, wildlife walks and cultural storytelling.', included: ['Guides', 'Meals', 'Accommodation', 'Transport'], fitnessNotes: 'Suitable for all fitness levels including children.', cancellation: '14 days', pricePerPerson: 5200, groupDiscount: 15, status: 'active' },
}

const DIFFICULTIES = ['Easy', 'Moderate', 'Challenging', 'Extreme']
const INCLUDED_OPTIONS = ['Meals', 'Accommodation', 'Guides', 'Permits', 'Equipment', 'Transport']
const CANCELLATIONS = ['48h', '72h', '7 days', '14 days']

export default function EditTourPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const seed = MOCK[id] ?? MOCK['1']
  const [form, setForm] = useState(seed)
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  function toggleIncluded(item: string) {
    setForm(f => ({ ...f, included: f.included.includes(item) ? f.included.filter(x => x !== item) : [...f.included, item] }))
  }

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Tours</button>
      <h1 className="font-display italic text-2xl text-black/90 mb-6">Edit Tour</h1>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        <F label="Tour Name" required><input value={form.name} onChange={e => set('name', e.target.value)} className={inp} /></F>

        <F label="Difficulty">
          <div className="flex gap-2 flex-wrap">
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => set('difficulty', d)} className={chip(form.difficulty === d)}>{d}</button>
            ))}
          </div>
        </F>

        <div className="grid grid-cols-3 gap-4">
          <F label="Duration (days)" required><input type="number" value={form.days} onChange={e => set('days', +e.target.value)} min="1" className={inp} /></F>
          <F label="Min Age"><input type="number" value={form.minAge} onChange={e => set('minAge', +e.target.value)} min="0" className={inp} /></F>
          <F label="Max Group Size"><input type="number" value={form.maxGroup} onChange={e => set('maxGroup', +e.target.value)} min="1" className={inp} /></F>
        </div>

        <F label="Meeting Point / Start Location" required><input value={form.meetingPoint} onChange={e => set('meetingPoint', e.target.value)} className={inp} /></F>
        <div className="grid grid-cols-2 gap-4">
          <F label="GPS Latitude"><input value={form.gpsLat} onChange={e => set('gpsLat', e.target.value)} className={inp} /></F>
          <F label="GPS Longitude"><input value={form.gpsLng} onChange={e => set('gpsLng', e.target.value)} className={inp} /></F>
        </div>

        <F label="Description" required><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} className={`${inp} resize-none`} /></F>

        <F label="What's Included">
          <div className="flex flex-wrap gap-2">
            {INCLUDED_OPTIONS.map(item => (
              <button key={item} onClick={() => toggleIncluded(item)} className={chip(form.included.includes(item))}>{item}</button>
            ))}
          </div>
        </F>

        <F label="Fitness Requirements"><textarea value={form.fitnessNotes} onChange={e => set('fitnessNotes', e.target.value)} rows={3} className={`${inp} resize-none`} /></F>

        <div className="grid grid-cols-2 gap-4">
          <F label="Cancellation Policy">
            <select value={form.cancellation} onChange={e => set('cancellation', e.target.value)} className={inp}>
              {CANCELLATIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </F>
          <F label="Group Discount (%)"><input type="number" value={form.groupDiscount} onChange={e => set('groupDiscount', +e.target.value)} min="0" max="100" className={inp} /></F>
        </div>

        <F label="Price per Person (ZAR)" required><input type="number" value={form.pricePerPerson} onChange={e => set('pricePerPerson', +e.target.value)} className={inp} /></F>

        <F label="Status">
          <div className="flex gap-2">
            {['active', 'draft'].map(s => (
              <button key={s} onClick={() => set('status', s)} className={chip(form.status === s)}>{s}</button>
            ))}
          </div>
        </F>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={() => router.push('/supplier/tours')} className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors">Save Changes</button>
        <button onClick={() => router.back()} className="font-sans text-sm px-5 py-2.5 border border-black/15 rounded-lg text-black/50">Cancel</button>
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
const chip = (active: boolean) => `font-sans text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${active ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`
function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-sm font-medium text-black/70">{label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

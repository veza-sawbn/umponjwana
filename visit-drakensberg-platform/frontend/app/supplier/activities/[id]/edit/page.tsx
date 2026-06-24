'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

const MOCK: Record<string, {
  name: string; category: string; difficulty: string; durationH: number; durationM: number;
  minAge: number; maxGroup: number; meetingPoint: string; gpsLat: string; gpsLng: string;
  description: string; included: string[]; safetyNotes: string;
  pricePerPerson: number; priceGroup: number; depositRequired: boolean; depositPercent: string; status: string
}> = {
  '1': { name: 'Drakensberg Abseil', category: 'Adventure', difficulty: 'Challenging', durationH: 3, durationM: 0, minAge: 12, maxGroup: 8, meetingPoint: 'Cathedral Peak Hotel — Abseil Tower', gpsLat: '-28.9833', gpsLng: '29.2333', description: 'A thrilling 50m abseil down a sheer rock face with panoramic Drakensberg views.', included: ['Helmet & Harness', 'Guide', 'Safety Briefing'], safetyNotes: 'No heart conditions. Weight limit 120 kg. Closed-toe shoes required.', pricePerPerson: 650, priceGroup: 0, depositRequired: true, depositPercent: '30', status: 'active' },
  '2': { name: 'Zip-Line Circuit', category: 'Adventure', difficulty: 'Easy', durationH: 2, durationM: 0, minAge: 8, maxGroup: 12, meetingPoint: 'Berg Adventures base camp', gpsLat: '-28.9500', gpsLng: '29.2000', description: 'Five-line zip circuit through indigenous forest with views over the valleys.', included: ['Helmet & Harness', 'Guide', 'Safety Briefing', 'Refreshments'], safetyNotes: 'Weight limit 100 kg. Not suitable for those with severe vertigo.', pricePerPerson: 480, priceGroup: 0, depositRequired: false, depositPercent: '30', status: 'active' },
  '3': { name: 'Horseback Ridge Ride', category: 'Nature', difficulty: 'Moderate', durationH: 4, durationM: 0, minAge: 10, maxGroup: 6, meetingPoint: 'Berg Horse Trails stable', gpsLat: '-28.9700', gpsLng: '29.2100', description: 'A four-hour guided ride along the Little Berg ridgeline with stunning mountain scenery.', included: ['Guide', 'Helmet & Harness', 'Refreshments'], safetyNotes: 'Riders over 90 kg not accommodated. Must wear closed-toe shoes.', pricePerPerson: 750, priceGroup: 3800, depositRequired: true, depositPercent: '20', status: 'active' },
  '4': { name: 'Rock Climbing Intro', category: 'Adventure', difficulty: 'Moderate', durationH: 5, durationM: 0, minAge: 14, maxGroup: 4, meetingPoint: 'Monks Cowl gate', gpsLat: '-28.9400', gpsLng: '29.3700', description: 'Introduction to trad climbing on classic Drakensberg routes. Suitable for beginners with a guide.', included: ['Helmet & Harness', 'Guide', 'Equipment', 'Safety Briefing'], safetyNotes: 'Physical fitness required. Fear of heights may be a limiting factor.', pricePerPerson: 580, priceGroup: 0, depositRequired: true, depositPercent: '30', status: 'draft' },
}

const CATEGORIES = ['Adventure', 'Nature', 'Water', 'Cultural', 'Wellness', 'Family']
const DIFFICULTIES = ['Easy', 'Moderate', 'Challenging', 'Extreme']
const INCLUDED_OPTIONS = ['Helmet & Harness', 'Guide', 'Safety Briefing', 'Refreshments', 'Transport to Site', 'Photos/Video', 'Equipment']
const HOURS = Array.from({ length: 13 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

export default function EditActivityPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const seed = MOCK[id] ?? MOCK['1']
  const [form, setForm] = useState(seed)
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  function toggle(key: 'included', val: string) {
    setForm(f => {
      const arr = f[key] as string[]
      return { ...f, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }
    })
  }

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Activities</button>
      <h1 className="font-display italic text-2xl text-black/90 mb-6">Edit Activity</h1>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        <F label="Activity Name" required><input value={form.name} onChange={e => set('name', e.target.value)} className={inp} /></F>

        <F label="Category">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => <button key={c} onClick={() => set('category', c)} className={chip(form.category === c)}>{c}</button>)}
          </div>
        </F>

        <F label="Difficulty">
          <div className="flex gap-2 flex-wrap">
            {DIFFICULTIES.map(d => <button key={d} onClick={() => set('difficulty', d)} className={chip(form.difficulty === d)}>{d}</button>)}
          </div>
        </F>

        <div className="grid grid-cols-2 gap-4">
          <F label="Duration">
            <div className="flex gap-2">
              <select value={form.durationH} onChange={e => set('durationH', +e.target.value)} className={inp}>
                {HOURS.map(h => <option key={h} value={h}>{h}h</option>)}
              </select>
              <select value={form.durationM} onChange={e => set('durationM', +e.target.value)} className={inp}>
                {MINUTES.map(m => <option key={m} value={m}>{m}m</option>)}
              </select>
            </div>
          </F>
          <F label="Max Group Size" required><input type="number" value={form.maxGroup} onChange={e => set('maxGroup', +e.target.value)} min="1" className={inp} /></F>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <F label="Min Age"><input type="number" value={form.minAge} onChange={e => set('minAge', +e.target.value)} min="0" className={inp} /></F>
        </div>

        <F label="Meeting Point" required><input value={form.meetingPoint} onChange={e => set('meetingPoint', e.target.value)} className={inp} /></F>

        <div className="grid grid-cols-2 gap-4">
          <F label="GPS Latitude"><input value={form.gpsLat} onChange={e => set('gpsLat', e.target.value)} className={inp} /></F>
          <F label="GPS Longitude"><input value={form.gpsLng} onChange={e => set('gpsLng', e.target.value)} className={inp} /></F>
        </div>

        <F label="Description" required><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={`${inp} resize-none`} /></F>

        <F label="What's Included">
          <div className="flex flex-wrap gap-2">
            {INCLUDED_OPTIONS.map(item => <button key={item} onClick={() => toggle('included', item)} className={chip(form.included.includes(item))}>{item}</button>)}
          </div>
        </F>

        <F label="Safety Notes"><textarea value={form.safetyNotes} onChange={e => set('safetyNotes', e.target.value)} rows={3} className={`${inp} resize-none`} /></F>

        <div className="grid grid-cols-2 gap-4">
          <F label="Price per Person (ZAR)" required><input type="number" value={form.pricePerPerson} onChange={e => set('pricePerPerson', +e.target.value)} className={inp} /></F>
          <F label="Group Rate (ZAR, optional)"><input type="number" value={form.priceGroup || ''} onChange={e => set('priceGroup', +e.target.value)} placeholder="Flat group price" className={inp} /></F>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="dep" checked={form.depositRequired} onChange={e => set('depositRequired', e.target.checked)} className="rounded" />
            <label htmlFor="dep" className="font-sans text-sm text-black/70">Require deposit at booking</label>
          </div>
          {form.depositRequired && (
            <F label="Deposit (%)">
              <select value={form.depositPercent} onChange={e => set('depositPercent', e.target.value)} className={`${inp} w-40`}>
                {['10','20','25','30','50','100'].map(v => <option key={v} value={v}>{v}%</option>)}
              </select>
            </F>
          )}
        </div>

        <F label="Status">
          <div className="flex gap-2">
            {['active', 'draft'].map(s => <button key={s} onClick={() => set('status', s)} className={chip(form.status === s)}>{s}</button>)}
          </div>
        </F>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={() => router.push('/supplier/activities')} className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors">Save Changes</button>
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

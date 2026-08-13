'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getMyTours, updateTour } from '@/lib/tours'
import { GoogleAddressField } from '@/components/maps/GoogleAddressField'

const DIFFICULTIES = ['Easy', 'Moderate', 'Challenging', 'Extreme']
const INCLUDED_OPTIONS = ['Meals', 'Accommodation', 'Guides', 'Permits', 'Equipment', 'Transport']
const CANCELLATIONS = ['48h', '72h', '7 days', '14 days']

type FormState = {
  name: string; difficulty: string; days: number; minAge: number; maxGroup: number;
  meetingPoint: string; gpsLat: string; gpsLng: string; description: string;
  included: string[]; fitnessNotes: string; cancellation: string;
  pricePerPerson: number; groupDiscount: number; status: 'active' | 'draft'
}

const EMPTY: FormState = {
  name: '', difficulty: 'Moderate', days: 1, minAge: 0, maxGroup: 10,
  meetingPoint: '', gpsLat: '', gpsLng: '', description: '',
  included: [], fitnessNotes: '', cancellation: '48h',
  pricePerPerson: 0, groupDiscount: 0, status: 'active',
}

export default function EditTourPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    // Scoped read: a supplier must not be able to load another supplier's
    // tour into this form, even though the write would be refused by RLS.
    getMyTours().then(all => {
      const tour = all.find(t => t.id === id)
      if (tour) {
        setForm({
          name: tour.name, difficulty: tour.difficulty, days: tour.days,
          minAge: tour.minAge, maxGroup: tour.maxGroup,
          meetingPoint: tour.meetingPoint, gpsLat: tour.gpsLat, gpsLng: tour.gpsLng,
          description: tour.description, included: tour.included,
          fitnessNotes: tour.fitnessNotes, cancellation: tour.cancellation,
          pricePerPerson: tour.pricePerPerson, groupDiscount: tour.groupDiscount,
          status: tour.status,
        })
      }
      setLoading(false)
    })
  }, [id])

  function toggleIncluded(item: string) {
    setForm(f => ({ ...f, included: f.included.includes(item) ? f.included.filter(x => x !== item) : [...f.included, item] }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Tour name is required.'); return }
    setError('')
    setSaving(true)
    try {
      await updateTour(id, form)
      router.push('/supplier/tours')
    } catch {
      setError('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
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

        <GoogleAddressField label="Meeting Point / Start Location" required value={form.meetingPoint} lat={form.gpsLat} lng={form.gpsLng} placeholder="Start typing the meeting point" inputClassName={inp} labelClassName="font-sans text-sm font-medium text-black/70" onChange={({ address, lat, lng }) => { set('meetingPoint', address); if (lat) set('gpsLat', lat); if (lng) set('gpsLng', lng) }} />
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

        <F label="Price per Person (ZAR)" required><input type="number" value={form.pricePerPerson || ''} onChange={e => set('pricePerPerson', +e.target.value)} className={inp} /></F>

        <F label="Status">
          <div className="flex gap-2">
            {['active', 'draft'].map(s => (
              <button key={s} onClick={() => set('status', s)} className={chip(form.status === s)}>{s}</button>
            ))}
          </div>
        </F>
      </div>

      {error && <p className="font-sans text-sm text-red-500 mt-2">{error}</p>}

      <div className="flex gap-3 mt-6">
        <button onClick={handleSave} disabled={saving} className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
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

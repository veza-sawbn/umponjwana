'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { getActivityById, updateActivity } from '@/lib/activities'
import { getRegionNames } from '@/lib/regions'
import { GoogleAddressField } from '@/components/maps/GoogleAddressField'

const CATEGORIES = ['Adventure', 'Nature', 'Water', 'Cultural', 'Wellness', 'Family']
const DIFFICULTIES = ['Easy', 'Moderate', 'Challenging', 'Extreme']
const INCLUDED_OPTIONS = ['Helmet & Harness', 'Guide', 'Safety Briefing', 'Refreshments', 'Transport to Site', 'Photos/Video', 'Equipment']
const HOURS = Array.from({ length: 13 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

type FormState = {
  name: string; category: string; region: string; difficulty: string; durationH: number; durationM: number;
  minAge: number; maxGroup: number; meetingPoint: string; gpsLat: string; gpsLng: string;
  description: string; whatToWear: string; photos: string[]; included: string[]; safetyNotes: string;
  pricePerPerson: number; priceGroup: number; depositRequired: boolean; depositPercent: string;
  status: 'active' | 'draft'
}

const EMPTY: FormState = {
  name: '', category: '', region: '', difficulty: 'Moderate', durationH: 0, durationM: 0,
  minAge: 0, maxGroup: 1, meetingPoint: '', gpsLat: '', gpsLng: '',
  description: '', whatToWear: '', photos: [], included: [], safetyNotes: '',
  pricePerPerson: 0, priceGroup: 0, depositRequired: false, depositPercent: '30',
  status: 'active',
}

function ImageList({ images, onChange }: { images: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  function add() {
    const url = draft.trim()
    if (!url) return
    onChange([...images, url])
    setDraft('')
  }
  return (
    <div className="space-y-2">
      <p className="font-sans text-sm font-medium text-black/70">Photos</p>
      {images.map((url, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input value={url} onChange={e => { const next = [...images]; next[i] = e.target.value; onChange(next) }} className={`${inp} flex-1 text-xs`} />
          <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 shrink-0">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder="https://… paste image URL and press Enter" className={`${inp} flex-1 text-xs`} />
        <button type="button" onClick={add} className="shrink-0 flex items-center gap-1 font-sans text-xs text-[#C9A96E] border border-[#C9A96E]/30 rounded-lg px-2.5 py-1.5 hover:border-[#C9A96E]/60">
          <Plus size={12} /> Add
        </button>
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {images.map((url, i) => (
            <div key={i} className="aspect-video rounded-lg overflow-hidden bg-black/5 border border-black/8">
              <img src={url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EditActivityPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [regions, setRegions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getRegionNames().then(setRegions)
  }, [])

  useEffect(() => {
    getActivityById(id).then(a => {
      if (a) {
        setForm({
          name: a.name, category: a.category, region: a.region ?? '', difficulty: a.difficulty,
          durationH: a.durationH, durationM: a.durationM,
          minAge: a.minAge, maxGroup: a.maxGroup,
          meetingPoint: a.meetingPoint, gpsLat: a.gpsLat, gpsLng: a.gpsLng,
          description: a.description, whatToWear: a.whatToWear ?? '', photos: a.photos ?? [],
          included: a.included, safetyNotes: a.safetyNotes,
          pricePerPerson: a.pricePerPerson, priceGroup: a.priceGroup,
          depositRequired: a.depositRequired, depositPercent: a.depositPercent,
          status: a.status,
        })
      }
      setLoading(false)
    })
  }, [id])

  function toggle(item: string) {
    setForm(f => ({ ...f, included: f.included.includes(item) ? f.included.filter(x => x !== item) : [...f.included, item] }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Activity name is required.'); return }
    setError('')
    setSaving(true)
    try {
      await updateActivity(id, form)
      router.push('/supplier/activities')
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
      <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Activities</button>
      <h1 className="font-display italic text-2xl text-black/90 mb-6">Edit Activity</h1>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        <F label="Activity Name" required><input value={form.name} onChange={e => set('name', e.target.value)} className={inp} /></F>

        <F label="Category">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => <button key={c} onClick={() => set('category', c)} className={chip(form.category === c)}>{c}</button>)}
          </div>
        </F>

        <F label="Region" required>
          <select value={form.region} onChange={e => set('region', e.target.value)} className={inp}>
            <option value="">Select region…</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
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

        <F label="Min Age"><input type="number" value={form.minAge} onChange={e => set('minAge', +e.target.value)} min="0" className={inp} /></F>

        <GoogleAddressField label="Meeting Point" required value={form.meetingPoint} lat={form.gpsLat} lng={form.gpsLng} placeholder="Start typing the meeting point" inputClassName={inp} labelClassName="font-sans text-sm font-medium text-black/70" onChange={({ address, lat, lng }) => { set('meetingPoint', address); if (lat) set('gpsLat', lat); if (lng) set('gpsLng', lng) }} />

        <div className="grid grid-cols-2 gap-4">
          <F label="GPS Latitude"><input value={form.gpsLat} onChange={e => set('gpsLat', e.target.value)} className={inp} /></F>
          <F label="GPS Longitude"><input value={form.gpsLng} onChange={e => set('gpsLng', e.target.value)} className={inp} /></F>
        </div>

        <F label="Description" required><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={`${inp} resize-none`} /></F>

        <F label="What to Wear / Bring"><textarea value={form.whatToWear} onChange={e => set('whatToWear', e.target.value)} rows={3} className={`${inp} resize-none`} /></F>

        <ImageList images={form.photos} onChange={v => set('photos', v)} />

        <F label="What's Included">
          <div className="flex flex-wrap gap-2">
            {INCLUDED_OPTIONS.map(item => <button key={item} onClick={() => toggle(item)} className={chip(form.included.includes(item))}>{item}</button>)}
          </div>
        </F>

        <F label="Safety Notes"><textarea value={form.safetyNotes} onChange={e => set('safetyNotes', e.target.value)} rows={3} className={`${inp} resize-none`} /></F>

        <div className="grid grid-cols-2 gap-4">
          <F label="Price per Person (ZAR)" required><input type="number" value={form.pricePerPerson || ''} onChange={e => set('pricePerPerson', +e.target.value)} className={inp} /></F>
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
            {(['active', 'draft'] as const).map(s => <button key={s} onClick={() => set('status', s)} className={chip(form.status === s)}>{s}</button>)}
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

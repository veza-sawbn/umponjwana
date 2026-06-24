'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const CATEGORIES = ['Adventure', 'Nature', 'Water', 'Cultural', 'Wellness', 'Family']
const DIFFICULTY = ['Easy', 'Moderate', 'Challenging', 'Extreme']
const INCLUDED = ['Helmet & Harness', 'Guide', 'Safety Briefing', 'Refreshments', 'Transport to Site', 'Photos/Video']
const STEPS = ['Activity Details', 'Logistics', 'Inclusions & Safety', 'Pricing', 'Review']

export default function NewActivityPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '', category: '', description: '', difficulty: '',
    durationHours: '', durationMinutes: '0', minAge: '', maxGroupSize: '',
    meetingPoint: '', gpsLat: '', gpsLng: '', whatToWear: '',
    included: [] as string[], safetyNotes: '',
    pricePerPerson: '', priceGroup: '', depositRequired: false, depositPercent: '30',
  })

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const toggleIncluded = (item: string) =>
    setForm(f => ({ ...f, included: f.included.includes(item) ? f.included.filter(x => x !== item) : [...f.included, item] }))

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1">
        <ChevronLeft size={14} /> Activities
      </button>
      <h1 className="font-display italic text-2xl text-black/90 mb-6">Add Activity</h1>

      {/* Steps */}
      <div className="flex gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-sans text-xs font-semibold ${i < step ? 'bg-[#C9A96E] text-white' : i === step ? 'bg-[#C9A96E]/20 text-[#C9A96E] border border-[#C9A96E]' : 'bg-black/5 text-black/30'}`}>{i + 1}</div>
            {i < STEPS.length - 1 && <div className={`w-6 h-px ${i < step ? 'bg-[#C9A96E]' : 'bg-black/10'}`} />}
          </div>
        ))}
      </div>
      <p className="font-sans text-xs text-black/40 mb-6 -mt-2">{STEPS[step]}</p>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        {step === 0 && (
          <>
            <F label="Activity Name" required><input value={form.name} onChange={e => set('name', e.target.value)} className={inp} /></F>
            <F label="Category" required>
              <select value={form.category} onChange={e => set('category', e.target.value)} className={inp}>
                <option value="">Select…</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </F>
            <F label="Difficulty">
              <div className="flex gap-2 flex-wrap">
                {DIFFICULTY.map(d => (
                  <button key={d} onClick={() => set('difficulty', d)} className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${form.difficulty === d ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`}>{d}</button>
                ))}
              </div>
            </F>
            <F label="Description" required>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} className={`${inp} resize-none`} placeholder="What participants will experience…" />
            </F>
          </>
        )}

        {step === 1 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <F label="Duration (hours)"><input type="number" value={form.durationHours} onChange={e => set('durationHours', e.target.value)} min="0" className={inp} /></F>
              <F label="Min. Age"><input type="number" value={form.minAge} onChange={e => set('minAge', e.target.value)} min="0" placeholder="e.g. 10" className={inp} /></F>
            </div>
            <F label="Max Group Size" required><input type="number" value={form.maxGroupSize} onChange={e => set('maxGroupSize', e.target.value)} className={inp} /></F>
            <F label="Meeting Point / Start Location" required><input value={form.meetingPoint} onChange={e => set('meetingPoint', e.target.value)} className={inp} /></F>
            <div className="grid grid-cols-2 gap-4">
              <F label="GPS Latitude"><input value={form.gpsLat} onChange={e => set('gpsLat', e.target.value)} placeholder="-29.123456" className={inp} /></F>
              <F label="GPS Longitude"><input value={form.gpsLng} onChange={e => set('gpsLng', e.target.value)} placeholder="29.123456" className={inp} /></F>
            </div>
            <F label="What to Wear / Bring"><textarea value={form.whatToWear} onChange={e => set('whatToWear', e.target.value)} rows={3} className={`${inp} resize-none`} /></F>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <p className="font-sans text-sm font-medium text-black/70 mb-3">What&apos;s Included</p>
              <div className="flex flex-wrap gap-2">
                {INCLUDED.map(item => (
                  <button key={item} onClick={() => toggleIncluded(item)} className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${form.included.includes(item) ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`}>{item}</button>
                ))}
              </div>
            </div>
            <F label="Safety Notes & Requirements">
              <textarea value={form.safetyNotes} onChange={e => set('safetyNotes', e.target.value)} rows={4} className={`${inp} resize-none`} placeholder="Medical conditions that exclude participants, safety gear requirements…" />
            </F>
          </>
        )}

        {step === 3 && (
          <>
            <F label="Price per Person (ZAR)" required><input type="number" value={form.pricePerPerson} onChange={e => set('pricePerPerson', e.target.value)} className={inp} /></F>
            <F label="Group Rate (ZAR, optional)"><input type="number" value={form.priceGroup} onChange={e => set('priceGroup', e.target.value)} placeholder="Flat rate for full group" className={inp} /></F>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="dep" checked={form.depositRequired} onChange={e => set('depositRequired', e.target.checked)} className="rounded" />
              <label htmlFor="dep" className="font-sans text-sm text-black/70">Require deposit at booking</label>
            </div>
            {form.depositRequired && (
              <F label="Deposit (%)">
                <select value={form.depositPercent} onChange={e => set('depositPercent', e.target.value)} className={inp}>
                  {['10','20','25','30','50','100'].map(v => <option key={v} value={v}>{v}%</option>)}
                </select>
              </F>
            )}
          </>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="font-sans text-sm text-black/60">Review your activity before submitting.</p>
            <div className="rounded-lg bg-black/3 p-4 space-y-2">
              {[['Name', form.name], ['Category', form.category], ['Difficulty', form.difficulty], ['Duration', form.durationHours ? `${form.durationHours}h` : ''], ['Max Group', form.maxGroupSize], ['Meeting Point', form.meetingPoint], ['Price/Person', form.pricePerPerson ? `R ${form.pricePerPerson}` : '']].map(([k, v]) => v ? (
                <div key={k} className="flex gap-3 font-sans text-sm">
                  <span className="text-black/40 w-32 shrink-0">{k}</span>
                  <span className="text-black/80">{v}</span>
                </div>
              ) : null)}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <button onClick={() => setStep(s => s - 1)} disabled={step === 0} className="font-sans text-sm px-4 py-2 border border-black/15 rounded-lg text-black/60 disabled:opacity-30">Back</button>
        {step < STEPS.length - 1
          ? <button onClick={() => setStep(s => s + 1)} className="flex items-center gap-2 font-sans text-sm px-5 py-2 bg-[#C9A96E] text-white rounded-lg">Next <ChevronRight size={14} /></button>
          : <button onClick={() => router.push('/supplier/activities')} className="font-sans text-sm px-5 py-2 bg-black text-white rounded-lg">Submit Activity</button>
        }
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-sm font-medium text-black/70">{label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

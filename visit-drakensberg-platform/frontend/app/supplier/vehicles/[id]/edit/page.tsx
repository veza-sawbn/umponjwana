'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

const MOCK: Record<string, { name: string; type: string; reg: string; seats: number; year: number; fuel: string; airCon: boolean; luggage: string; features: string[]; notes: string }> = {
  '1': { name: 'Toyota Land Cruiser 79', type: '4×4',    reg: 'KZN 123 GP', seats: 7,  year: 2021, fuel: 'Diesel',  airCon: true,  luggage: 'large',  features: ['Cooler Box', 'USB Charging'], notes: 'Best for Sani Pass and rough terrain' },
  '2': { name: 'Mercedes Sprinter',      type: 'Minibus', reg: 'KZN 456 GP', seats: 16, year: 2022, fuel: 'Diesel',  airCon: true,  luggage: 'large',  features: ['Wi-Fi', 'USB Charging'],      notes: 'Airport group transfers' },
  '3': { name: 'Nissan Navara',          type: '4×4',    reg: 'KZN 789 GP', seats: 5,  year: 2020, fuel: 'Diesel',  airCon: false, luggage: 'medium', features: [],                             notes: 'Currently in for service' },
}

const VEHICLE_TYPES = ['4×4', 'Minibus', 'Sedan', 'SUV', 'Bakkie']
const FUELS = ['Petrol', 'Diesel', 'Electric', 'Hybrid']
const LUGGAGE = ['light', 'medium', 'large']
const FEATURE_OPTIONS = ['Wi-Fi', 'USB Charging', 'Child Seat Available', 'Wheelchair Accessible', 'Cooler Box']

export default function EditVehiclePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const seed = MOCK[id] ?? MOCK['1']
  const [form, setForm] = useState(seed)
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  function toggleFeature(f: string) {
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(f) ? prev.features.filter(x => x !== f) : [...prev.features, f],
    }))
  }

  return (
    <div className="p-8 max-w-xl">
      <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Vehicles</button>
      <h1 className="font-display italic text-2xl text-black/90 mb-6">Edit Vehicle</h1>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        <F label="Vehicle Name" required><input value={form.name} onChange={e => set('name', e.target.value)} className={inp} /></F>
        <div className="grid grid-cols-2 gap-4">
          <F label="Type" required>
            <select value={form.type} onChange={e => set('type', e.target.value)} className={inp}>
              {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </F>
          <F label="Registration Number">
            <input value={form.reg} onChange={e => set('reg', e.target.value)} className={inp} />
          </F>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <F label="Seats"><input type="number" value={form.seats} onChange={e => set('seats', +e.target.value)} min="1" className={inp} /></F>
          <F label="Year"><input type="number" value={form.year} onChange={e => set('year', +e.target.value)} className={inp} /></F>
          <F label="Fuel Type">
            <select value={form.fuel} onChange={e => set('fuel', e.target.value)} className={inp}>
              {FUELS.map(f => <option key={f}>{f}</option>)}
            </select>
          </F>
        </div>
        <F label="Luggage Capacity">
          <div className="flex gap-2">
            {LUGGAGE.map(l => (
              <button key={l} onClick={() => set('luggage', l)} className={`font-sans text-xs px-4 py-1.5 rounded-full border capitalize transition-colors ${form.luggage === l ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`}>{l}</button>
            ))}
          </div>
        </F>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="ac" checked={form.airCon} onChange={e => set('airCon', e.target.checked)} className="rounded" />
          <label htmlFor="ac" className="font-sans text-sm text-black/70">Air Conditioning</label>
        </div>
        <F label="Features">
          <div className="flex flex-wrap gap-2">
            {FEATURE_OPTIONS.map(f => (
              <button key={f} onClick={() => toggleFeature(f)} className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${form.features.includes(f) ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`}>{f}</button>
            ))}
          </div>
        </F>
        <F label="Notes"><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className={`${inp} resize-none`} /></F>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={() => router.push('/supplier/vehicles')} className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors">Save Changes</button>
        <button onClick={() => router.back()} className="font-sans text-sm px-5 py-2.5 border border-black/15 rounded-lg text-black/50 hover:border-black/30">Cancel</button>
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

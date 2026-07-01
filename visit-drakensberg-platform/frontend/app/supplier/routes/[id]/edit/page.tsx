'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { GoogleAddressField, useAutoDrivingDistance } from '@/components/maps/GoogleAddressField'

const MOCK: Record<string, { from: string; to: string; fromLat?: string; fromLng?: string; toLat?: string; toLng?: string; distanceKm: number; durationH: number; durationM: number; pricePerPerson: number; groupRate: number; vehicleTypes: string[]; notes: string; status: string }> = {
  '1': { from: 'King Shaka International Airport', to: 'Central Berg',          distanceKm: 210, durationH: 2, durationM: 30, pricePerPerson: 950, groupRate: 0,    vehicleTypes: ['4×4', 'Minibus'], notes: 'N3 highway, then R74 to Winterton.', status: 'active' },
  '2': { from: 'Durban CBD',                       to: 'Drakensberg Sun',       distanceKm: 185, durationH: 2, durationM: 15, pricePerPerson: 850, groupRate: 0,    vehicleTypes: ['Minibus', 'Sedan'], notes: '',                                   status: 'active' },
  '3': { from: 'Central Berg',                     to: "Monk's Cowl Trailhead", distanceKm: 42,  durationH: 0, durationM: 45, pricePerPerson: 350, groupRate: 1200, vehicleTypes: ['4×4'],              notes: 'Gravel road last 8 km.',             status: 'active' },
  '4': { from: 'Himeville',                        to: 'Sani Pass (Top)',        distanceKm: 55,  durationH: 1, durationM: 30, pricePerPerson: 600, groupRate: 2000, vehicleTypes: ['4×4'],              notes: '4×4 mandatory. Lesotho visa required for top.', status: 'active' },
}

const VEHICLE_OPTIONS = ['4×4', 'Minibus', 'Sedan', 'SUV']
const HOURS = Array.from({ length: 13 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

export default function EditRoutePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const seed = MOCK[id] ?? MOCK['1']
  const [form, setForm] = useState(seed)
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const { result: autoDistance, status: distanceCalcStatus } = useAutoDrivingDistance(
    { address: form.from, lat: form.fromLat, lng: form.fromLng },
    { address: form.to, lat: form.toLat, lng: form.toLng }
  )

  useEffect(() => {
    if (!autoDistance) return
    setForm(f => ({ ...f, distanceKm: autoDistance.distanceKm, durationH: Math.floor(autoDistance.durationMinutes / 60), durationM: autoDistance.durationMinutes % 60 }))
  }, [autoDistance])

  function toggleVehicle(v: string) {
    setForm(prev => ({
      ...prev,
      vehicleTypes: prev.vehicleTypes.includes(v) ? prev.vehicleTypes.filter(x => x !== v) : [...prev.vehicleTypes, v],
    }))
  }

  return (
    <div className="p-8 max-w-xl">
      <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Routes</button>
      <h1 className="font-display italic text-2xl text-black/90 mb-6">Edit Route</h1>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        <GoogleAddressField label="From (Pickup Location)" required value={form.from} lat={form.fromLat} lng={form.fromLng} inputClassName={inp} onChange={({ address, lat, lng }) => { set('from', address); if (lat) set('fromLat', lat); if (lng) set('fromLng', lng) }} />
        <GoogleAddressField label="To (Drop-off Location)" required value={form.to} lat={form.toLat} lng={form.toLng} inputClassName={inp} onChange={({ address, lat, lng }) => { set('to', address); if (lat) set('toLat', lat); if (lng) set('toLng', lng) }} />
        <p className="font-sans text-xs text-black/40">{distanceCalcStatus === 'calculating' ? 'Calculating distance and drive time in the background…' : distanceCalcStatus === 'done' ? `Distance and duration updated automatically (~${autoDistance?.durationText} drive).` : distanceCalcStatus === 'error' ? 'Could not auto-calculate distance for those locations — enter manually.' : 'Distance and duration below update automatically when both locations are set.'}</p>
        <div className="grid grid-cols-2 gap-4">
          <F label="Distance (km)"><input type="number" value={form.distanceKm} onChange={e => set('distanceKm', +e.target.value)} className={inp} /></F>
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
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Price per Person (ZAR)" required><input type="number" value={form.pricePerPerson} onChange={e => set('pricePerPerson', +e.target.value)} className={inp} /></F>
          <F label="Group Rate (ZAR, optional)"><input type="number" value={form.groupRate || ''} onChange={e => set('groupRate', +e.target.value)} placeholder="Flat group price" className={inp} /></F>
        </div>
        <F label="Vehicle Types">
          <div className="flex gap-2 flex-wrap">
            {VEHICLE_OPTIONS.map(v => (
              <button key={v} onClick={() => toggleVehicle(v)} className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${form.vehicleTypes.includes(v) ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`}>{v}</button>
            ))}
          </div>
        </F>
        <F label="Route Notes"><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className={`${inp} resize-none`} /></F>
        <F label="Status">
          <div className="flex gap-2">
            {['active', 'inactive'].map(s => (
              <button key={s} onClick={() => set('status', s)} className={`font-sans text-xs px-4 py-1.5 rounded-full border capitalize transition-colors ${form.status === s ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`}>{s}</button>
            ))}
          </div>
        </F>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={() => router.push('/supplier/routes')} className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors">Save Changes</button>
        <button onClick={() => router.back()} className="font-sans text-sm px-5 py-2.5 border border-black/15 rounded-lg text-black/50">Cancel</button>
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

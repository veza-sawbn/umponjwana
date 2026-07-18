'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Truck } from 'lucide-react'
import { getSupplierEntity, updateSupplierEntity } from '@/lib/supplier-entities'
import { GoogleAddressField, type GooglePlaceSelection } from '@/components/maps/GoogleAddressField'
import type { TransportVehicle } from '@/lib/transport'

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
const VEHICLE_TYPES = ['Shuttle', '4×4', 'Minibus', 'Sedan', 'SUV', 'Touring van', 'Coach', 'Bakkie']

function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-sm font-medium text-black/70">{label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

export default function EditVehiclePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', make: '', model: '', type: 'Shuttle', seats: '8', registration: '' })
  const [location, setLocation] = useState<GooglePlaceSelection>({ address: '' })

  useEffect(() => {
    async function load() {
      const vehicle = await getSupplierEntity<TransportVehicle>('vehicles', id)
      if (vehicle) {
        setForm({
          name: vehicle.name ?? '',
          make: vehicle.make ?? '',
          model: vehicle.model ?? '',
          type: vehicle.type ?? 'Shuttle',
          seats: String(vehicle.seats ?? vehicle.capacity ?? 8),
          registration: vehicle.registration ?? vehicle.reg ?? '',
        })
        if (vehicle.currentLocation) setLocation(vehicle.currentLocation)
      }
      setLoading(false)
    }
    load()
  }, [id])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    try {
      await updateSupplierEntity<TransportVehicle>('vehicles', id, {
        ...form,
        seats: Number(form.seats) || 0,
        capacity: Number(form.seats) || 0,
        currentLocation: location.address ? location : undefined,
      })
      router.push('/supplier/vehicles')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8"><p className="font-sans text-sm text-black/40">Loading vehicle…</p></div>

  return (
    <div className="p-8 max-w-xl">
      <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Vehicles</button>
      <div className="flex items-center gap-3 mb-6"><Truck size={20} className="text-[#C9A96E]" /><h1 className="font-display italic text-2xl text-black/90">Edit Vehicle</h1></div>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        <F label="Vehicle Name" required><input value={form.name} onChange={e => set('name', e.target.value)} className={inp} /></F>
        <div className="grid grid-cols-2 gap-4">
          <F label="Make"><input value={form.make} onChange={e => set('make', e.target.value)} className={inp} /></F>
          <F label="Model"><input value={form.model} onChange={e => set('model', e.target.value)} className={inp} /></F>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <F label="Type" required>
            <select value={form.type} onChange={e => set('type', e.target.value)} className={inp}>
              {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </F>
          <F label="Seats"><input type="number" min={1} value={form.seats} onChange={e => set('seats', e.target.value)} className={inp} /></F>
          <F label="Registration"><input value={form.registration} onChange={e => set('registration', e.target.value)} className={inp} /></F>
        </div>
        <GoogleAddressField
          label="Current location"
          value={location.address}
          lat={location.lat}
          lng={location.lng}
          placeholder="Depot, town or lodge"
          inputClassName={inp}
          onChange={setLocation}
        />
        <p className="font-sans text-xs text-black/40">
          Location updates automatically when a trip completes (the vehicle parks at the drop-off) — only set it here
          to correct the record.
        </p>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={save} disabled={saving} className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors disabled:opacity-60">{saving ? 'Saving…' : 'Save Changes'}</button>
        <button onClick={() => router.back()} className="font-sans text-sm px-5 py-2.5 border border-black/15 rounded-lg text-black/50 hover:border-black/30">Cancel</button>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { GoogleAddressField, useAutoDrivingDistance } from '@/components/maps/GoogleAddressField'
import { getSupplierEntity, updateSupplierEntity, type SupplierEntity } from '@/lib/supplier-entities'

/**
 * Edit one transport route.
 *
 * WHAT THIS PAGE USED TO DO
 *   Nothing. It seeded itself from a hardcoded MOCK table — four invented
 *   airport transfers — falling back to MOCK['1'] for any id it did not
 *   recognise, which is every real route id. "Save Changes" was
 *   `router.push('/supplier/routes')`: it wrote nothing and said nothing.
 *
 *   So a supplier could open their Sani Pass route, find someone else's
 *   invented pricing in the fields, correct it, press Save, and be returned to
 *   a list still showing their original figures. The list page beside it has
 *   always read real rows (getSupplierEntities('routes', …)), and the "new"
 *   page has always written them — only the edit path was a shell.
 *
 * It now loads the row and writes the row, using the same helpers as its two
 * neighbours. Nothing new was needed.
 */

type Route = SupplierEntity & {
  from?: string
  to?: string
  fromLat?: string
  fromLng?: string
  toLat?: string
  toLng?: string
  distanceKm?: number
  durationH?: number
  durationM?: number
  pricePerPerson?: number
  groupRate?: number
  vehicleTypes?: string[]
  notes?: string
}

const VEHICLE_OPTIONS = ['4×4', 'Minibus', 'Sedan', 'SUV']
const HOURS = Array.from({ length: 13 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

const EMPTY = {
  from: '', to: '', fromLat: '', fromLng: '', toLat: '', toLng: '',
  distanceKm: 0, durationH: 0, durationM: 0,
  pricePerPerson: 0, groupRate: 0,
  vehicleTypes: [] as string[], notes: '', status: 'active',
}

export default function EditRoutePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // A route that cannot be loaded must say so. Showing an empty form for a
  // row that does not exist is how the mock version misled people.
  const [error, setError] = useState('')

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const route = await getSupplierEntity<Route>('routes', id)
        if (cancelled) return
        if (!route) {
          setError('That route could not be found. It may have been deleted.')
          return
        }
        setForm({
          from: route.from ?? '',
          to: route.to ?? '',
          fromLat: route.fromLat ?? '',
          fromLng: route.fromLng ?? '',
          toLat: route.toLat ?? '',
          toLng: route.toLng ?? '',
          distanceKm: Number(route.distanceKm) || 0,
          durationH: Number(route.durationH) || 0,
          durationM: Number(route.durationM) || 0,
          pricePerPerson: Number(route.pricePerPerson) || 0,
          groupRate: Number(route.groupRate) || 0,
          vehicleTypes: Array.isArray(route.vehicleTypes) ? route.vehicleTypes : [],
          notes: route.notes ?? '',
          status: route.status ?? 'active',
        })
      } catch {
        if (!cancelled) setError('Could not load that route. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const { result: autoDistance, status: distanceCalcStatus } = useAutoDrivingDistance(
    { address: form.from, lat: form.fromLat, lng: form.fromLng },
    { address: form.to, lat: form.toLat, lng: form.toLng }
  )

  useEffect(() => {
    if (!autoDistance) return
    setForm(f => ({
      ...f,
      distanceKm: autoDistance.distanceKm,
      durationH: Math.floor(autoDistance.durationMinutes / 60),
      durationM: autoDistance.durationMinutes % 60,
    }))
  }, [autoDistance])

  function toggleVehicle(v: string) {
    setForm(prev => ({
      ...prev,
      vehicleTypes: prev.vehicleTypes.includes(v)
        ? prev.vehicleTypes.filter(x => x !== v)
        : [...prev.vehicleTypes, v],
    }))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      // `duration` and `price` are mirrored the same way the "new" page writes
      // them, so a route created there and edited here keeps one shape.
      await updateSupplierEntity<Route>('routes', id, {
        ...form,
        duration: `${form.durationH}h ${form.durationM}m`,
        price: form.pricePerPerson,
      } as Partial<Route>)
      router.push('/supplier/routes')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save those changes. Please try again.')
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 font-sans text-sm text-black/40">Loading route…</div>
  }

  return (
    <div className="p-8 max-w-xl">
      <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Routes</button>
      <h1 className="font-display italic text-2xl text-black/90 mb-6">Edit Route</h1>

      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        <GoogleAddressField label="From (Pickup Location)" required value={form.from} lat={form.fromLat} lng={form.fromLng} inputClassName={inp} onChange={({ address, lat, lng }) => { set('from', address); if (lat) set('fromLat', lat); if (lng) set('fromLng', lng) }} />
        <GoogleAddressField label="To (Drop-off Location)" required value={form.to} lat={form.toLat} lng={form.toLng} inputClassName={inp} onChange={({ address, lat, lng }) => { set('to', address); if (lat) set('toLat', lat); if (lng) set('toLng', lng) }} />
        <p className="font-sans text-xs text-black/40">{distanceCalcStatus === 'calculating' ? 'Calculating distance and drive time in the background…' : distanceCalcStatus === 'done' ? `Distance and duration updated automatically (~${autoDistance?.durationText} drive).` : distanceCalcStatus === 'error' ? 'We could not auto-calculate distance for those locations. Enter it manually.' : 'Distance and duration below update automatically when both locations are set.'}</p>
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
          <F label="Price per person (R)"><input type="number" value={form.pricePerPerson} onChange={e => set('pricePerPerson', +e.target.value)} className={inp} /></F>
          <F label="Group rate (R, 0 = none)"><input type="number" value={form.groupRate} onChange={e => set('groupRate', +e.target.value)} className={inp} /></F>
        </div>
        <F label="Vehicle types">
          <div className="flex flex-wrap gap-2">
            {VEHICLE_OPTIONS.map(v => (
              <button key={v} onClick={() => toggleVehicle(v)} className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${form.vehicleTypes.includes(v) ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`}>{v}</button>
            ))}
          </div>
        </F>
        <F label="Notes"><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className={inp} /></F>
        <F label="Status">
          <div className="flex gap-2">
            {['active', 'draft', 'inactive'].map(s => (
              <button key={s} onClick={() => set('status', s)} className={`font-sans text-xs px-4 py-1.5 rounded-full border capitalize transition-colors ${form.status === s ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`}>{s}</button>
            ))}
          </div>
        </F>
      </div>

      <div className="flex gap-3 mt-5">
        <button onClick={save} disabled={saving} className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors disabled:opacity-60">{saving ? 'Saving…' : 'Save Changes'}</button>
        <button onClick={() => router.back()} className="font-sans text-sm px-5 py-2.5 border border-black/15 rounded-lg text-black/50">Cancel</button>
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="font-sans text-sm font-medium text-black/70">{label}</label>{children}</div>
}

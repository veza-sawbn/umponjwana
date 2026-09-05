'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarOff, Coins, MapPin, Plus, Truck, Users, Wrench } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import {
  addVehicleBlock, getSupplierVehicles, removeVehicleBlock, setVehicleFleetStatus,
  vehicleFleetStatus, vehicleHasOwnRate, vehicleSeats, type FleetStatus, type TransportVehicle,
} from '@/lib/transport'

// Vehicle availability is driven by the trip lifecycle (reserved → on trip →
// available at the drop-off) — this page only handles the manual exceptions:
// maintenance and date blocks.

const STATUS_STYLES: Record<FleetStatus, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  reserved: 'bg-blue-100 text-blue-700',
  on_trip: 'bg-indigo-100 text-indigo-700',
  maintenance: 'bg-amber-100 text-amber-700',
  blocked: 'bg-slate-100 text-slate-500',
}

const STATUS_LABELS: Record<FleetStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  on_trip: 'On trip',
  maintenance: 'Maintenance',
  blocked: 'Blocked',
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [blockForm, setBlockForm] = useState<{ vehicleId: string; from: string; to: string; reason: string } | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    if (data.user) setVehicles(await getSupplierVehicles(effectiveSupplierId(data.user.id)))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleMaintenance(vehicle: TransportVehicle) {
    const status = vehicleFleetStatus(vehicle)
    await setVehicleFleetStatus(vehicle.id, status === 'maintenance' ? 'available' : 'maintenance')
    await load()
  }

  async function saveBlock() {
    if (!blockForm || !blockForm.from || !blockForm.to) return
    const vehicle = vehicles.find(v => v.id === blockForm.vehicleId)
    if (!vehicle) return
    await addVehicleBlock(vehicle, { from: blockForm.from, to: blockForm.to, reason: blockForm.reason || 'Manual block' })
    setBlockForm(null)
    await load()
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Vehicles</h1>
        </div>
        <Link href="/supplier/vehicles/new" className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Plus size={15} /> Add Vehicle
        </Link>
      </div>

      <p className="font-sans text-xs text-black/40 max-w-2xl">
        Each vehicle carries its own rate — set it when you add or edit the vehicle, and guests are quoted that price
        when they pick it. Availability updates automatically as trips are accepted, started and completed — a
        completed trip parks the vehicle at its drop-off location, ready for follow-on work. Use maintenance and date
        blocks for the exceptions.
      </p>

      {loading ? (
        <p className="font-sans text-sm text-black/40">Loading vehicles…</p>
      ) : vehicles.length === 0 ? (
        <p className="font-sans text-sm text-black/40">No vehicles yet.</p>
      ) : (
        <div className="grid gap-3">
          {vehicles.map(v => {
            const status = vehicleFleetStatus(v)
            const name = v.name ?? ([v.make, v.model].filter(Boolean).join(' ') || 'Vehicle')
            return (
              <div key={v.id} className="bg-white rounded-xl border border-black/8 p-5 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
                    <Truck size={18} className="text-[#C9A96E]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans font-semibold text-black/90">{name}</p>
                    <div className="flex flex-wrap items-center gap-4 mt-1">
                      <span className="font-sans text-xs text-black/40">{v.type ?? 'Shuttle'}</span>
                      <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Users size={11} /> {vehicleSeats(v)} seats</span>
                      <span className="font-sans text-xs text-black/40">{v.reg ?? v.registration}</span>
                      <span className="font-sans text-xs text-black/40 flex items-center gap-1">
                        <Coins size={11} className={vehicleHasOwnRate(v) ? 'text-[#C9A96E]' : 'text-black/25'} />
                        {vehicleHasOwnRate(v)
                          ? [v.ratePerKm ? `R${v.ratePerKm}/km` : null, v.minimumFare ? `min R${v.minimumFare}` : null].filter(Boolean).join(' · ')
                          : 'Company rate'}
                      </span>
                      {v.currentLocation?.address && (
                        <span className="font-sans text-xs text-black/40 flex items-center gap-1">
                          <MapPin size={11} className="text-[#C9A96E]" /> {v.currentLocation.address}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`font-sans text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>
                    <Link href={`/supplier/vehicles/${v.id}/edit`} className="font-sans text-xs text-[#C9A96E] hover:underline">Edit</Link>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
                  {(status === 'available' || status === 'maintenance') && (
                    <button onClick={() => toggleMaintenance(v)}
                      className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 font-sans text-xs text-black/60 hover:border-black/30">
                      <Wrench size={12} /> {status === 'maintenance' ? 'Return to service' : 'Set maintenance'}
                    </button>
                  )}
                  <button onClick={() => setBlockForm({ vehicleId: v.id, from: '', to: '', reason: '' })}
                    className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 font-sans text-xs text-black/60 hover:border-black/30">
                    <CalendarOff size={12} /> Block dates
                  </button>
                  {(v.blocks ?? []).map(b => (
                    <span key={b.id} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-sans text-[11px] text-slate-600">
                      {b.from} → {b.to} · {b.reason}
                      <button onClick={async () => { await removeVehicleBlock(v, b.id); await load() }} className="text-slate-400 hover:text-red-500">✕</button>
                    </span>
                  ))}
                </div>

                {blockForm?.vehicleId === v.id && (
                  <div className="flex flex-wrap items-end gap-3 rounded-lg bg-[#F7F5F2] p-3">
                    <label className="font-sans text-xs text-black/50">From
                      <input type="date" value={blockForm.from} onChange={e => setBlockForm(f => f && { ...f, from: e.target.value })}
                        className="block mt-1 font-sans text-xs border border-black/10 rounded-lg px-2 py-1.5 bg-white" />
                    </label>
                    <label className="font-sans text-xs text-black/50">To
                      <input type="date" value={blockForm.to} onChange={e => setBlockForm(f => f && { ...f, to: e.target.value })}
                        className="block mt-1 font-sans text-xs border border-black/10 rounded-lg px-2 py-1.5 bg-white" />
                    </label>
                    <label className="font-sans text-xs text-black/50">Reason
                      <input value={blockForm.reason} onChange={e => setBlockForm(f => f && { ...f, reason: e.target.value })}
                        placeholder="Private hire, inspection…"
                        className="block mt-1 font-sans text-xs border border-black/10 rounded-lg px-2 py-1.5 bg-white" />
                    </label>
                    <button onClick={saveBlock} className="rounded-lg bg-[#C9A96E] px-3 py-1.5 font-sans text-xs text-white hover:bg-[#b8965d]">Save block</button>
                    <button onClick={() => setBlockForm(null)} className="font-sans text-xs text-black/40 hover:text-black/70">Cancel</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Truck } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { addSupplierEntity } from '@/lib/supplier-entities'

const input = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="font-sans text-sm font-medium text-black/70">{label}</label>{children}</div>
}

export default function NewVehiclePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', make: '', model: '', type: 'Shuttle', seats: '8', registration: '', status: 'active' })

  function setField(key: string, value: string) { setForm(current => ({ ...current, [key]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { alert('Not signed in'); return }
      await addSupplierEntity('vehicles', { ...form, supplierId: user.id, seats: Number(form.seats) || 0, capacity: Number(form.seats) || 0 })
      router.push('/supplier/vehicles')
    } finally {
      setSaving(false)
    }
  }

  return <div className="p-8 max-w-2xl"><button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Vehicles</button><div className="flex items-center gap-3 mb-6"><Truck size={20} className="text-[#C9A96E]" /><h1 className="font-display italic text-2xl text-black/90">Add Vehicle</h1></div><form onSubmit={handleSubmit} className="bg-white rounded-xl border border-black/8 p-6 space-y-5"><Field label="Vehicle Name"><input required className={input} value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Toyota Quantum 14-seater" /></Field><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="Make"><input className={input} value={form.make} onChange={e => setField('make', e.target.value)} placeholder="Toyota" /></Field><Field label="Model"><input className={input} value={form.model} onChange={e => setField('model', e.target.value)} placeholder="Quantum" /></Field></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Field label="Type"><select className={input} value={form.type} onChange={e => setField('type', e.target.value)}><option>Shuttle</option><option>4×4</option><option>Minibus</option><option>Sedan</option></select></Field><Field label="Seats"><input className={input} type="number" min={1} value={form.seats} onChange={e => setField('seats', e.target.value)} /></Field><Field label="Registration"><input className={input} value={form.registration} onChange={e => setField('registration', e.target.value)} placeholder="ND 123-456" /></Field></div><Field label="Status"><select className={input} value={form.status} onChange={e => setField('status', e.target.value)}><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></select></Field><button disabled={saving} className="rounded-lg bg-[#C9A96E] px-4 py-2 font-sans text-sm text-white hover:bg-[#b8965d] disabled:opacity-60">{saving ? 'Saving…' : 'Save Vehicle'}</button></form></div>
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Map } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { addSupplierEntity } from '@/lib/supplier-entities'

const input = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><label className="font-sans text-sm font-medium text-black/70">{label}</label>{children}</div> }

export default function NewRoutePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ from: '', to: '', durationH: '2', durationM: '0', distanceKm: '', pricePerPerson: '', status: 'active' })
  function setField(key: string, value: string) { setForm(current => ({ ...current, [key]: value })) }
  async function handleSubmit(e: React.FormEvent) { e.preventDefault(); setSaving(true); try { const { data: { user } } = await supabase.auth.getUser(); if (!user) { alert('Not signed in'); return } await addSupplierEntity('routes', { ...form, supplierId: user.id, durationH: Number(form.durationH) || 0, durationM: Number(form.durationM) || 0, duration: `${Number(form.durationH) || 0}h ${Number(form.durationM) || 0}m`, distanceKm: Number(form.distanceKm) || 0, pricePerPerson: Number(form.pricePerPerson) || 0, price: Number(form.pricePerPerson) || 0 }); router.push('/supplier/routes') } finally { setSaving(false) } }
  return <div className="p-8 max-w-2xl"><button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Routes</button><div className="flex items-center gap-3 mb-6"><Map size={20} className="text-[#C9A96E]" /><h1 className="font-display italic text-2xl text-black/90">Add Route</h1></div><form onSubmit={handleSubmit} className="bg-white rounded-xl border border-black/8 p-6 space-y-5"><Field label="From"><input required className={input} value={form.from} onChange={e => setField('from', e.target.value)} placeholder="Pickup address or area" /></Field><Field label="To"><input required className={input} value={form.to} onChange={e => setField('to', e.target.value)} placeholder="Drop-off address or area" /></Field><div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Field label="Hours"><input className={input} type="number" min={0} value={form.durationH} onChange={e => setField('durationH', e.target.value)} /></Field><Field label="Minutes"><input className={input} type="number" min={0} max={59} value={form.durationM} onChange={e => setField('durationM', e.target.value)} /></Field><Field label="Distance km"><input className={input} type="number" min={0} value={form.distanceKm} onChange={e => setField('distanceKm', e.target.value)} /></Field></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="Price per person"><input className={input} type="number" min={0} value={form.pricePerPerson} onChange={e => setField('pricePerPerson', e.target.value)} /></Field><Field label="Status"><select className={input} value={form.status} onChange={e => setField('status', e.target.value)}><option value="active">Active</option><option value="draft">Draft</option><option value="inactive">Inactive</option></select></Field></div><button disabled={saving} className="rounded-lg bg-[#C9A96E] px-4 py-2 font-sans text-sm text-white hover:bg-[#b8965d] disabled:opacity-60">{saving ? 'Saving…' : 'Save Route'}</button></form></div>
}

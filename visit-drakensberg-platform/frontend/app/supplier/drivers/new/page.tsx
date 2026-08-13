'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Users } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { addSupplierEntity } from '@/lib/supplier-entities'

const input = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><label className="font-sans text-sm font-medium text-black/70">{label}</label>{children}</div> }

export default function NewDriverPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ fullName: '', licenseType: 'PrDP', phone: '', email: '', languages: 'English', trips: '0', status: 'active' })
  function setField(key: string, value: string) { setForm(current => ({ ...current, [key]: value })) }
  async function handleSubmit(e: React.FormEvent) { e.preventDefault(); setSaving(true); try { const { data: { user } } = await supabase.auth.getUser(); if (!user) { alert('Not signed in'); return } await addSupplierEntity('drivers', { ...form, supplierId: effectiveSupplierId(user.id), name: form.fullName, license: form.licenseType, trips: Number(form.trips) || 0 }); router.push('/supplier/drivers') } finally { setSaving(false) } }
  return <div className="p-8 max-w-2xl"><button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Drivers</button><div className="flex items-center gap-3 mb-6"><Users size={20} className="text-[#C9A96E]" /><h1 className="font-display italic text-2xl text-black/90">Add Driver</h1></div><form onSubmit={handleSubmit} className="bg-white rounded-xl border border-black/8 p-6 space-y-5"><Field label="Full Name"><input required className={input} value={form.fullName} onChange={e => setField('fullName', e.target.value)} placeholder="Driver name" /></Field><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="License Type"><input className={input} value={form.licenseType} onChange={e => setField('licenseType', e.target.value)} placeholder="PrDP / Code 10" /></Field><Field label="Languages"><input className={input} value={form.languages} onChange={e => setField('languages', e.target.value)} placeholder="English, isiZulu" /></Field></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="Phone"><input className={input} value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+27…" /></Field><Field label="Email"><input className={input} type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="driver@example.com" /></Field></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="Trips"><input className={input} type="number" min={0} value={form.trips} onChange={e => setField('trips', e.target.value)} /></Field><Field label="Status"><select className={input} value={form.status} onChange={e => setField('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field></div><button disabled={saving} className="rounded-lg bg-[#C9A96E] px-4 py-2 font-sans text-sm text-white hover:bg-[#b8965d] disabled:opacity-60">{saving ? 'Saving…' : 'Save Driver'}</button></form></div>
}

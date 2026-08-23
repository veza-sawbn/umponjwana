'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Map, Plus, Clock, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { getSupplierEntities, type SupplierEntity } from '@/lib/supplier-entities'

type Route = SupplierEntity & { from: string; to: string; duration?: string; durationH?: number; durationM?: number; price?: number; pricePerPerson?: number; status: string }

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { async function load() { const { data } = await supabase.auth.getUser(); if (data.user) setRoutes(await getSupplierEntities<Route>('routes', effectiveSupplierId(data.user.id))); setLoading(false) } load() }, [])
  return <div className="p-8 space-y-6"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><Map size={20} className="text-[#C9A96E]" /><h1 className="font-display italic text-2xl text-black/90">Routes</h1></div><Link href="/supplier/routes/new" className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors"><Plus size={15} /> Add Route</Link></div>{loading ? <p className="font-sans text-sm text-black/40">Loading routes…</p> : routes.length === 0 ? <p className="font-sans text-sm text-black/40">No shuttle routes yet.</p> : <div className="grid gap-3">{routes.map(r => <div key={r.id} className="bg-white rounded-xl border border-black/8 p-5 flex items-center gap-4"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 font-sans text-sm font-semibold text-black/90"><span className="truncate">{r.from}</span><ArrowRight size={14} className="shrink-0 text-[#C9A96E]" /><span className="truncate">{r.to}</span></div><div className="flex items-center gap-4 mt-1"><span className="font-sans text-xs text-black/40 flex items-center gap-1"><Clock size={11} /> {r.duration ?? `${r.durationH ?? 0}h ${r.durationM ?? 0}m`}</span><span className="font-sans text-xs text-black/40">R {Number(r.pricePerPerson ?? r.price ?? 0).toLocaleString()}/person</span></div></div><div className="flex items-center gap-3 shrink-0"><span className="font-sans text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 capitalize">{r.status}</span><Link href={`/supplier/routes/${r.id}/edit`} className="font-sans text-xs text-[#C9A96E] hover:underline">Edit</Link></div></div>)}</div>}</div>
}

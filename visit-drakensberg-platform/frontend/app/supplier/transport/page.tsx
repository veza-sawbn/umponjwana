'use client'

import { useEffect, useState } from 'react'
import { Building2, Check, MapPin, Star, Truck } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { GoogleAddressField, type GooglePlaceSelection } from '@/components/maps/GoogleAddressField'
import {
  SUPPLIER_CATEGORIES, TRANSPORT_AREAS, companyAvgResponseMinutes, companyRating, companyReliability,
  getMyTransportCompany, saveTransportCompany,
  type SupplierCategory, type TransportCompany,
} from '@/lib/transport'

const input = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

export default function TransportCompanyPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [company, setCompany] = useState<TransportCompany | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [companyName, setCompanyName] = useState('')
  const [category, setCategory] = useState<SupplierCategory>('regional')
  const [homeBase, setHomeBase] = useState<GooglePlaceSelection>({ address: '' })
  const [serviceAreaIds, setServiceAreaIds] = useState<string[]>([])
  const [operatingRadiusKm, setOperatingRadiusKm] = useState('100')
  const [ratePerKm, setRatePerKm] = useState('10')
  const [minimumFare, setMinimumFare] = useState('350')
  const [contactPhone, setContactPhone] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) { setLoading(false); return }
      const ownerId = effectiveSupplierId(data.user.id)
      setUserId(ownerId)
      const existing = await getMyTransportCompany(ownerId)
      if (existing) {
        setCompany(existing)
        setCompanyName(existing.companyName)
        setCategory(existing.category)
        setHomeBase(existing.homeBase)
        setServiceAreaIds(existing.serviceAreaIds ?? [])
        setOperatingRadiusKm(String(existing.operatingRadiusKm || 100))
        setRatePerKm(String(existing.ratePerKm || 10))
        setMinimumFare(String(existing.minimumFare || 350))
        setContactPhone(existing.contactPhone ?? '')
        setDescription(existing.description ?? '')
      }
      setLoading(false)
    }
    load()
  }, [])

  function toggleArea(id: string) {
    setServiceAreaIds(current => current.includes(id) ? current.filter(a => a !== id) : [...current, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    setSaved(false)
    try {
      const result = await saveTransportCompany(userId, {
        companyName,
        category,
        homeBase,
        serviceAreaIds,
        operatingRadiusKm: Number(operatingRadiusKm) || 100,
        ratePerKm: Number(ratePerKm) || 10,
        minimumFare: Number(minimumFare) || 350,
        contactPhone,
        description,
      })
      setCompany(prev => prev ? { ...prev, ...result } : result)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8"><p className="font-sans text-sm text-black/40">Loading transport company…</p></div>

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Building2 size={20} className="text-[#C9A96E]" />
        <h1 className="font-display italic text-2xl text-black/90">Transport Company</h1>
      </div>
      <p className="font-sans text-sm text-black/50 max-w-xl">
        Register your company on the transport marketplace. Booking opportunities are matched to you by
        suitability — your operator category, service regions, fleet availability, reliability and pricing all count.
      </p>

      {company && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Completed trips" value={String(company.stats?.completedTrips ?? 0)} />
          <Stat label="Reliability" value={`${Math.round(companyReliability(company) * 100)}%`} />
          <Stat label="Avg response" value={companyAvgResponseMinutes(company) !== null ? `${companyAvgResponseMinutes(company)} min` : '—'} />
          <Stat label="Rating" value={`${companyRating(company)} / 5`} icon={<Star size={12} className="text-[#C9A96E]" />} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-black/8 p-6 space-y-6">
        <div className="space-y-1.5">
          <label className="font-sans text-sm font-medium text-black/70">Company name</label>
          <input required className={input} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Berg Shuttle Co." />
        </div>

        <div className="space-y-3">
          <label className="font-sans text-sm font-medium text-black/70">Operator category</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(Object.keys(SUPPLIER_CATEGORIES) as SupplierCategory[]).map(key => {
              const cat = SUPPLIER_CATEGORIES[key]
              const active = category === key
              return (
                <button type="button" key={key} onClick={() => setCategory(key)}
                  className={`text-left rounded-xl border p-4 transition-colors ${active ? 'border-[#C9A96E] bg-[#C9A96E]/5' : 'border-black/10 hover:border-black/25'}`}>
                  <p className="font-sans text-sm font-semibold text-black/85 flex items-center gap-2">
                    <Truck size={14} className={active ? 'text-[#C9A96E]' : 'text-black/30'} /> {cat.label}
                  </p>
                  <p className="font-sans text-xs text-black/45 mt-1 leading-relaxed">{cat.description}</p>
                  <p className="font-sans text-[11px] text-black/35 mt-2">e.g. {cat.exampleBases.join(' · ')}</p>
                  <p className="font-sans text-[11px] text-black/35 mt-1">{cat.typicalWork.join(' · ')}</p>
                </button>
              )
            })}
          </div>
          <p className="font-sans text-xs text-black/40">
            Your category decides which trips you are eligible for: gateway operators get airport and long-distance
            work, regional operators the in-region transfers and day tours, local operators the short valley runs.
          </p>
        </div>

        <GoogleAddressField
          label="Home base"
          required
          value={homeBase.address}
          lat={homeBase.lat}
          lng={homeBase.lng}
          placeholder="Where your fleet is stationed"
          inputClassName={input}
          onChange={setHomeBase}
        />

        <div className="space-y-2">
          <label className="font-sans text-sm font-medium text-black/70">Service regions</label>
          <div className="flex flex-wrap gap-2">
            {TRANSPORT_AREAS.map(area => {
              const active = serviceAreaIds.includes(area.id)
              return (
                <button type="button" key={area.id} onClick={() => toggleArea(area.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-sans text-xs transition-colors ${active ? 'border-[#C9A96E] bg-[#C9A96E]/10 text-black/80' : 'border-black/10 text-black/45 hover:border-black/30'}`}>
                  {active && <Check size={11} className="text-[#C9A96E]" />}
                  <MapPin size={11} className={active ? 'text-[#C9A96E]' : 'text-black/25'} />
                  {area.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="font-sans text-sm font-medium text-black/70">Operating radius (km)</label>
            <input type="number" min={10} className={input} value={operatingRadiusKm} onChange={e => setOperatingRadiusKm(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="font-sans text-sm font-medium text-black/70">Rate per km (R)</label>
            <input type="number" min={1} step="0.5" className={input} value={ratePerKm} onChange={e => setRatePerKm(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="font-sans text-sm font-medium text-black/70">Minimum fare (R)</label>
            <input type="number" min={0} className={input} value={minimumFare} onChange={e => setMinimumFare(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="font-sans text-sm font-medium text-black/70">Contact phone</label>
            <input className={input} value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+27 …" />
          </div>
          <div className="space-y-1.5">
            <label className="font-sans text-sm font-medium text-black/70">Short description</label>
            <input className={input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Airport transfers and trailhead drops since 2012" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button disabled={saving} className="rounded-lg bg-[#C9A96E] px-5 py-2.5 font-sans text-sm text-white hover:bg-[#b8965d] disabled:opacity-60">
            {saving ? 'Saving…' : company ? 'Update company' : 'Register company'}
          </button>
          {saved && <p className="font-sans text-xs text-emerald-600 flex items-center gap-1"><Check size={13} /> Saved. You are live on the marketplace.</p>}
        </div>
      </form>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-black/8 p-4">
      <p className="font-sans text-[11px] uppercase tracking-wide text-black/35 mb-1">{label}</p>
      <p className="font-display italic text-xl text-black/85 flex items-center gap-1.5">{icon}{value}</p>
    </div>
  )
}

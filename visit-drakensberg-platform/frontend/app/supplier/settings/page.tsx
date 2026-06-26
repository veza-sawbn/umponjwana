'use client'

import { useEffect, useState } from 'react'
import { Bell, Building2, Save, Settings, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { useSupplier } from '@/lib/supplier-context'

interface SupplierSettingsForm {
  businessName: string
  contactName: string
  contactEmail: string
  phone: string
  bookingEmail: string
  notifyBookings: boolean
  notifyMessages: boolean
  weeklySummary: boolean
}

const DEFAULT_FORM: SupplierSettingsForm = {
  businessName: '',
  contactName: '',
  contactEmail: '',
  phone: '',
  bookingEmail: '',
  notifyBookings: true,
  notifyMessages: true,
  weeklySummary: false,
}

type NotificationKey = 'notifyBookings' | 'notifyMessages' | 'weeklySummary'

const NOTIFICATION_SETTINGS: { key: NotificationKey; label: string }[] = [
  { key: 'notifyBookings', label: 'New booking alerts' },
  { key: 'notifyMessages', label: 'Guest message alerts' },
  { key: 'weeklySummary', label: 'Weekly performance summary' },
]

export default function SupplierSettingsPage() {
  const { supplierType, isApproved, fullName } = useSupplier()
  const [form, setForm] = useState<SupplierSettingsForm>(DEFAULT_FORM)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      const meta = user.user_metadata ?? {}
      setForm(current => ({
        ...current,
        businessName: meta.business_name ?? meta.company_name ?? '',
        contactName: meta.full_name ?? fullName ?? '',
        contactEmail: user.email ?? '',
        phone: meta.phone ?? '',
        bookingEmail: meta.booking_email ?? user.email ?? '',
      }))
    })
  }, [fullName])

  function update<K extends keyof SupplierSettingsForm>(key: K, value: SupplierSettingsForm[K]) {
    setSaved(false)
    setForm(current => ({ ...current, [key]: value }))
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(true)
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Settings size={20} className="text-[#C9A96E]" />
          <div>
            <h1 className="font-display italic text-2xl text-black/90">Supplier Settings</h1>
            <p className="font-sans text-sm text-black/40 mt-1">
              Manage your supplier profile, notifications, and account status.
            </p>
          </div>
        </div>
        <span className={`font-sans text-xs px-3 py-1 rounded-full ${isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {isApproved ? 'Approved' : 'Pending approval'}
        </span>
      </div>

      <form onSubmit={handleSave} className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Building2 size={17} className="text-[#C9A96E]" />
              <h2 className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider">Business profile</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="font-sans text-xs tracking-[0.1em] uppercase text-black/40 block mb-2">Business name</span>
                <input value={form.businessName} onChange={event => update('businessName', event.target.value)} className="w-full bg-[#F7F5F2] border border-black/10 px-4 py-3 font-sans text-sm text-black/80 outline-none focus:border-[#C9A96E]/60" placeholder="e.g. Cathedral Peak Lodge" />
              </label>
              <label className="block">
                <span className="font-sans text-xs tracking-[0.1em] uppercase text-black/40 block mb-2">Supplier type</span>
                <input value={supplierType ?? 'Supplier'} readOnly className="w-full bg-black/[0.03] border border-black/8 px-4 py-3 font-sans text-sm text-black/45 outline-none" />
              </label>
              <label className="block">
                <span className="font-sans text-xs tracking-[0.1em] uppercase text-black/40 block mb-2">Contact name</span>
                <input value={form.contactName} onChange={event => update('contactName', event.target.value)} className="w-full bg-[#F7F5F2] border border-black/10 px-4 py-3 font-sans text-sm text-black/80 outline-none focus:border-[#C9A96E]/60" />
              </label>
              <label className="block">
                <span className="font-sans text-xs tracking-[0.1em] uppercase text-black/40 block mb-2">Phone</span>
                <input value={form.phone} onChange={event => update('phone', event.target.value)} className="w-full bg-[#F7F5F2] border border-black/10 px-4 py-3 font-sans text-sm text-black/80 outline-none focus:border-[#C9A96E]/60" placeholder="+27 ..." />
              </label>
              <label className="block sm:col-span-2">
                <span className="font-sans text-xs tracking-[0.1em] uppercase text-black/40 block mb-2">Account email</span>
                <input value={form.contactEmail} readOnly className="w-full bg-black/[0.03] border border-black/8 px-4 py-3 font-sans text-sm text-black/45 outline-none" />
              </label>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Bell size={17} className="text-[#C9A96E]" />
              <h2 className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider">Notifications</h2>
            </div>

            <label className="block">
              <span className="font-sans text-xs tracking-[0.1em] uppercase text-black/40 block mb-2">Booking notification email</span>
              <input type="email" value={form.bookingEmail} onChange={event => update('bookingEmail', event.target.value)} className="w-full bg-[#F7F5F2] border border-black/10 px-4 py-3 font-sans text-sm text-black/80 outline-none focus:border-[#C9A96E]/60" />
            </label>

            <div className="space-y-3">
              {NOTIFICATION_SETTINGS.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-4 border border-black/8 rounded-lg px-4 py-3">
                  <span className="font-sans text-sm text-black/65">{label}</span>
                  <input type="checkbox" checked={form[key]} onChange={event => update(key, event.target.checked)} className="h-4 w-4 accent-[#C9A96E]" />
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-xl border border-black/8 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={17} className="text-[#C9A96E]" />
              <h2 className="font-sans text-sm font-semibold text-black/60 uppercase tracking-wider">Account status</h2>
            </div>
            <p className="font-sans text-sm text-black/50 leading-relaxed">
              {isApproved
                ? 'Your supplier account is approved and can manage listings, bookings, and customer messages.'
                : 'Your supplier account is being reviewed. You can update your details while approval is pending.'}
            </p>
          </div>

          <button type="submit" className="w-full bg-[#111111] text-white rounded-xl py-3.5 font-sans text-sm hover:bg-[#2d6a4f] transition-colors flex items-center justify-center gap-2">
            <Save size={16} />
            {saved ? 'Saved' : 'Save settings'}
          </button>
        </aside>
      </form>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Save, CheckCircle } from 'lucide-react'

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false)
  const [site, setSite] = useState({
    site_name: 'Visit Drakensberg',
    tagline: 'Discover the Berg',
    contact_email: 'hello@visitdrakensberg.com',
    support_phone: '+27 33 000 0000',
    booking_commission: '10',
    loyalty_per_rand: '1',
    require_supplier_approval: true,
    auto_publish_listings: false,
    maintenance_mode: false,
  })

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Platform Settings</h1>
        </div>
        <button
          onClick={handleSave}
          className={`inline-flex items-center gap-2 px-5 py-2.5 font-sans text-sm transition-colors ${saved ? 'bg-[#2d6a4f] text-white' : 'bg-[#C9A96E] text-[#1a1a1a] hover:bg-[#b8935e]'}`}
        >
          {saved ? <CheckCircle size={15} /> : <Save size={15} />}
          {saved ? 'Saved' : 'Save Settings'}
        </button>
      </div>

      <div className="max-w-2xl space-y-8">
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-5">Site Identity</h2>
          <div className="space-y-4">
            {[
              { label: 'Site Name', key: 'site_name' },
              { label: 'Tagline', key: 'tagline' },
              { label: 'Contact Email', key: 'contact_email' },
              { label: 'Support Phone', key: 'support_phone' },
            ].map(f => (
              <div key={f.key}>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">{f.label}</label>
                <input
                  value={(site as any)[f.key]}
                  onChange={e => setSite(s => ({ ...s, [f.key]: e.target.value }))}
                  className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-5">Business Rules</h2>
          <div className="space-y-4">
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Booking Commission (%)</label>
              <input
                type="number"
                value={site.booking_commission}
                onChange={e => setSite(s => ({ ...s, booking_commission: e.target.value }))}
                className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              />
              <p className="font-sans text-xs text-gray-400 mt-1">Platform fee deducted from each booking</p>
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Loyalty Points per Rand Spent</label>
              <input
                type="number"
                value={site.loyalty_per_rand}
                onChange={e => setSite(s => ({ ...s, loyalty_per_rand: e.target.value }))}
                className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-5">Platform Behaviour</h2>
          <div className="space-y-4">
            {[
              { key: 'require_supplier_approval', label: 'Require admin approval for new suppliers', desc: 'Suppliers must be approved before they can publish listings.' },
              { key: 'auto_publish_listings', label: 'Auto-publish supplier listings', desc: 'Skip the pending state and publish listings immediately on creation.' },
              { key: 'maintenance_mode', label: 'Maintenance mode', desc: 'Takes the public site offline. Admin and supplier dashboards remain accessible.' },
            ].map(toggle => (
              <div key={toggle.key} className="flex items-start justify-between gap-6 py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-sans text-sm font-medium text-gray-800">{toggle.label}</p>
                  <p className="font-sans text-xs text-gray-400 mt-0.5">{toggle.desc}</p>
                </div>
                <button
                  onClick={() => setSite(s => ({ ...s, [toggle.key]: !(s as any)[toggle.key] }))}
                  className={`shrink-0 w-11 h-6 transition-colors relative ${(site as any)[toggle.key] ? 'bg-[#2d6a4f]' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white transition-all ${(site as any)[toggle.key] ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Save, CheckCircle, AlertTriangle } from 'lucide-react'

export default function AccountSettingsPage() {
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState({ full_name: 'Sarah van der Merwe', email: 'sarah@example.com', phone: '+27 82 555 1234', bio: '' })
  const [notifs, setNotifs] = useState({ booking_updates: true, special_offers: true, new_events: false, loyalty_updates: true })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display italic text-3xl text-[#000000]">Account Settings</h1>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Profile */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-5">Profile Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Full Name</label>
              <input
                value={profile.full_name}
                onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Email Address</label>
              <input
                value={profile.email}
                readOnly
                className="w-full border border-gray-200 px-4 py-3 font-sans text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
              <p className="font-sans text-xs text-gray-400 mt-1">Email cannot be changed. Contact support if needed.</p>
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Phone Number</label>
              <input
                value={profile.phone}
                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Bio (optional)</label>
              <textarea
                value={profile.bio}
                onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                rows={3}
                placeholder="A short bio displayed on your reviews"
                className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none bg-[#F7F5F2]"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            className={`mt-5 inline-flex items-center gap-2 px-6 py-3 font-sans text-sm transition-colors ${saved ? 'bg-[#2d6a4f] text-white' : 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'}`}
          >
            {saved ? <CheckCircle size={15} /> : <Save size={15} />}
            {saved ? 'Saved' : 'Save Profile'}
          </button>
        </div>

        {/* Change password */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-5">Change Password</h2>
          <div className="space-y-4">
            {['Current Password', 'New Password', 'Confirm New Password'].map(label => (
              <div key={label}>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">{label}</label>
                <input type="password" className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
              </div>
            ))}
          </div>
          <button className="mt-5 border border-[#2d6a4f] text-[#2d6a4f] px-6 py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
            Update Password
          </button>
        </div>

        {/* Notification preferences */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-5">Notification Preferences</h2>
          <div className="space-y-4">
            {[
              { key: 'booking_updates', label: 'Booking updates', desc: 'Confirmations, changes and cancellations' },
              { key: 'special_offers', label: 'Special offers & deals', desc: 'Seasonal promotions from suppliers' },
              { key: 'new_events', label: 'New events in Drakensberg', desc: 'Upcoming events matching your interests' },
              { key: 'loyalty_updates', label: 'Loyalty & rewards', desc: 'Points earned and reward availability' },
            ].map(n => (
              <div key={n.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-sans text-sm font-medium text-gray-800">{n.label}</p>
                  <p className="font-sans text-xs text-gray-400 mt-0.5">{n.desc}</p>
                </div>
                <button
                  onClick={() => setNotifs(prev => ({ ...prev, [n.key]: !(prev as any)[n.key] }))}
                  className={`shrink-0 w-11 h-6 transition-colors relative ${(notifs as any)[n.key] ? 'bg-[#2d6a4f]' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white transition-all ${(notifs as any)[n.key] ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-white border border-red-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="font-display italic text-xl text-red-500">Danger Zone</h2>
          </div>
          <p className="font-sans text-sm text-gray-600 mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)} className="border border-red-200 text-red-400 px-5 py-2.5 font-sans text-sm hover:bg-red-50 transition-colors">
              Delete Account
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 p-4">
              <p className="font-sans text-sm text-red-600 font-medium mb-3">Are you absolutely sure? Type DELETE to confirm.</p>
              <input
                placeholder="Type DELETE"
                className="w-full border border-red-200 px-3 py-2 font-sans text-sm mb-3 focus:outline-none"
              />
              <div className="flex gap-2">
                <button className="bg-red-500 text-white px-4 py-2 font-sans text-sm hover:bg-red-600 transition-colors">Permanently Delete</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="border border-gray-200 text-gray-600 px-4 py-2 font-sans text-sm hover:bg-gray-50 transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

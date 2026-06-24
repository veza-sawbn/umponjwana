'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'

function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-sm font-medium text-black/70">
        {label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

const STATUS_OPTIONS = ['active', 'on leave', 'inactive'] as const
type DriverStatus = typeof STATUS_OPTIONS[number]

const STATUS_STYLES: Record<DriverStatus, string> = {
  active: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  'on leave': 'bg-amber-50 border-amber-200 text-amber-700',
  inactive: 'bg-red-50 border-red-200 text-red-600',
}
const STATUS_DOT: Record<DriverStatus, string> = {
  active: 'bg-emerald-500',
  'on leave': 'bg-amber-400',
  inactive: 'bg-red-400',
}

const MOCK_DRIVERS: Record<string, {
  fullName: string; licenseType: string; licenseNumber: string; languages: string;
  yearsExperience: number; phone: string; emergencyName: string; emergencyPhone: string; status: DriverStatus
}> = {
  '1': { fullName: 'Sipho Dlamini', licenseType: 'PDP', licenseNumber: 'KZN-PDP-2019-04821', languages: 'Zulu, English, Afrikaans', yearsExperience: 8, phone: '+27 82 345 6789', emergencyName: 'Nomsa Dlamini', emergencyPhone: '+27 72 123 4567', status: 'active' },
  '2': { fullName: 'Thabo Mokoena', licenseType: 'Code 10', licenseNumber: 'GP-C10-2021-00934', languages: 'Sotho, English', yearsExperience: 5, phone: '+27 83 456 7890', emergencyName: 'Lerato Mokoena', emergencyPhone: '+27 71 234 5678', status: 'active' },
  '3': { fullName: 'Ayanda Nkosi', licenseType: 'Code 8', licenseNumber: 'KZN-C8-2020-07712', languages: 'Zulu, English', yearsExperience: 3, phone: '+27 79 567 8901', emergencyName: 'Busi Nkosi', emergencyPhone: '+27 73 345 6789', status: 'on leave' },
}

export default function EditDriverPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const mock = MOCK_DRIVERS[id] ?? MOCK_DRIVERS['1']

  const [fullName, setFullName] = useState(mock.fullName)
  const [licenseType, setLicenseType] = useState(mock.licenseType)
  const [licenseNumber, setLicenseNumber] = useState(mock.licenseNumber)
  const [languages, setLanguages] = useState(mock.languages)
  const [yearsExperience, setYearsExperience] = useState(mock.yearsExperience)
  const [phone, setPhone] = useState(mock.phone)
  const [emergencyName, setEmergencyName] = useState(mock.emergencyName)
  const [emergencyPhone, setEmergencyPhone] = useState(mock.emergencyPhone)
  const [status, setStatus] = useState<DriverStatus>(mock.status)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await new Promise(r => setTimeout(r, 600))
    router.push('/supplier/drivers')
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.push('/supplier/drivers')}
            className="flex items-center justify-center w-9 h-9 rounded-full border border-black/8 bg-white hover:bg-black/5 transition-colors"
          >
            <ChevronLeft size={18} className="text-black/60" />
          </button>
          <div>
            <h1 className="font-display italic text-2xl font-semibold text-black">Edit Driver</h1>
            <p className="font-sans text-sm text-black/50 mt-0.5">Update driver profile and status</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-black/8 p-6 space-y-6">
          {/* Personal Info */}
          <div>
            <h2 className="font-display italic text-base font-medium text-black mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <F label="Full Name" required>
                  <input className={INPUT} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Sipho Dlamini" />
                </F>
              </div>
              <F label="Phone" required>
                <input className={INPUT} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 82 345 6789" />
              </F>
              <F label="Languages Spoken">
                <input className={INPUT} value={languages} onChange={e => setLanguages(e.target.value)} placeholder="e.g. Zulu, English, Afrikaans" />
              </F>
              <div className="sm:col-span-2">
                <F label="Years of Experience" required>
                  <input className={INPUT} type="number" min={0} max={50} value={yearsExperience} onChange={e => setYearsExperience(Number(e.target.value))} />
                </F>
              </div>
            </div>
          </div>

          {/* License Info */}
          <div>
            <h2 className="font-display italic text-base font-medium text-black mb-4">License Details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <F label="License Type" required>
                <select className={INPUT} value={licenseType} onChange={e => setLicenseType(e.target.value)}>
                  <option>Code 8</option>
                  <option>Code 10</option>
                  <option>PDP</option>
                </select>
              </F>
              <F label="License Number" required>
                <input className={INPUT} value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="e.g. KZN-PDP-2019-04821" />
              </F>
            </div>
          </div>

          {/* Emergency Contact */}
          <div>
            <h2 className="font-display italic text-base font-medium text-black mb-4">Emergency Contact</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <F label="Contact Name" required>
                <input className={INPUT} value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="e.g. Nomsa Dlamini" />
              </F>
              <F label="Contact Phone" required>
                <input className={INPUT} type="tel" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="+27 72 123 4567" />
              </F>
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="font-sans text-sm font-medium text-black/70 mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-sans text-sm capitalize transition-colors ${
                    status === s ? STATUS_STYLES[s] : 'bg-white border-black/10 text-black/40 hover:bg-black/5'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${status === s ? STATUS_DOT[s] : 'bg-black/20'}`} />
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-black/5">
            <button
              onClick={() => router.push('/supplier/drivers')}
              className="font-sans text-sm px-4 py-2 rounded-lg border border-black/10 text-black/60 hover:bg-black/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="font-sans text-sm px-5 py-2 rounded-lg bg-[#C9A96E] text-white hover:bg-[#b8935a] transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

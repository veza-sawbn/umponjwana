'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { getSupplierEntity, updateSupplierEntity, type SupplierEntity } from '@/lib/supplier-entities'

/**
 * Edit one driver.
 *
 * WHAT THIS PAGE USED TO DO
 *   Nothing. It seeded itself from a hardcoded MOCK_DRIVERS table — three
 *   invented people, with invented licence numbers and next-of-kin phone
 *   numbers — falling back to MOCK_DRIVERS['1'] for any id it did not
 *   recognise, which is every real driver id. "Save Changes" awaited a 600 ms
 *   timeout and navigated away: it wrote nothing, and the fake delay made it
 *   look like it had.
 *
 *   The list page beside it has always read real rows, and the "new" page has
 *   always written them. Only the edit path was a shell, so a supplier
 *   correcting a driver's PDP number was told it saved and it did not.
 */

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

type Driver = SupplierEntity & {
  fullName?: string
  name?: string
  licenseType?: string
  license?: string
  licenseNumber?: string
  languages?: string
  yearsExperience?: number
  phone?: string
  emergencyName?: string
  emergencyPhone?: string
}

export default function EditDriverPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [licenseType, setLicenseType] = useState('Code 8')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [languages, setLanguages] = useState('')
  const [yearsExperience, setYearsExperience] = useState(0)
  const [phone, setPhone] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [status, setStatus] = useState<DriverStatus>('active')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // A driver that cannot be loaded must say so. Showing a blank form for a row
  // that does not exist is a gentler version of what the mock did.
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const driver = await getSupplierEntity<Driver>('drivers', id)
        if (cancelled) return
        if (!driver) {
          setError('That driver could not be found. They may have been removed.')
          return
        }
        setFullName(driver.fullName ?? driver.name ?? '')
        setLicenseType(driver.licenseType ?? driver.license ?? 'Code 8')
        setLicenseNumber(driver.licenseNumber ?? '')
        setLanguages(driver.languages ?? '')
        setYearsExperience(Number(driver.yearsExperience) || 0)
        setPhone(driver.phone ?? '')
        setEmergencyName(driver.emergencyName ?? '')
        setEmergencyPhone(driver.emergencyPhone ?? '')
        setStatus((STATUS_OPTIONS as readonly string[]).includes(driver.status ?? '')
          ? (driver.status as DriverStatus) : 'active')
      } catch {
        if (!cancelled) setError('Could not load that driver. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      // `name` and `license` are mirrored the way the "new" page writes them,
      // and the list page reads either — so a driver created there and edited
      // here keeps one shape.
      await updateSupplierEntity<Driver>('drivers', id, {
        fullName, name: fullName,
        licenseType, license: licenseType,
        licenseNumber, languages, yearsExperience,
        phone, emergencyName, emergencyPhone, status,
      } as Partial<Driver>)
      router.push('/supplier/drivers')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save those changes. Please try again.')
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 font-sans text-sm text-black/40">Loading driver…</div>
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

        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">{error}</div>
        )}

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

'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Building2, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { getMyOperatorProfile, saveOperatorProfile, type OperatorProfile } from '@/lib/operators'
import { PROPERTY_REGIONS } from '@/lib/properties'
import { supplierMediaSource } from '@/lib/supplier-media'
import { MediaPicker } from '@/components/media/MediaPicker'

// Public supplier-directory profile: what visitors see on /guides. Guides
// registered under /supplier/guides appear on the public profile
// automatically once verified.

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

type FormState = {
  companyName: string
  logo: string
  location: string
  yearsOperating: number
  certifications: string
  languages: string
  activities: string
  overview: string
  operatingRegions: string[]
  licences: string
  insurance: string
  emergencyProcedures: string
  equipmentOwned: string
  status: 'active' | 'draft'
}

const EMPTY: FormState = {
  companyName: '', logo: '', location: '', yearsOperating: 1,
  certifications: '', languages: '', activities: '', overview: '',
  operatingRegions: [], licences: '', insurance: '', emergencyProcedures: '',
  equipmentOwned: '', status: 'draft',
}

const csv = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)

export default function CompanyProfilePage() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [existing, setExisting] = useState<OperatorProfile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Only matters for a first save: creating the profile row requires
  // is_active_supplier() to pass (role='supplier' AND is_approved=true).
  // Updating an existing profile has no approval gate. Checked here so an
  // unapproved account sees the reason before filling out the whole form,
  // not after clicking Save.
  const [approvalBlock, setApprovalBlock] = useState<string | null>(null)
  const set = (k: keyof FormState, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      // Company profile belongs to the SUPPLIER, not whoever is signed in.
      // When an operations employee is acting-as a managed supplier, this
      // resolves to the supplier's own id — using the raw signed-in user id
      // here would read and write the employee's own (non-supplier) profile
      // instead, and would misreport the employee's role/approval status as
      // if it were the supplier's.
      const ownerId = effectiveSupplierId(user.id)
      setUserId(ownerId)
      const profile = await getMyOperatorProfile(ownerId)

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('full_name, role, is_approved, approval_status')
        .eq('id', ownerId)
        .maybeSingle()
      if (myProfile && myProfile.role !== 'admin' && !myProfile.is_approved) {
        setApprovalBlock(
          `Your supplier account is not approved yet${myProfile.approval_status ? ` (status: ${myProfile.approval_status})` : ''}. ` +
          'You can fill in the form below, but saving it for the first time will be blocked until an administrator approves your account.',
        )
      }
      if (profile) {
        setExisting(profile)
        setForm({
          companyName: profile.companyName,
          logo: profile.logo,
          location: profile.location,
          yearsOperating: profile.yearsOperating,
          certifications: profile.certifications.join(', '),
          languages: profile.languages.join(', '),
          activities: profile.activities.join(', '),
          overview: profile.overview,
          operatingRegions: profile.operatingRegions,
          licences: profile.licences.join(', '),
          insurance: profile.insurance,
          emergencyProcedures: profile.emergencyProcedures,
          equipmentOwned: profile.equipmentOwned.join(', '),
          status: profile.status,
        })
      } else {
        // Prefer the supplier's own profile name over the signed-in user's
        // metadata — the two differ whenever an ops employee is acting-as.
        setForm(f => ({ ...f, companyName: myProfile?.full_name || user.user_metadata?.full_name || '' }))
      }
      setLoading(false)
    })
  }, [])

  function toggleRegion(r: string) {
    setForm(f => ({
      ...f,
      operatingRegions: f.operatingRegions.includes(r)
        ? f.operatingRegions.filter(x => x !== r)
        : [...f.operatingRegions, r],
    }))
  }

  async function save(status: 'active' | 'draft') {
    if (!userId) return
    if (!form.companyName.trim()) { toast.error('Company name is required.'); return }
    setSaving(true)
    try {
      const saved = await saveOperatorProfile(userId, {
        companyName: form.companyName.trim(),
        logo: form.logo.trim(),
        location: form.location.trim(),
        yearsOperating: form.yearsOperating,
        certifications: csv(form.certifications),
        languages: csv(form.languages),
        activities: csv(form.activities),
        overview: form.overview.trim(),
        operatingRegions: form.operatingRegions,
        licences: csv(form.licences),
        insurance: form.insurance.trim(),
        emergencyProcedures: form.emergencyProcedures.trim(),
        equipmentOwned: csv(form.equipmentOwned),
        rating: existing?.rating ?? null,
        reviewCount: existing?.reviewCount ?? 0,
        status,
      })
      setExisting(saved)
      set('status', status)
      toast.success(status === 'active' ? 'Profile published to the supplier directory.' : 'Profile saved as draft.')
    } catch (e) {
      // Surface the real reason — an unapproved account is refused by RLS, and
      // "please try again" would have the supplier retrying forever.
      toast.error(e instanceof Error ? e.message : 'Could not save the profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8"><p className="font-sans text-sm text-black/30">Loading profile…</p></div>

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Company Profile</h1>
        </div>
        <span className={`font-sans text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 ${form.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {form.status === 'active' ? <Eye size={11} /> : <EyeOff size={11} />}
          {form.status === 'active' ? 'Listed in directory' : 'Not listed'}
        </span>
      </div>
      <p className="font-sans text-sm text-black/40 -mt-3">
        This is your public listing in the Visit Drakensberg supplier directory. Verified guides from your Guides page appear on it automatically.
      </p>

      {!existing && approvalBlock && (
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 rounded-lg px-4 py-3.5">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="font-sans text-sm text-amber-800 leading-relaxed">{approvalBlock}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-4">
        <F label="Company Name" required><input value={form.companyName} onChange={e => set('companyName', e.target.value)} className={inp} /></F>
        <F label="Logo"><MediaPicker value={form.logo} onChange={url => set('logo', url)} source={supplierMediaSource} /></F>
        <F label="Location / Town"><input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Winterton, Central Berg" className={inp} /></F>
        <div className="grid grid-cols-2 gap-4">
          <F label="Years Operating"><input type="number" min={0} value={form.yearsOperating} onChange={e => set('yearsOperating', Math.max(0, +e.target.value))} className={inp} /></F>
          <F label="Languages (comma separated)"><input value={form.languages} onChange={e => set('languages', e.target.value)} placeholder="English, Zulu" className={inp} /></F>
        </div>
        <F label="Certifications (comma separated)"><input value={form.certifications} onChange={e => set('certifications', e.target.value)} placeholder="FGASA Accredited, TBCSA Registered" className={inp} /></F>
        <F label="Activities Offered (comma separated)"><input value={form.activities} onChange={e => set('activities', e.target.value)} placeholder="Multi-day traverses, Summit hikes" className={inp} /></F>
        <F label="Company Overview"><textarea rows={4} value={form.overview} onChange={e => set('overview', e.target.value)} className={`${inp} resize-none`} /></F>
        <F label="Operating Regions">
          <div className="flex flex-wrap gap-2">
            {PROPERTY_REGIONS.map(r => (
              <button key={r} type="button" onClick={() => toggleRegion(r)}
                className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${form.operatingRegions.includes(r) ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`}>
                {r}
              </button>
            ))}
          </div>
        </F>
        <F label="Licences (comma separated)"><input value={form.licences} onChange={e => set('licences', e.target.value)} placeholder="KZN Tourism Operator Licence …" className={inp} /></F>
        <F label="Insurance"><textarea rows={2} value={form.insurance} onChange={e => set('insurance', e.target.value)} className={`${inp} resize-none`} placeholder="Public liability cover, client evacuation cover…" /></F>
        <F label="Emergency Procedures"><textarea rows={3} value={form.emergencyProcedures} onChange={e => set('emergencyProcedures', e.target.value)} className={`${inp} resize-none`} placeholder="Communication equipment, first-aid certification, rescue protocol…" /></F>
        <F label="Equipment Owned (comma separated)"><input value={form.equipmentOwned} onChange={e => set('equipmentOwned', e.target.value)} placeholder="Expedition tents, Satellite phones" className={inp} /></F>
      </div>

      <div className="flex gap-3">
        <button onClick={() => save('active')} disabled={saving}
          className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save & List in Directory'}
        </button>
        <button onClick={() => save('draft')} disabled={saving}
          className="font-sans text-sm px-5 py-2.5 border border-black/15 rounded-lg text-black/50 hover:border-black/30 disabled:opacity-50">
          Save as Draft
        </button>
      </div>
    </div>
  )
}

function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-sm font-medium text-black/70">{label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

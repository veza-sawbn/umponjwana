'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ChevronLeft, CheckCircle, Clock, XCircle } from 'lucide-react'
import { getSupplierEntity, updateSupplierEntity } from '@/lib/supplier-entities'
import { GUIDE_TYPE_LABEL, type GuideProfile } from '@/lib/operators'
import { supplierMediaSource } from '@/lib/supplier-media'
import { MediaPicker } from '@/components/media/MediaPicker'

const ENTITY = 'guides'
const GUIDE_TYPES = ['certified', 'trainee'] as const

const STATUS_BADGE: Record<string, { label: string; Icon: typeof CheckCircle; cls: string }> = {
  verified: { label: 'Verified',       Icon: CheckCircle, cls: 'bg-emerald-100 text-emerald-700' },
  pending:  { label: 'Pending Review', Icon: Clock,       cls: 'bg-amber-100 text-amber-700' },
  rejected: { label: 'Rejected',       Icon: XCircle,     cls: 'bg-red-100 text-red-600' },
}

type FormState = {
  name: string; certs: string; guideNo: string; speciality: string; languages: string
  qualifications: string; yearsExperience: string; highestSummit: string
  completedExpeditions: string; portrait: string; bio: string
  guideType: 'certified' | 'trainee'
}

const EMPTY: FormState = {
  name: '', certs: '', guideNo: '', speciality: '', languages: '',
  qualifications: '', yearsExperience: '', highestSummit: '', completedExpeditions: '',
  portrait: '', bio: '', guideType: 'certified',
}

export default function EditGuidePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [status, setStatus] = useState<string>('pending')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getSupplierEntity<GuideProfile>(ENTITY, id).then(guide => {
      if (!guide) { setNotFound(true); setLoading(false); return }
      setStatus(guide.status ?? 'pending')
      setForm({
        name: guide.name ?? '',
        certs: guide.certs ?? '',
        guideNo: guide.guideNo ?? '',
        speciality: guide.speciality ?? '',
        languages: guide.languages ?? '',
        qualifications: guide.qualifications ?? '',
        yearsExperience: guide.yearsExperience ? String(guide.yearsExperience) : '',
        highestSummit: guide.highestSummit ?? '',
        completedExpeditions: guide.completedExpeditions ? String(guide.completedExpeditions) : '',
        portrait: guide.portrait ?? '',
        bio: guide.bio ?? '',
        // Rows saved before guideType existed default to certified.
        guideType: guide.guideType ?? 'certified',
      })
      setLoading(false)
    })
  }, [id])

  async function save() {
    if (!form.name.trim()) { toast.error('The guide\'s full name is required.'); return }
    setSaving(true)
    try {
      await updateSupplierEntity<GuideProfile>(ENTITY, id, {
        name: form.name.trim(),
        certs: form.certs.trim(),
        guideNo: form.guideNo.trim(),
        speciality: form.speciality.trim(),
        languages: form.languages.trim(),
        qualifications: form.qualifications.trim(),
        yearsExperience: Number(form.yearsExperience) || 0,
        highestSummit: form.highestSummit.trim(),
        completedExpeditions: Number(form.completedExpeditions) || 0,
        portrait: form.portrait,
        bio: form.bio.trim(),
        guideType: form.guideType,
      })
      toast.success('Guide updated.')
      router.push('/supplier/guides')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8"><p className="font-sans text-sm text-black/30">Loading guide…</p></div>
  }

  if (notFound) {
    return (
      <div className="p-8">
        <button onClick={() => router.push('/supplier/guides')} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1">
          <ChevronLeft size={14} /> Guides
        </button>
        <p className="font-sans text-sm text-black/50">
          This guide doesn&apos;t exist, or belongs to another supplier.
        </p>
      </div>
    )
  }

  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending
  const StatusIcon = badge.Icon

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <button onClick={() => router.push('/supplier/guides')} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1">
        <ChevronLeft size={14} /> Guides
      </button>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="font-display italic text-2xl text-black/90">Edit Guide</h1>
        <span className={`font-sans text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 ${badge.cls}`}>
          <StatusIcon size={11} /> {badge.label}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        <F label="Guide Type">
          <div className="flex gap-2">
            {GUIDE_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set('guideType', t)}
                className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  form.guideType === t ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'
                }`}
              >
                {GUIDE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          {form.guideType === 'trainee' && (
            <p className="font-sans text-xs text-black/40 mt-1.5">
              Internally trained staff without a formal FGASA/TBCSA certification yet — cert fields below are optional.
            </p>
          )}
        </F>

        <F label="Full Name" required><input value={form.name} onChange={e => set('name', e.target.value)} className={inp} /></F>

        <div className="grid grid-cols-2 gap-4">
          <F label={form.guideType === 'trainee' ? 'FGASA / Cert Number (optional)' : 'FGASA / Cert Number'}>
            <input value={form.certs} onChange={e => set('certs', e.target.value)} className={inp} />
          </F>
          <F label={form.guideType === 'trainee' ? 'TBCSA Guide Number (optional)' : 'TBCSA Guide Number'}>
            <input value={form.guideNo} onChange={e => set('guideNo', e.target.value)} className={inp} />
          </F>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <F label="Speciality"><input value={form.speciality} onChange={e => set('speciality', e.target.value)} className={inp} /></F>
          <F label="Languages"><input value={form.languages} onChange={e => set('languages', e.target.value)} placeholder="English, Zulu" className={inp} /></F>
        </div>

        <F label="Qualifications"><input value={form.qualifications} onChange={e => set('qualifications', e.target.value)} placeholder="FGASA Level 3, Wilderness First Responder" className={inp} /></F>

        <div className="grid grid-cols-2 gap-4">
          <F label="Years of Experience"><input type="number" min="0" value={form.yearsExperience} onChange={e => set('yearsExperience', e.target.value)} className={inp} /></F>
          <F label="Completed Expeditions"><input type="number" min="0" value={form.completedExpeditions} onChange={e => set('completedExpeditions', e.target.value)} className={inp} /></F>
        </div>

        <F label="Highest Summit"><input value={form.highestSummit} onChange={e => set('highestSummit', e.target.value)} placeholder="e.g. Mafadi (3,450m)" className={inp} /></F>

        <F label="Portrait"><MediaPicker value={form.portrait} onChange={url => set('portrait', url)} source={supplierMediaSource} /></F>

        <F label="Biography">
          <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={4} className={`${inp} resize-none`} placeholder="Shown on the guide's public profile…" />
        </F>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={save} disabled={saving} className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={() => router.push('/supplier/guides')} className="font-sans text-sm px-5 py-2.5 border border-black/15 rounded-lg text-black/50">Cancel</button>
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
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

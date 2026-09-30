'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ChevronLeft, CheckCircle, Clock, XCircle, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { getSupplierEntity, updateSupplierEntity } from '@/lib/supplier-entities'
import {
  GUIDE_TYPES, GUIDE_TYPE_LABEL, GUIDE_TYPE_HINT, guideTypeOf, revalidateGuidePage, type GuideProfile, type GuideType,
} from '@/lib/operators'
import { cleanBioSections, splitGuideName, MAX_BIO_SECTIONS, type BioSection } from '@/lib/guide-profile'
import { supplierMediaSource } from '@/lib/supplier-media'
import { MediaPicker } from '@/components/media/MediaPicker'

const ENTITY = 'guides'

// A trainee is not yet registered, so they are the one type that may be saved
// without a guide number.
const GUIDE_NO_LABEL = 'SA Tourism Guide Number'
const guideNoLabel = (t: GuideType) =>
  t === 'trainee' ? `${GUIDE_NO_LABEL} (optional)` : GUIDE_NO_LABEL

const STATUS_BADGE: Record<string, { label: string; Icon: typeof CheckCircle; cls: string }> = {
  verified: { label: 'Verified',       Icon: CheckCircle, cls: 'bg-emerald-100 text-emerald-700' },
  pending:  { label: 'Pending Review', Icon: Clock,       cls: 'bg-amber-100 text-amber-700' },
  rejected: { label: 'Rejected',       Icon: XCircle,     cls: 'bg-red-100 text-red-600' },
}

type FormState = {
  name: string; email: string; guideNo: string; speciality: string; languages: string
  qualifications: string; yearsExperience: string; highestSummit: string
  completedExpeditions: string; portrait: string; bio: string
  knownAs: string; bioHeadline: string; bioHighlight: string
  guideType: GuideType
  bioSections: BioSection[]
}

type TextField = Exclude<keyof FormState, 'guideType' | 'bioSections'>

const EMPTY: FormState = {
  name: '', email: '', guideNo: '', speciality: '', languages: '',
  qualifications: '', yearsExperience: '', highestSummit: '', completedExpeditions: '',
  portrait: '', bio: '', knownAs: '', bioHeadline: '', bioHighlight: '',
  guideType: 'certified', bioSections: [],
}

export default function EditGuidePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [status, setStatus] = useState<string>('pending')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const set = (k: TextField, v: string) => setForm(f => ({ ...f, [k]: v }))
  const setSection = (i: number, patch: Partial<BioSection>) =>
    setForm(f => ({ ...f, bioSections: f.bioSections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  const addSection = () => setForm(f => ({ ...f, bioSections: [...f.bioSections, { heading: '', body: '' }] }))
  const removeSection = (i: number) => setForm(f => ({ ...f, bioSections: f.bioSections.filter((_, j) => j !== i) }))
  const moveSection = (i: number, by: -1 | 1) => setForm(f => {
    const next = [...f.bioSections]
    const j = i + by
    if (j < 0 || j >= next.length) return f
    ;[next[i], next[j]] = [next[j], next[i]]
    return { ...f, bioSections: next }
  })
  const setType = (t: GuideType) => setForm(f => ({ ...f, guideType: t }))

  useEffect(() => {
    getSupplierEntity<GuideProfile>(ENTITY, id).then(guide => {
      if (!guide) { setNotFound(true); setLoading(false); return }
      setStatus(guide.status ?? 'pending')
      setForm({
        name: guide.name ?? '',
        email: guide.email ?? '',
        guideNo: guide.guideNo ?? '',
        speciality: guide.speciality ?? '',
        languages: guide.languages ?? '',
        qualifications: guide.qualifications ?? '',
        yearsExperience: guide.yearsExperience ? String(guide.yearsExperience) : '',
        highestSummit: guide.highestSummit ?? '',
        completedExpeditions: guide.completedExpeditions ? String(guide.completedExpeditions) : '',
        portrait: guide.portrait ?? '',
        bio: guide.bio ?? '',
        knownAs: guide.knownAs ?? '',
        bioHeadline: guide.bioHeadline ?? '',
        bioHighlight: guide.bioHighlight ?? '',
        guideType: guideTypeOf(guide),
        bioSections: (guide.bioSections ?? []).map(s => ({ heading: s.heading ?? '', body: s.body ?? '' })),
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
        email: form.email.trim(),
        guideNo: form.guideNo.trim(),
        speciality: form.speciality.trim(),
        languages: form.languages.trim(),
        qualifications: form.qualifications.trim(),
        yearsExperience: Number(form.yearsExperience) || 0,
        highestSummit: form.highestSummit.trim(),
        completedExpeditions: Number(form.completedExpeditions) || 0,
        portrait: form.portrait,
        bio: form.bio.trim(),
        knownAs: form.knownAs.trim(),
        bioHeadline: form.bioHeadline.trim(),
        bioHighlight: form.bioHighlight.trim(),
        bioSections: cleanBioSections(form.bioSections),
        guideType: form.guideType,
      })
      revalidateGuidePage('guide', id)
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
  // A nickname already typed in quotes inside the full name is picked up by
  // the public page, so it is offered here as the placeholder.
  const quotedNickname = splitGuideName(form.name).knownAs

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <button onClick={() => router.push('/supplier/guides')} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1">
        <ChevronLeft size={14} /> Guides
      </button>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="font-display italic text-2xl text-black/90">Edit Guide</h1>
        <span className={`font-sans text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 ${badge.cls}`}>
          <StatusIcon size={11} /> {badge.label}
        </span>
      </div>

      <div className="space-y-4">
        <Card title="Who they are" hint="Top of the public profile">
          <F label="Guide Type">
            <div className="flex flex-wrap gap-2">
              {GUIDE_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    form.guideType === t ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'
                  }`}
                >
                  {GUIDE_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <p className="font-sans text-xs text-black/40 mt-1.5">{GUIDE_TYPE_HINT[form.guideType]}</p>
          </F>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Full Name" required><input value={form.name} onChange={e => set('name', e.target.value)} className={inp} /></F>
            <F label="Known As" hint="Nickname shown under their name.">
              <input value={form.knownAs} onChange={e => set('knownAs', e.target.value)} placeholder={quotedNickname || 'e.g. Charlie'} className={inp} />
            </F>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Email" hint="Not shown publicly."><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="guide@example.com" className={inp} /></F>
            <F label={guideNoLabel(form.guideType)}>
              <input value={form.guideNo} onChange={e => set('guideNo', e.target.value)} className={inp} />
            </F>
          </div>

          <F label="Portrait"><MediaPicker value={form.portrait} onChange={url => set('portrait', url)} source={supplierMediaSource} /></F>
        </Card>

        <Card title="On the mountain" hint="Stat strip and details panel">
          <div className="grid grid-cols-2 gap-4">
            <F label="Years of Experience"><input type="number" min="0" value={form.yearsExperience} onChange={e => set('yearsExperience', e.target.value)} className={inp} /></F>
            <F label="Completed Expeditions"><input type="number" min="0" value={form.completedExpeditions} onChange={e => set('completedExpeditions', e.target.value)} className={inp} /></F>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Highest Summit"><input value={form.highestSummit} onChange={e => set('highestSummit', e.target.value)} placeholder="e.g. Mafadi (3,450m)" className={inp} /></F>
            <F label="Languages"><input value={form.languages} onChange={e => set('languages', e.target.value)} placeholder="English, Zulu" className={inp} /></F>
          </div>

          <F label="Specialities" hint="Separate with commas. Each one shows as a tag.">
            <input value={form.speciality} onChange={e => set('speciality', e.target.value)} placeholder="Navigation, Zulu heritage, Rock art" className={inp} />
          </F>

          <F label="Qualifications"><input value={form.qualifications} onChange={e => set('qualifications', e.target.value)} placeholder="Wilderness First Responder, Advanced Mountain Skills" className={inp} /></F>
        </Card>

        <Card title="Their story" hint="Profile tab. Everything except the introduction is optional.">
          <F label="Headline" hint="Leave blank to show “Biography”.">
            <input value={form.bioHeadline} onChange={e => set('bioHeadline', e.target.value)} placeholder="e.g. The guide they call Charlie" className={inp} />
          </F>

          <F label="Introduction" hint="Leave a blank line between paragraphs. The first paragraph shows larger, so keep it to a sentence or two.">
            <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={5} className={`${inp} resize-y`} placeholder="Shown on the guide's public profile…" />
          </F>

          <F label="Highlight Line" hint="One short line shown large in the biography. Leave blank to hide it.">
            <input value={form.bioHighlight} onChange={e => set('bioHighlight', e.target.value)} maxLength={140} placeholder="e.g. Turning a challenging climb into a memorable adventure." className={inp} />
          </F>

          <F label="More Sections" hint={`Break the rest of the story into short headed parts. Up to ${MAX_BIO_SECTIONS}. Sections without text aren't saved.`}>
            <div className="space-y-3">
              {form.bioSections.map((s, i) => (
                <div key={i} className="border border-dashed border-black/15 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={s.heading}
                      onChange={e => setSection(i, { heading: e.target.value })}
                      placeholder="Heading, e.g. In the mountains"
                      aria-label={`Section ${i + 1} heading`}
                      className={inp}
                    />
                    <IconBtn label="Move up" onClick={() => moveSection(i, -1)} disabled={i === 0}><ArrowUp size={14} /></IconBtn>
                    <IconBtn label="Move down" onClick={() => moveSection(i, 1)} disabled={i === form.bioSections.length - 1}><ArrowDown size={14} /></IconBtn>
                    <IconBtn label="Remove section" onClick={() => removeSection(i)}><Trash2 size={14} /></IconBtn>
                  </div>
                  <textarea
                    value={s.body}
                    onChange={e => setSection(i, { body: e.target.value })}
                    rows={3}
                    aria-label={`Section ${i + 1} text`}
                    className={`${inp} resize-y`}
                  />
                </div>
              ))}
              {form.bioSections.length < MAX_BIO_SECTIONS && (
                <button type="button" onClick={addSection} className="font-sans text-sm px-3 py-2 border border-black/15 rounded-lg text-black/60 hover:border-[#C9A96E]/60 flex items-center gap-1.5">
                  <Plus size={14} /> Add section
                </button>
              )}
            </div>
          </F>
        </Card>
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
function F({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-sm font-medium text-black/70">
        {label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="font-sans text-xs text-black/40">{hint}</p>}
    </div>
  )
}

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-black/80">{title}</h2>
        <p className="font-sans text-xs text-black/40">{hint}</p>
      </div>
      {children}
    </section>
  )
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="shrink-0 p-2 rounded-lg border border-black/10 text-black/50 hover:text-black/80 disabled:opacity-30"
    >
      {children}
    </button>
  )
}

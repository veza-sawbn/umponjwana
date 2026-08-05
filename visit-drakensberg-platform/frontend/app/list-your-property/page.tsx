'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle, ChevronRight, ImageIcon, Loader2,
  Plus, Shield, Trash2, Upload, X,
} from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { supabase } from '@/lib/auth'
import { getRegionNames } from '@/lib/regions'
import { PROPERTY_REGIONS, PROPERTY_TYPES, PROPERTY_AMENITIES } from '@/lib/properties'
import {
  submitListingApplication, uploadApplicationPhoto,
  ACTIVITY_DIFFICULTIES, PHOTO_MAX_COUNT,
  type ApplicationActivity, type ListingApplicationDraft,
} from '@/lib/listing-applications'

// Public front door for establishment owners. The supplier portal's property
// wizard sits behind an account and an admin approval flag, which is the wrong
// order for someone who has not joined yet — so this collects an application
// (lib/listing-applications.ts), the team reviews it, and only then does a
// supplier account and a catalog listing get created.

const STEPS = ['Basics', 'Property', 'Activities', 'Review'] as const

const CONTACT_ROLES = ['Owner', 'Manager', 'Marketing / Reservations', 'Appointed agent']

const DRAFT_KEY = 'vd:listing-application:draft'

const inputCls =
  'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm text-black placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f] bg-white'
const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

type Draft = ListingApplicationDraft

const EMPTY_DRAFT: Draft = {
  contactName: '', contactEmail: '', contactPhone: '', businessName: '', contactRole: '',
  propertyName: '', propertyType: '', region: '', elevation: '', description: '',
  amenities: [], photos: [],
  offersActivities: false, activities: [],
}

export default function ListYourPropertyPage() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Draft>(EMPTY_DRAFT)
  const [regions, setRegions] = useState<string[]>(PROPERTY_REGIONS)
  const [customAmenity, setCustomAmenity] = useState('')
  const [addingAmenity, setAddingAmenity] = useState(false)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ reference: string; email: string } | null>(null)
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const restored = useRef(false)

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setForm(f => ({ ...f, [key]: value }))
  }, [])

  /* ── Draft: restore once, then autosave every change ─────────────────── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY)
      if (stored) setForm(f => ({ ...f, ...JSON.parse(stored) }))
    } catch {}
    restored.current = true

    getRegionNames().then(setRegions).catch(() => {})

    // Prefill from the session when the applicant already has an account.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const meta = (user.user_metadata ?? {}) as { full_name?: string }
      setForm(f => ({
        ...f,
        contactName: f.contactName || meta.full_name || '',
        contactEmail: f.contactEmail || user.email || '',
      }))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!restored.current || done) return
    const body = JSON.stringify(form)
    if (body === JSON.stringify(EMPTY_DRAFT)) return // nothing entered yet
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, body)
        setDraftSavedAt(new Date())
      } catch {}
    }, 600)
    return () => clearTimeout(t)
  }, [form, done])

  /* ── Field helpers ───────────────────────────────────────────────────── */
  function toggleAmenity(a: string) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a],
    }))
  }

  function addCustomAmenity() {
    const value = customAmenity.trim()
    if (!value) { setAddingAmenity(false); return }
    setForm(f => (f.amenities.includes(value) ? f : { ...f, amenities: [...f.amenities, value] }))
    setCustomAmenity('')
    setAddingAmenity(false)
  }

  function setActivity(i: number, patch: Partial<ApplicationActivity>) {
    setForm(f => ({
      ...f,
      activities: f.activities.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    }))
  }

  function addActivity() {
    setForm(f => ({ ...f, activities: [...f.activities, { name: '', difficulty: 'Moderate' }] }))
  }

  function removeActivity(i: number) {
    setForm(f => ({ ...f, activities: f.activities.filter((_, idx) => idx !== i) }))
  }

  /* ── Step flow ───────────────────────────────────────────────────────── */
  function validate(current: number): string {
    if (current === 0) {
      if (!form.contactName.trim()) return 'Tell us who we should speak to.'
      if (!/^\S+@\S+\.\S+$/.test(form.contactEmail.trim())) return 'Enter a valid email address.'
      if (!form.businessName.trim()) return 'Enter the registered or trading name of the business.'
    }
    if (current === 1) {
      if (!form.propertyName.trim()) return 'Your property needs a name.'
      if (!form.propertyType) return 'Choose the type of establishment.'
      if (!form.region) return 'Choose the region your property sits in.'
      if (form.description.trim().length < 40) return 'Give us at least a sentence or two of description.'
    }
    if (current === 2 && form.offersActivities) {
      const named = form.activities.filter(a => a.name.trim())
      if (named.length === 0) return 'Add at least one activity, or switch guided activities off.'
    }
    return ''
  }

  function next() {
    const problem = validate(step)
    if (problem) { setError(problem); return }
    setError('')
    setStep(s => Math.min(s + 1, STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function back() {
    setError('')
    setStep(s => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goToStep(target: number) {
    if (target > step) {
      for (let i = step; i < target; i++) {
        const problem = validate(i)
        if (problem) { setStep(i); setError(problem); return }
      }
    }
    setError('')
    setStep(target)
  }

  async function submit() {
    for (let i = 0; i < STEPS.length - 1; i++) {
      const problem = validate(i)
      if (problem) { setStep(i); setError(problem); return }
    }
    if (!consent) { setError('Please confirm you are authorised to list this property.'); return }

    setSubmitting(true)
    setError('')
    try {
      const application = await submitListingApplication({
        ...form,
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        businessName: form.businessName.trim(),
        propertyName: form.propertyName.trim(),
        description: form.description.trim(),
        elevation: form.elevation.trim(),
        activities: form.offersActivities
          ? form.activities.filter(a => a.name.trim()).map(a => ({ ...a, name: a.name.trim() }))
          : [],
      })
      try { localStorage.removeItem(DRAFT_KEY) } catch {}
      setDone({ reference: application.reference, email: application.contactEmail })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Success ─────────────────────────────────────────────────────────── */
  if (done) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <main className="max-w-2xl mx-auto px-6 pt-40 pb-24 text-center">
          <div className="w-16 h-16 bg-[#2d6a4f]/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={28} className="text-[#2d6a4f]" />
          </div>
          <h1 className="font-display italic text-4xl text-black mb-3">Application received</h1>
          <p className="font-sans text-sm text-gray-500 mb-2">
            Reference <span className="text-[#2d6a4f] font-medium">{done.reference}</span>
          </p>
          <p className="font-sans text-sm text-gray-500 max-w-md mx-auto mb-8 leading-relaxed">
            Our team reviews every establishment before it goes live — usually within two business days.
            We&apos;ll email <span className="text-black">{done.email}</span> with the outcome and, once approved,
            an invitation to set up your supplier portal where you manage rooms, rates and bookings.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/" className="bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">
              Back to Visit Drakensberg
            </Link>
            <Link href="/stays" className="border border-[#2d6a4f] text-[#2d6a4f] px-6 py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
              See who&apos;s already listed
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  /* ── Form ────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      {/* Hero */}
      <section className="bg-[#2d6a4f] text-white py-16 px-6 lg:px-12 mt-16">
        <div className="max-w-[900px] mx-auto">
          <Link href="/about" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> About Visit Drakensberg
          </Link>
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">Establishment Listing</p>
          <h1 className="font-display italic text-4xl lg:text-5xl mb-3">List your property</h1>
          <p className="font-sans text-sm text-white/60 max-w-2xl leading-relaxed">
            Tell us about your accommodation. It takes about five minutes — our team reviews every listing
            before it goes live, and there is no fee to apply.
          </p>
        </div>
      </section>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[900px] mx-auto px-6 lg:px-12 py-4 flex items-center gap-2 font-sans text-xs overflow-x-auto">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 shrink-0">
              {i > 0 && <ChevronRight size={13} className="text-gray-300" />}
              <button
                onClick={() => goToStep(i)}
                className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${
                  step === i ? 'bg-[#2d6a4f] text-white' : i < step ? 'text-[#2d6a4f] hover:bg-[#2d6a4f]/5' : 'text-gray-400'
                }`}
              >
                <span className={`w-5 h-5 flex items-center justify-center text-[10px] border ${
                  step === i ? 'border-white/50' : i < step ? 'border-[#2d6a4f] bg-[#2d6a4f]/10' : 'border-gray-300'
                }`}>
                  {i < step ? <Check size={11} /> : i + 1}
                </span>
                {label}
              </button>
            </div>
          ))}
          <span className="ml-auto shrink-0 pl-4 font-sans text-[11px] text-gray-400">
            {draftSavedAt ? 'Draft saved on this device' : 'Draft saves automatically'}
          </span>
        </div>
      </div>

      <main className="max-w-[900px] mx-auto px-6 lg:px-12 py-12 space-y-6">
        {/* ── Step 1 · Basics ───────────────────────────────────────────── */}
        {step === 0 && (
          <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
            <CardHead
              title="Your details"
              sub="Only our listings team sees this — it never appears on your public page."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Contact name</label>
                <input value={form.contactName} onChange={e => set('contactName', e.target.value)}
                  placeholder="Thandi Mokoena" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Your role</label>
                <select value={form.contactRole} onChange={e => set('contactRole', e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {CONTACT_ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Email address</label>
                <input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)}
                  placeholder="you@example.co.za" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone <span className="normal-case tracking-normal text-gray-300">optional</span></label>
                <input type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)}
                  placeholder="+27 82 000 0000" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Business / trading name</label>
              <input value={form.businessName} onChange={e => set('businessName', e.target.value)}
                placeholder="Witsieshoek Hospitality (Pty) Ltd" className={inputCls} />
              <p className="font-sans text-xs text-gray-400 mt-1.5">
                The entity that will invoice and be paid out. It can differ from the property name.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 2 · Property ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
            <CardHead title="Property details" sub="This is what appears on your public listing page." />
            <div>
              <label className={labelCls}>Property name</label>
              <input value={form.propertyName} onChange={e => set('propertyName', e.target.value)}
                placeholder="Witsieshoek Mountain Lodge" className={inputCls} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Establishment type</label>
                <select value={form.propertyType} onChange={e => set('propertyType', e.target.value)} className={inputCls}>
                  <option value="">Select type…</option>
                  {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Region</label>
                <select value={form.region} onChange={e => set('region', e.target.value)} className={inputCls}>
                  <option value="">Select region…</option>
                  {regions.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Elevation in metres <span className="normal-case tracking-normal text-gray-300">optional, but recommended</span>
                </label>
                <input value={form.elevation} onChange={e => set('elevation', e.target.value)}
                  placeholder="2 286" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Stone-and-timber lodge at the base of the Amphitheatre, with direct trailhead access to Sentinel Peak…"
                className={`${inputCls} resize-none`} />
              <p className="font-sans text-xs text-gray-400 mt-1.5">
                Two to four sentences works best — guests skim this first.
              </p>
            </div>

            <div>
              <label className={labelCls}>Amenities</label>
              <div className="flex flex-wrap gap-2">
                {[...PROPERTY_AMENITIES, ...form.amenities.filter(a => !PROPERTY_AMENITIES.includes(a))].map(a => {
                  const on = form.amenities.includes(a)
                  return (
                    <button key={a} type="button" onClick={() => toggleAmenity(a)}
                      className={`font-sans text-xs px-3 py-1.5 border transition-colors ${
                        on ? 'border-[#C9A96E] bg-[#C9A96E]/10 text-[#8a6f3c]' : 'border-gray-200 text-gray-500 hover:border-[#2d6a4f] hover:text-[#2d6a4f]'
                      }`}>
                      {on && <Check size={11} className="inline-block mr-1 -mt-px" />}{a}
                    </button>
                  )
                })}
                {addingAmenity ? (
                  <span className="inline-flex items-center border border-[#2d6a4f]">
                    <input
                      autoFocus
                      value={customAmenity}
                      onChange={e => setCustomAmenity(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); addCustomAmenity() }
                        if (e.key === 'Escape') { setCustomAmenity(''); setAddingAmenity(false) }
                      }}
                      onBlur={addCustomAmenity}
                      placeholder="Fireplace lounge"
                      className="font-sans text-xs px-3 py-1.5 w-40 focus:outline-none"
                    />
                  </span>
                ) : (
                  <button type="button" onClick={() => setAddingAmenity(true)}
                    className="font-sans text-xs px-3 py-1.5 border border-dashed border-gray-300 text-gray-400 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
                    <Plus size={11} className="inline-block mr-1 -mt-px" />Add custom
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className={labelCls}>Photos</label>
              <PhotoUploader
                photos={form.photos}
                onChange={photos => set('photos', photos)}
              />
            </div>
          </div>
        )}

        {/* ── Step 3 · Activities ───────────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
            <CardHead
              title="Activities at your property"
              sub="Optional — you can add these now or later from your supplier portal."
            />

            <div className="flex items-start justify-between gap-4 border border-gray-200 px-4 py-3.5">
              <div>
                <p className="font-sans text-sm font-medium text-black">This property offers guided activities</p>
                <p className="font-sans text-xs text-gray-400 mt-0.5">
                  Guests see a &ldquo;Stay + Adventure&rdquo; option on your listing.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.offersActivities}
                onClick={() => {
                  const on = !form.offersActivities
                  setForm(f => ({
                    ...f,
                    offersActivities: on,
                    activities: on && f.activities.length === 0 ? [{ name: '', difficulty: 'Moderate' }] : f.activities,
                  }))
                }}
                className={`relative w-10 h-[22px] rounded-full shrink-0 mt-0.5 transition-colors ${
                  form.offersActivities ? 'bg-[#2d6a4f]' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-[3px] w-4 h-4 bg-white rounded-full transition-all ${
                  form.offersActivities ? 'left-[21px]' : 'left-[3px]'
                }`} />
              </button>
            </div>

            {form.offersActivities && (
              <div className="space-y-2">
                {form.activities.map((activity, i) => (
                  <div key={i} className="flex items-center gap-3 border border-gray-200 px-3 py-2.5">
                    <input
                      value={activity.name}
                      onChange={e => setActivity(i, { name: e.target.value })}
                      placeholder="Sentinel Peak chain ladder hike"
                      className="flex-1 font-sans text-sm text-black placeholder:text-gray-300 focus:outline-none min-w-0"
                    />
                    <select
                      value={activity.difficulty}
                      onChange={e => setActivity(i, { difficulty: e.target.value as ApplicationActivity['difficulty'] })}
                      className="border border-gray-200 px-2 py-1.5 font-sans text-xs text-gray-600 focus:outline-none focus:border-[#2d6a4f] shrink-0"
                    >
                      {ACTIVITY_DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
                    </select>
                    <button type="button" onClick={() => removeActivity(i)}
                      className="text-gray-300 hover:text-red-500 transition-colors shrink-0" aria-label="Remove activity">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addActivity}
                  className="flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:text-[#235a3f] transition-colors py-1.5">
                  <Plus size={13} /> Add another activity
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4 · Review ───────────────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
            <CardHead title="Review & submit" sub="Check the details below — you can still go back and change anything." />

            <div className="border border-gray-200">
              <SummaryRow k="Contact" v={form.contactName} />
              <SummaryRow k="Email" v={form.contactEmail} />
              <SummaryRow k="Phone" v={form.contactPhone} />
              <SummaryRow k="Business" v={form.businessName} />
              <SummaryRow k="Property" v={form.propertyName} />
              <SummaryRow k="Type" v={form.propertyType} />
              <SummaryRow k="Region" v={form.region} />
              <SummaryRow k="Elevation" v={form.elevation ? `${form.elevation} m` : ''} />
              <SummaryRow k="Amenities" v={form.amenities.join(' · ')} />
              <SummaryRow k="Photos" v={form.photos.length ? `${form.photos.length} uploaded` : 'None yet'} />
              <SummaryRow
                k="Activities"
                v={form.offersActivities
                  ? form.activities.filter(a => a.name.trim()).map(a => `${a.name} (${a.difficulty})`).join(' · ')
                  : 'None offered'}
              />
            </div>

            <label className="flex items-start gap-3 font-sans text-xs text-gray-500 leading-relaxed cursor-pointer">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 accent-[#2d6a4f] shrink-0" />
              <span>
                I am authorised to list this property, the details above are accurate, and I accept the{' '}
                <Link href="/terms" className="text-[#2d6a4f] underline underline-offset-2">Terms of Use</Link> and{' '}
                <Link href="/privacy" className="text-[#2d6a4f] underline underline-offset-2">Privacy Policy</Link>.
              </span>
            </label>
          </div>
        )}

        {error && (
          <p className="font-sans text-sm text-red-500 bg-red-50 border border-red-200 px-4 py-3">{error}</p>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={back}
            disabled={step === 0}
            className="border border-gray-300 text-gray-600 px-6 py-3 font-sans text-sm hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:text-gray-600"
          >
            ← Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={next}
              className="flex items-center gap-2 bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">
              Continue to {STEPS[step + 1]} <ArrowRight size={14} />
            </button>
          ) : (
            <button onClick={submit} disabled={submitting}
              className="flex items-center gap-2 bg-[#C9A96E] text-black px-6 py-3 font-sans text-sm font-medium hover:bg-[#b8935a] transition-colors disabled:opacity-50">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : 'Submit application'}
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 font-sans text-xs text-gray-400 pt-2">
          <Shield size={13} className="text-[#C9A96E]" />
          Reviewed by our team within 2 business days · no listing fee to apply
        </div>
      </main>

      <Footer />
    </div>
  )
}

/* ── Pieces ────────────────────────────────────────────────────────────── */

function CardHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="pb-1">
      <h2 className="font-display italic text-2xl text-black">{title}</h2>
      <p className="font-sans text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-3 border-b border-gray-100 last:border-b-0">
      <span className="font-sans text-xs tracking-[0.08em] uppercase text-gray-400 shrink-0">{k}</span>
      <span className={`font-sans text-sm text-right ${v ? 'text-black' : 'text-gray-300'}`}>{v || '—'}</span>
    </div>
  )
}

/**
 * Drag-and-drop photo upload. Files go straight to the public `media` bucket
 * under listing-applications/ (see the storage policy in
 * 20260807_listing_applications.sql), so what is stored on the application is
 * a list of URLs — which also means an in-progress draft survives a reload.
 */
function PhotoUploader({ photos, onChange }: { photos: string[]; onChange: (photos: string[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(0)
  const [uploadError, setUploadError] = useState('')

  async function accept(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadError('')
    const room = PHOTO_MAX_COUNT - photos.length
    if (room <= 0) {
      setUploadError(`You can attach up to ${PHOTO_MAX_COUNT} photos.`)
      return
    }
    const batch = Array.from(files).slice(0, room)
    setBusy(b => b + batch.length)
    const uploaded: string[] = []
    for (const file of batch) {
      try {
        uploaded.push(await uploadApplicationPhoto(file))
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : 'Upload failed.')
      } finally {
        setBusy(b => b - 1)
      }
    }
    if (uploaded.length) onChange([...photos, ...uploaded])
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files) }}
        className={`border border-dashed px-4 py-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-300 hover:border-[#2d6a4f]'
        }`}
      >
        {busy > 0
          ? <Loader2 size={22} className="mx-auto mb-2.5 text-[#2d6a4f] animate-spin" />
          : <Upload size={22} className="mx-auto mb-2.5 text-[#C9A96E]" />}
        <p className="font-sans text-sm text-black">
          {busy > 0 ? `Uploading ${busy} photo${busy === 1 ? '' : 's'}…` : 'Drag photos here, or click to browse'}
        </p>
        <p className="font-sans text-xs text-gray-400 mt-1">
          At least 5 photos recommended · JPG, PNG or WebP · up to {PHOTO_MAX_COUNT}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => { accept(e.target.files); e.target.value = '' }}
        />
      </div>

      {uploadError && <p className="font-sans text-xs text-red-500">{uploadError}</p>}

      <div className="grid grid-cols-4 gap-2">
        {photos.map((url, i) => (
          <div key={url} className="relative aspect-square border border-gray-200 bg-gray-50 group">
            <img src={url} alt="" className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
              className="absolute top-1 right-1 bg-white/90 p-1 text-gray-500 hover:text-red-500 transition-colors"
              aria-label="Remove photo"
            >
              <Trash2 size={11} />
            </button>
            {i === 0 && (
              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white font-sans text-[10px] text-center py-0.5">
                Cover
              </span>
            )}
          </div>
        ))}
        {photos.length < PHOTO_MAX_COUNT && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="aspect-square border border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-300 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
          >
            <ImageIcon size={16} />
            <span className="font-sans text-[10px]">Add</span>
          </button>
        )}
      </div>
    </div>
  )
}

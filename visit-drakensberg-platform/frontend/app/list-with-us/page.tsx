'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle, ChevronRight, ImageIcon, Info, Loader2,
  Lock, Plus, Shield, Trash2, Upload, X,
} from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { supabase } from '@/lib/auth'
import { getRegionNames } from '@/lib/regions'
import { PROPERTY_REGIONS, PROPERTY_TYPES, PROPERTY_AMENITIES } from '@/lib/properties'
import { ACTIVITY_CATEGORIES, ACTIVITY_DIFFICULTIES, ACTIVITY_INCLUSIONS } from '@/lib/activities'
import { formatMoney } from '@/lib/allocation'
import {
  submitListingApplication, uploadApplicationPhoto, emptyActivity, tierById,
  emptyStay, emptyTour, emptyShuttle, emptyExperience,
  APPLICANT_TYPES, STAY_ROOM_BANDS, TOUR_STYLES, VEHICLE_TYPES, EXPERIENCE_SETTINGS,
  COMMISSION_TIERS, COMMISSION_MIN_RATE, COMMISSION_MAX_RATE, PHOTO_MAX_COUNT,
  type ApplicationActivity, type ListingApplicationDraft,
} from '@/lib/listing-applications'

// Public front door for every kind of operator — stays, activities, guided
// tours, shuttles and experiences. The supplier portal's wizards sit behind an
// account and an admin approval flag, which is the wrong order for someone who
// has not joined yet, so this collects an application
// (lib/listing-applications.ts) and the team reviews it.
//
// The journey is one shared spine with a short block per type the applicant
// says they operate, rather than a separate form each: most of what we ask —
// who you are, where you are, what it looks like, what commission you want —
// is the same whether you run a lodge or a minibus.

const STEPS = ['Basics', 'Offering', 'Commission', 'Review'] as const

const CONTACT_ROLES = ['Owner', 'Manager', 'Marketing / Reservations', 'Appointed agent']

const DRAFT_KEY = 'vd:listing-application:draft'

const inputCls =
  'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm text-black placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f] bg-white'
const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'
const optional = <span className="normal-case tracking-normal text-gray-300">optional</span>

type Draft = ListingApplicationDraft

const EMPTY_DRAFT: Draft = {
  contactName: '', contactEmail: '', contactPhone: '', businessName: '', contactRole: '',
  supplierTypes: [],
  tradingName: '', region: '', baseTown: '', description: '', photos: [],
  stay: emptyStay(), tour: emptyTour(), shuttle: emptyShuttle(), experience: emptyExperience(),
  offersActivities: false, activities: [],
  commissionTier: COMMISSION_TIERS[0].id, commissionAcknowledged: false,
}

export default function ListWithUsPage() {
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
  // Password fields — deliberately kept out of the localStorage draft.
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // Whether the visitor already has a session (skip signUp on submit).
  const [isSignedIn, setIsSignedIn] = useState(false)

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setForm(f => ({ ...f, [key]: value }))
  }, [])

  // A validation message names a field; once that field is being edited the
  // message is stale, so it clears on the next keystroke rather than sitting
  // there contradicting what the form now says.
  useEffect(() => {
    setError(e => (e ? '' : e))
  }, [form])

  const has = (t: string) => form.supplierTypes.includes(t)

  /* ── Draft: restore once, then autosave every change ─────────────────── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY)
      if (stored) {
        // Merge over EMPTY_DRAFT so a draft saved by the older stays-only
        // journey still opens — it simply has no supplierTypes yet.
        const parsed = JSON.parse(stored)
        setForm(f => ({
          ...f, ...parsed,
          stay: { ...f.stay, ...(parsed.stay ?? {}) },
          tour: { ...f.tour, ...(parsed.tour ?? {}) },
          shuttle: { ...f.shuttle, ...(parsed.shuttle ?? {}) },
          experience: { ...f.experience, ...(parsed.experience ?? {}) },
        }))
      }
    } catch {}
    restored.current = true

    getRegionNames().then(setRegions).catch(() => {})

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setIsSignedIn(true)
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
  function toggleType(id: string) {
    setForm(f => {
      const on = f.supplierTypes.includes(id)
      const supplierTypes = on ? f.supplierTypes.filter(t => t !== id) : [...f.supplierTypes, id]
      // Picking "Activities" as a core offering seeds the first activity row;
      // the optional add-on toggle is then redundant and goes away.
      const seedActivity = id === 'Activity' && !on && f.activities.length === 0
      return {
        ...f,
        supplierTypes,
        activities: seedActivity ? [emptyActivity()] : f.activities,
        offersActivities: supplierTypes.includes('Activity') ? false : f.offersActivities,
      }
    })
  }

  function setStay<K extends keyof Draft['stay']>(k: K, v: Draft['stay'][K]) {
    setForm(f => ({ ...f, stay: { ...f.stay, [k]: v } }))
  }
  function setTour<K extends keyof Draft['tour']>(k: K, v: Draft['tour'][K]) {
    setForm(f => ({ ...f, tour: { ...f.tour, [k]: v } }))
  }
  function setShuttle<K extends keyof Draft['shuttle']>(k: K, v: Draft['shuttle'][K]) {
    setForm(f => ({ ...f, shuttle: { ...f.shuttle, [k]: v } }))
  }
  function setExperience<K extends keyof Draft['experience']>(k: K, v: Draft['experience'][K]) {
    setForm(f => ({ ...f, experience: { ...f.experience, [k]: v } }))
  }

  function toggleAmenity(a: string) {
    setForm(f => ({
      ...f,
      stay: {
        ...f.stay,
        amenities: f.stay.amenities.includes(a)
          ? f.stay.amenities.filter(x => x !== a)
          : [...f.stay.amenities, a],
      },
    }))
  }

  function addCustomAmenity() {
    const value = customAmenity.trim()
    if (!value) { setAddingAmenity(false); return }
    setForm(f => (f.stay.amenities.includes(value) ? f : { ...f, stay: { ...f.stay, amenities: [...f.stay.amenities, value] } }))
    setCustomAmenity('')
    setAddingAmenity(false)
  }

  function toggleVehicleType(v: string) {
    setForm(f => ({
      ...f,
      shuttle: {
        ...f.shuttle,
        vehicleTypes: f.shuttle.vehicleTypes.includes(v)
          ? f.shuttle.vehicleTypes.filter(x => x !== v)
          : [...f.shuttle.vehicleTypes, v],
      },
    }))
  }

  function setActivity(i: number, patch: Partial<ApplicationActivity>) {
    setForm(f => ({ ...f, activities: f.activities.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) }))
  }
  function addActivity() {
    setForm(f => ({ ...f, activities: [...f.activities, emptyActivity()] }))
  }
  function removeActivity(i: number) {
    setForm(f => ({ ...f, activities: f.activities.filter((_, idx) => idx !== i) }))
  }
  function toggleIncluded(i: number, item: string) {
    setForm(f => ({
      ...f,
      activities: f.activities.map((a, idx) => idx !== i ? a : {
        ...a,
        included: a.included.includes(item) ? a.included.filter(x => x !== item) : [...a.included, item],
      }),
    }))
  }

  // Activities appear either as the core offering or as an add-on a stay or
  // tour operator switches on.
  const activitiesShown = has('Activity') || form.offersActivities
  const activityAddOnOffered = !has('Activity') && (has('Accommodation') || has('Guided Tours') || has('Experience'))

  /* ── Step flow ───────────────────────────────────────────────────────── */
  function validate(current: number): string {
    if (current === 0) {
      if (!form.contactName.trim()) return 'Tell us who we should speak to.'
      if (!/^\S+@\S+\.\S+$/.test(form.contactEmail.trim())) return 'Enter a valid email address.'
      if (!form.businessName.trim()) return 'Enter the registered or trading name of the business.'
      // Password only required when creating a new account
      if (!isSignedIn) {
        if (password.length < 8) return 'Your password must be at least 8 characters.'
        if (password !== confirmPassword) return 'Passwords do not match — please re-enter.'
      }
      if (form.supplierTypes.length === 0) return 'Choose at least one thing you operate.'
    }
    if (current === 1) {
      if (!form.region) return 'Choose the region you operate in.'
      if (form.description.trim().length < 40) return 'Give us at least a sentence or two about what you offer.'
      if (has('Accommodation')) {
        if (!form.stay.propertyName.trim()) return 'Your property needs a name.'
        if (!form.stay.propertyType) return 'Choose the type of establishment.'
      }
      if (has('Guided Tours') && !form.tour.tourStyle) return 'Choose the kind of tours you run.'
      if (has('Shuttle')) {
        if (!form.shuttle.fleetSize.trim()) return 'Tell us how many vehicles you run.'
        if (form.shuttle.vehicleTypes.length === 0) return 'Choose at least one vehicle type.'
      }
      if (has('Experience') && !form.experience.experienceStyle.trim()) {
        return 'Tell us what kind of experience you host.'
      }
      if (activitiesShown) {
        const named = form.activities.filter(a => a.name.trim())
        if (named.length === 0) {
          return has('Activity')
            ? 'Add at least one activity.'
            : 'Add at least one activity, or switch guided activities off.'
        }
        const incomplete = named.find(a => !a.category || !a.pricePerPerson.trim())
        if (incomplete) return `“${incomplete.name}” still needs a category and a price per person.`
      }
    }
    if (current === 2 && !form.commissionAcknowledged) {
      return 'Please accept the commission terms for the tier you picked.'
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
    if (!consent) { setError('Please confirm you are authorised to list this business.'); return }

    setSubmitting(true)
    setError('')
    try {
      // ── Step 1: create the supplier account if not already signed in ──────
      // role: 'supplier' is the one elevated value a signup payload may ask
      // for, and it grants nothing until an admin approves the account — see
      // 20260809_signup_role_hardening.sql.
      if (!isSignedIn) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: form.contactEmail.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: form.contactName.trim(),
              role: 'supplier',
              supplier_type: form.supplierTypes.join(','),
            },
          },
        })
        if (signUpError) {
          const msg = signUpError.message.toLowerCase()
          if (msg.includes('already registered') || msg.includes('already been registered')) {
            setError(
              'This email address already has an account. Sign in first, then return here to submit your application. If you forgot your password, use the "Forgot password" link on the sign-in page.',
            )
            setSubmitting(false)
            return
          }
          throw signUpError
        }
      }

      // ── Step 2: submit the listing application ────────────────────────────
      const application = await submitListingApplication({
        ...form,
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        businessName: form.businessName.trim(),
        tradingName: form.tradingName.trim() || form.businessName.trim(),
        baseTown: form.baseTown.trim(),
        description: form.description.trim(),
        stay: { ...form.stay, propertyName: form.stay.propertyName.trim(), elevation: form.stay.elevation.trim() },
        activities: activitiesShown
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
          <p className="font-sans text-sm text-gray-500 max-w-md mx-auto mb-4 leading-relaxed">
            Our team reviews every operator before they go live — usually within two business days.
            We&apos;ll email <span className="text-black">{done.email}</span> with the outcome.
          </p>
          <p className="font-sans text-sm text-gray-500 max-w-md mx-auto mb-8 leading-relaxed">
            Your supplier account is ready — please confirm your email address first (check your inbox),
            then{' '}
            <Link href="/auth/login" className="text-[#2d6a4f] underline underline-offset-2 hover:text-[#235a3f]">
              sign in
            </Link>
            {' '}to access your portal once approved.
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
      <section className="bg-[#2d6a4f] text-white py-16 px-6 lg:px-12 mt-16">
        <div className="max-w-[900px] mx-auto">
          <Link href="/about" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> About Visit Drakensberg
          </Link>
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">Operator Listing</p>
          <h1 className="font-display italic text-4xl lg:text-5xl mb-3">List with us</h1>
          <p className="font-sans text-sm text-white/60 max-w-2xl leading-relaxed">
            Stays, activities, guided tours, transport and experiences — tell us what you run and we&apos;ll
            take it from there. It takes about five minutes, our team reviews every operator before they go
            live, and there is no fee to apply.
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
          <>
            <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
              <CardHead title="Your details" sub="Only our listings team sees this — it never appears on your public page." />
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
                  <label className={labelCls}>Phone {optional}</label>
                  <input type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)}
                    placeholder="+27 82 000 0000" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Registered business name</label>
                <input value={form.businessName} onChange={e => set('businessName', e.target.value)}
                  placeholder="Witsieshoek Hospitality (Pty) Ltd" className={inputCls} />
                <p className="font-sans text-xs text-gray-400 mt-1.5">
                  The entity that will invoice and be paid out. You can give a different public-facing name next.
                </p>
              </div>

              {/* Password — only when the visitor doesn't already have an account */}
              {!isSignedIn && (
                <div className="border border-gray-100 bg-gray-50/60 px-4 py-4 space-y-4">
                  <div>
                    <p className="font-sans text-xs font-medium text-gray-700 mb-0.5">Create your supplier account</p>
                    <p className="font-sans text-[11px] text-gray-400 leading-relaxed">
                      This gives you immediate access once your application is approved — no separate invite needed.
                      Confirm your email address after submitting.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Password</label>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                        autoComplete="new-password" placeholder="Min. 8 characters" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Confirm password</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        autoComplete="new-password" placeholder="Re-enter password" className={inputCls} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
              <CardHead
                title="What do you operate?"
                sub="Pick everything that applies — plenty of operators do more than one, and we'll ask about each."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {APPLICANT_TYPES.map(t => {
                  const on = has(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleType(t.id)}
                      aria-pressed={on}
                      className={`text-left border px-4 py-3.5 flex items-start gap-3 transition-colors ${
                        on ? 'border-[#C9A96E] bg-[#C9A96E]/5' : 'border-gray-200 hover:border-[#2d6a4f]'
                      }`}
                    >
                      <span className={`w-4 h-4 mt-0.5 shrink-0 border flex items-center justify-center ${
                        on ? 'border-[#C9A96E] bg-[#C9A96E]' : 'border-gray-300'
                      }`}>
                        {on && <Check size={11} className="text-white" />}
                      </span>
                      <span>
                        <span className="block font-sans text-sm font-medium text-black">{t.label}</span>
                        <span className="block font-sans text-xs text-gray-400 mt-0.5">{t.blurb}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Step 2 · Offering ─────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
              <CardHead title="About your business" sub="This is what appears on your public listing." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Public / trading name {optional}</label>
                  <input value={form.tradingName} onChange={e => set('tradingName', e.target.value)}
                    placeholder={form.businessName || 'Witsieshoek Mountain Escapes'} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Region</label>
                  <select value={form.region} onChange={e => set('region', e.target.value)} className={inputCls}>
                    <option value="">Select region…</option>
                    {regions.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Nearest town or base {optional}</label>
                <input value={form.baseTown} onChange={e => set('baseTown', e.target.value)}
                  placeholder="Phuthaditjhaba" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="What makes a trip with you memorable? Two to four sentences works best — guests skim this first."
                  className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className={labelCls}>Photos</label>
                <PhotoUploader photos={form.photos} onChange={photos => set('photos', photos)} />
              </div>
            </div>

            {/* Accommodation */}
            {has('Accommodation') && (
              <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
                <CardHead title="Your property" sub="Somewhere to stay — lodge, guesthouse, cottage or campsite." />
                <div>
                  <label className={labelCls}>Property name</label>
                  <input value={form.stay.propertyName} onChange={e => setStay('propertyName', e.target.value)}
                    placeholder="Witsieshoek Mountain Lodge" className={inputCls} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Establishment type</label>
                    <select value={form.stay.propertyType} onChange={e => setStay('propertyType', e.target.value)} className={inputCls}>
                      <option value="">Select type…</option>
                      {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Rooms / units</label>
                    <select value={form.stay.roomCount} onChange={e => setStay('roomCount', e.target.value)} className={inputCls}>
                      <option value="">Select…</option>
                      {STAY_ROOM_BANDS.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Elevation (m) {optional}</label>
                    <input value={form.stay.elevation} onChange={e => setStay('elevation', e.target.value)}
                      placeholder="2 286" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Amenities</label>
                  <div className="flex flex-wrap gap-2">
                    {[...PROPERTY_AMENITIES, ...form.stay.amenities.filter(a => !PROPERTY_AMENITIES.includes(a))].map(a => {
                      const on = form.stay.amenities.includes(a)
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
                          autoFocus value={customAmenity}
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
              </div>
            )}

            {/* Guided Tours */}
            {has('Guided Tours') && (
              <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
                <CardHead title="Your tours" sub="Multi-day hikes, summit attempts and cultural tours." />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Mainly</label>
                    <select value={form.tour.tourStyle} onChange={e => setTour('tourStyle', e.target.value)} className={inputCls}>
                      <option value="">Select…</option>
                      {TOUR_STYLES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Typical length (days)</label>
                    <input inputMode="decimal" value={form.tour.typicalDurationDays}
                      onChange={e => setTour('typicalDurationDays', e.target.value)} placeholder="3" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Guides on your roster</label>
                    <input inputMode="numeric" value={form.tour.guideCount}
                      onChange={e => setTour('guideCount', e.target.value)} placeholder="4" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Guide certifications {optional}</label>
                  <input value={form.tour.certifications} onChange={e => setTour('certifications', e.target.value)}
                    placeholder="MDT registered, Wilderness First Aid Level 3, CATHSSETA" className={inputCls} />
                  <p className="font-sans text-xs text-gray-400 mt-1.5">
                    We verify these before your tours go live — listing them now speeds up the review.
                  </p>
                </div>
              </div>
            )}

            {/* Shuttle */}
            {has('Shuttle') && (
              <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
                <CardHead title="Your transport service" sub="Airport runs, trailhead drops and 4×4 transfers." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Vehicles in your fleet</label>
                    <input inputMode="numeric" value={form.shuttle.fleetSize}
                      onChange={e => setShuttle('fleetSize', e.target.value)} placeholder="3" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Operating licence no. {optional}</label>
                    <input value={form.shuttle.operatingLicence}
                      onChange={e => setShuttle('operatingLicence', e.target.value)} placeholder="OL 123456" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Vehicle types</label>
                  <div className="flex flex-wrap gap-2">
                    {VEHICLE_TYPES.map(v => {
                      const on = form.shuttle.vehicleTypes.includes(v)
                      return (
                        <button key={v} type="button" onClick={() => toggleVehicleType(v)}
                          className={`font-sans text-xs px-3 py-1.5 border transition-colors ${
                            on ? 'border-[#C9A96E] bg-[#C9A96E]/10 text-[#8a6f3c]' : 'border-gray-200 text-gray-500 hover:border-[#2d6a4f] hover:text-[#2d6a4f]'
                          }`}>
                          {on && <Check size={11} className="inline-block mr-1 -mt-px" />}{v}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Routes you serve</label>
                  <textarea rows={2} value={form.shuttle.routesServed}
                    onChange={e => setShuttle('routesServed', e.target.value)}
                    placeholder="OR Tambo → Bergville, Durban → Sani Pass, trailhead drops across the Northern Berg"
                    className={`${inputCls} resize-none`} />
                </div>
              </div>
            )}

            {/* Experience */}
            {has('Experience') && (
              <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
                <CardHead title="Your experience" sub="Photography workshops, stargazing, wellness retreats." />
                <div>
                  <label className={labelCls}>What do you host?</label>
                  <input value={form.experience.experienceStyle}
                    onChange={e => setExperience('experienceStyle', e.target.value)}
                    placeholder="Astro-photography weekends on the escarpment" className={inputCls} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Typical group size</label>
                    <input inputMode="numeric" value={form.experience.typicalGroupSize}
                      onChange={e => setExperience('typicalGroupSize', e.target.value)} placeholder="8" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Duration (h)</label>
                    <input inputMode="decimal" value={form.experience.durationHours}
                      onChange={e => setExperience('durationHours', e.target.value)} placeholder="6" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Setting</label>
                    <select value={form.experience.setting} onChange={e => setExperience('setting', e.target.value)} className={inputCls}>
                      <option value="">Select…</option>
                      {EXPERIENCE_SETTINGS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Activities — core offering, or an add-on for the other types */}
            <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
              <CardHead
                title={has('Activity') ? 'Your activities' : 'Activities alongside your main offering'}
                sub={has('Activity')
                  ? 'Add each activity you run. You can add more later from your supplier portal.'
                  : 'Optional — guests see a “Stay + Adventure” option when you run your own guided activities.'}
              />

              {activityAddOnOffered && (
                <div className="flex items-start justify-between gap-4 border border-gray-200 px-4 py-3.5">
                  <div>
                    <p className="font-sans text-sm font-medium text-black">We run our own guided activities</p>
                    <p className="font-sans text-xs text-gray-400 mt-0.5">
                      Turn this on to list them alongside your main offering.
                    </p>
                  </div>
                  <button
                    type="button" role="switch" aria-checked={form.offersActivities}
                    onClick={() => {
                      const on = !form.offersActivities
                      setForm(f => ({
                        ...f,
                        offersActivities: on,
                        activities: on && f.activities.length === 0 ? [emptyActivity()] : f.activities,
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
              )}

              {activitiesShown && (
                <div className="space-y-3">
                  {form.activities.map((activity, i) => (
                    <div key={i} className="border border-gray-200">
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-[#F7F5F2]">
                        <span className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 shrink-0">
                          Activity {i + 1}
                        </span>
                        <input
                          value={activity.name}
                          onChange={e => setActivity(i, { name: e.target.value })}
                          placeholder="Sentinel Peak chain ladder hike"
                          className="flex-1 bg-transparent font-sans text-sm text-black placeholder:text-gray-300 focus:outline-none min-w-0"
                        />
                        <button type="button" onClick={() => removeActivity(i)}
                          className="text-gray-300 hover:text-red-500 transition-colors shrink-0" aria-label="Remove activity">
                          <X size={14} />
                        </button>
                      </div>

                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={labelCls}>Category</label>
                            <select value={activity.category} onChange={e => setActivity(i, { category: e.target.value })} className={inputCls}>
                              <option value="">Select…</option>
                              {ACTIVITY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Difficulty</label>
                            <select value={activity.difficulty} onChange={e => setActivity(i, { difficulty: e.target.value })} className={inputCls}>
                              {ACTIVITY_DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className={labelCls}>Duration (h)</label>
                            <input inputMode="decimal" value={activity.durationHours}
                              onChange={e => setActivity(i, { durationHours: e.target.value })} placeholder="6" className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Max group</label>
                            <input inputMode="numeric" value={activity.maxGroup}
                              onChange={e => setActivity(i, { maxGroup: e.target.value })} placeholder="12" className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Min age</label>
                            <input inputMode="numeric" value={activity.minAge}
                              onChange={e => setActivity(i, { minAge: e.target.value })} placeholder="14" className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Price pp (R)</label>
                            <input inputMode="decimal" value={activity.pricePerPerson}
                              onChange={e => setActivity(i, { pricePerPerson: e.target.value })} placeholder="850" className={inputCls} />
                          </div>
                        </div>

                        <div>
                          <label className={labelCls}>What&apos;s included</label>
                          <div className="flex flex-wrap gap-2">
                            {ACTIVITY_INCLUSIONS.map(item => {
                              const on = activity.included.includes(item)
                              return (
                                <button key={item} type="button" onClick={() => toggleIncluded(i, item)}
                                  className={`font-sans text-xs px-3 py-1.5 border transition-colors ${
                                    on ? 'border-[#C9A96E] bg-[#C9A96E]/10 text-[#8a6f3c]' : 'border-gray-200 text-gray-500 hover:border-[#2d6a4f] hover:text-[#2d6a4f]'
                                  }`}>
                                  {on && <Check size={11} className="inline-block mr-1 -mt-px" />}{item}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div>
                          <label className={labelCls}>Description {optional}</label>
                          <textarea rows={2} value={activity.description}
                            onChange={e => setActivity(i, { description: e.target.value })}
                            placeholder="Pre-dawn start, chain ladder ascent to the Amphitheatre rim, back by mid-afternoon."
                            className={`${inputCls} resize-none`} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addActivity}
                    className="flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:text-[#235a3f] transition-colors py-1.5">
                    <Plus size={13} /> Add another activity
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Step 3 · Commission ───────────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
            <CardHead
              title="Choose your commission tier"
              sub="Think of it as elevation on the mountain: everyone starts at base camp with full visibility. Higher tiers buy eligibility for better placement — never a guaranteed ranking or booking."
            />
            <TierLadder selected={form.commissionTier} onSelect={id => set('commissionTier', id)} />

            <div className="flex items-start gap-2.5 bg-[#2d6a4f]/5 border border-[#2d6a4f]/20 px-4 py-3">
              <Info size={14} className="text-[#2d6a4f] mt-0.5 shrink-0" />
              <p className="font-sans text-xs text-gray-600 leading-relaxed">
                <span className="text-black font-medium">
                  {tierById(form.commissionTier).rate}% is the total platform fee
                </span>{' '}
                — not an additional charge on top of a base rate. The lowest selectable rate is {COMMISSION_MIN_RATE}%
                and the highest is {COMMISSION_MAX_RATE}%. Moving up a tier applies immediately to new bookings.
                Moving down requires notice, cannot take effect before your 90-day minimum hold ends, and never
                changes bookings already confirmed.
              </p>
            </div>

            <label className="flex items-start gap-3 font-sans text-xs text-gray-500 leading-relaxed cursor-pointer">
              <input type="checkbox" checked={form.commissionAcknowledged}
                onChange={e => set('commissionAcknowledged', e.target.checked)}
                className="mt-0.5 accent-[#2d6a4f] shrink-0" />
              <span>
                I understand the {tierById(form.commissionTier).name} tier charges{' '}
                <span className="text-black">{tierById(form.commissionTier).rate}%</span> as the total platform fee,
                and I accept the notice period and 90-day minimum hold that apply to changing it.
              </span>
            </label>
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
              <SummaryRow k="Operates" v={form.supplierTypes.join(' · ')} />
              <SummaryRow k="Trading as" v={form.tradingName} />
              <SummaryRow k="Region" v={[form.region, form.baseTown].filter(Boolean).join(' · ')} />
              <SummaryRow k="Photos" v={form.photos.length ? `${form.photos.length} uploaded` : 'None yet'} />

              {has('Accommodation') && (
                <SummaryRow k="Property" v={[
                  form.stay.propertyName, form.stay.propertyType,
                  form.stay.roomCount && `${form.stay.roomCount} rooms`,
                  form.stay.elevation && `${form.stay.elevation} m`,
                ].filter(Boolean).join(' · ')} />
              )}
              {has('Accommodation') && <SummaryRow k="Amenities" v={form.stay.amenities.join(' · ')} />}
              {has('Guided Tours') && (
                <SummaryRow k="Tours" v={[
                  form.tour.tourStyle,
                  form.tour.typicalDurationDays && `${form.tour.typicalDurationDays} days`,
                  form.tour.guideCount && `${form.tour.guideCount} guides`,
                  form.tour.certifications,
                ].filter(Boolean).join(' · ')} />
              )}
              {has('Shuttle') && (
                <SummaryRow k="Transport" v={[
                  form.shuttle.fleetSize && `${form.shuttle.fleetSize} vehicles`,
                  form.shuttle.vehicleTypes.join(', '),
                  form.shuttle.routesServed,
                ].filter(Boolean).join(' · ')} />
              )}
              {has('Experience') && (
                <SummaryRow k="Experience" v={[
                  form.experience.experienceStyle,
                  form.experience.typicalGroupSize && `groups of ${form.experience.typicalGroupSize}`,
                  form.experience.durationHours && `${form.experience.durationHours}h`,
                  form.experience.setting,
                ].filter(Boolean).join(' · ')} />
              )}
              {activitiesShown && (
                <SummaryRow k="Activities" v={form.activities.filter(a => a.name.trim()).map(a => {
                  const bits = [a.category, a.difficulty, a.durationHours && `${a.durationHours}h`,
                    a.pricePerPerson && `${formatMoney(Number(a.pricePerPerson))} pp`].filter(Boolean)
                  return `${a.name} — ${bits.join(', ')}`
                }).join(' · ')} />
              )}
              <SummaryRow
                k="Commission"
                v={`${tierById(form.commissionTier).name} — ${tierById(form.commissionTier).rate}% total platform fee`}
              />
            </div>

            <label className="flex items-start gap-3 font-sans text-xs text-gray-500 leading-relaxed cursor-pointer">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 accent-[#2d6a4f] shrink-0" />
              <span>
                I am authorised to list this business, the details above are accurate, and I accept the{' '}
                <Link href="/terms" className="text-[#2d6a4f] underline underline-offset-2">Terms of Use</Link> and{' '}
                <Link href="/privacy" className="text-[#2d6a4f] underline underline-offset-2">Privacy Policy</Link>.
              </span>
            </label>
          </div>
        )}

        {error && (
          <p className="font-sans text-sm text-red-500 bg-red-50 border border-red-200 px-4 py-3">{error}</p>
        )}

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
 * The commission ladder, drawn as elevation on the escarpment: the rail on the
 * left is the mountain, one marker per tier, base camp at the bottom. It is
 * decorative — the cards carry every fact, and the rail is hidden below md.
 */
function TierLadder({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="relative grid md:grid-cols-[56px_1fr] gap-x-5 gap-y-2.5">
      {/* Outline only — the viewBox is stretched to the ladder's height, so
          any filled detail (a snow cap, say) would smear vertically. */}
      <div className="hidden md:block absolute left-0 top-0 bottom-0 w-14 pointer-events-none" aria-hidden="true">
        <svg width="100%" height="100%" viewBox="0 0 56 100" preserveAspectRatio="none">
          <path d="M28 1 L1 99 L55 99 Z" fill="none" stroke="#E5E1DA" strokeWidth="1"
            vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      {COMMISSION_TIERS.map(tier => {
        const on = tier.id === selected
        return (
          <Fragment key={tier.id}>
            <div className="hidden md:flex items-center justify-center relative">
              <span className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${
                on ? 'bg-[#C9A96E] border-[#C9A96E] scale-125' : 'bg-white border-gray-300'
              }`} />
            </div>

            <button
              type="button"
              onClick={() => onSelect(tier.id)}
              aria-pressed={on}
              className={`text-left border px-5 py-4 transition-colors ${
                on ? 'border-[#C9A96E] bg-[#C9A96E]/5' : 'border-gray-200 hover:border-[#2d6a4f]'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-display italic text-lg text-black">{tier.name}</span>
                    <span className="font-sans text-xs text-gray-400">{tier.elevation} · {tier.tagline}</span>
                    {tier.isFloor && (
                      <span className="inline-flex items-center gap-1 font-sans text-[10px] tracking-[0.08em] uppercase text-gray-400 border border-gray-200 px-2 py-0.5">
                        <Lock size={9} /> Minimum
                      </span>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {tier.benefits.map(b => (
                      <li key={b} className="font-sans text-sm text-gray-500 flex gap-2">
                        <span className="text-[#C9A96E] leading-5">·</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`font-display italic text-2xl tabular-nums ${on ? 'text-[#C9A96E]' : 'text-black'}`}>
                    {tier.rate}%
                  </span>
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    on ? 'border-[#C9A96E] bg-[#C9A96E]' : 'border-gray-300'
                  }`}>
                    {on && <Check size={12} className="text-white" />}
                  </span>
                </div>
              </div>
            </button>
          </Fragment>
        )
      })}
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
          ref={fileRef} type="file" accept="image/*" multiple className="hidden"
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

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Loader2, Lock, ShieldAlert } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import {
  submitConcern, CONCERN_CATEGORIES,
  type ConcernCategory, type ConcernDraft,
} from '@/lib/concerns'

// The public grievance channel promised by the Supplier Code of Conduct.
//
// Deliberately outside every gate: no account, no supplier session, and an
// anonymous option that actually removes the contact fields rather than
// hiding them. The people most likely to need this — a worker reporting their
// own employer, a guest who has just been treated badly — are exactly the
// people who will not create an account to do it.

const inputCls =
  'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm text-black placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f] bg-white'
const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

const EMPTY: ConcernDraft = {
  category: 'safety',
  aboutBusiness: '',
  body: '',
  isAnonymous: false,
  reporterName: '',
  reporterEmail: '',
}

export default function ReportAConcernPage() {
  const [form, setForm] = useState<ConcernDraft>(EMPTY)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ reference: string } | null>(null)

  function set<K extends keyof ConcernDraft>(key: K, value: ConcernDraft[K]) {
    setForm(f => ({ ...f, [key]: value }))
    setError('')
  }

  async function submit() {
    if (form.body.trim().length < 20) {
      setError('Tell us what happened — a sentence or two at least, so we can act on it.')
      return
    }
    if (!form.isAnonymous && form.reporterEmail.trim() && !/^\S+@\S+\.\S+$/.test(form.reporterEmail.trim())) {
      setError('That email address does not look right.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const concern = await submitConcern(form)
      setDone({ reference: concern.reference })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <main className="max-w-2xl mx-auto px-6 pt-40 pb-24 text-center">
          <div className="w-16 h-16 bg-[#2d6a4f]/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={28} className="text-[#2d6a4f]" />
          </div>
          <h1 className="font-display italic text-4xl text-black mb-3">Report received</h1>
          <p className="font-sans text-sm text-gray-500 leading-relaxed mb-6">
            Your reference is{' '}
            <span className="font-mono text-black tracking-wide">{done.reference}</span>. Write it down — if you
            reported anonymously, it is the only way to refer back to this.
          </p>
          <p className="font-sans text-sm text-gray-500 leading-relaxed mb-10">
            Someone in our verification office reads every report. We do not retaliate against anyone who raises a
            concern in good faith, and we do not allow a supplier to.
          </p>
          <Link href="/" className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">
            Back to Visit Drakensberg
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <section className="bg-forest text-white pt-32 pb-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-3">Speak up</p>
          <h1 className="font-display italic text-4xl lg:text-5xl">Report a concern</h1>
          <p className="font-sans text-sm text-white/70 leading-relaxed mt-5 max-w-2xl">
            If something you have seen breaches our{' '}
            <Link href="/supplier-code-of-conduct" className="text-gold underline underline-offset-2">
              Supplier Code of Conduct
            </Link>{' '}
            — by a business listed with us, or by one of our own staff — tell us. You do not need an account, and you
            can do this anonymously.
          </p>
        </div>
      </section>

      <main className="max-w-2xl mx-auto px-6 py-14 space-y-5">
        <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
          <div>
            <label className={labelCls}>What is this about</label>
            <div className="space-y-2">
              {CONCERN_CATEGORIES.map(c => {
                const on = form.category === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set('category', c.id as ConcernCategory)}
                    className={`w-full text-left border p-3 transition-colors ${
                      on ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 hover:border-[#2d6a4f]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className={`mt-[3px] w-3.5 h-3.5 shrink-0 rounded-full border ${
                          on ? 'border-[#2d6a4f] bg-[#2d6a4f]' : 'border-gray-300'
                        }`}
                      />
                      <span>
                        <span className="block font-sans text-sm text-black">{c.label}</span>
                        <span className="block font-sans text-xs text-gray-500 mt-0.5">{c.blurb}</span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Which business <span className="normal-case tracking-normal text-gray-300">optional</span>
            </label>
            <input
              value={form.aboutBusiness}
              onChange={e => set('aboutBusiness', e.target.value)}
              placeholder="The name you know them by — it doesn’t have to be exact"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>What happened</label>
            <textarea
              rows={7}
              value={form.body}
              onChange={e => set('body', e.target.value)}
              placeholder="What you saw, roughly when, and who was involved. Dates and specifics help us act — but send it even if you only remember some of it."
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6 lg:p-8 space-y-5">
          <label className="flex items-start gap-3 font-sans text-sm text-gray-700 leading-relaxed cursor-pointer">
            <input
              type="checkbox"
              checked={form.isAnonymous}
              onChange={e => set('isAnonymous', e.target.checked)}
              className="mt-1 accent-[#2d6a4f] shrink-0"
            />
            <span>
              Report this anonymously
              <span className="block font-sans text-xs text-gray-400 mt-0.5">
                We will not be able to come back to you with questions, which sometimes limits what we can do.
              </span>
            </span>
          </label>

          {!form.isAnonymous && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Your name <span className="normal-case tracking-normal text-gray-300">optional</span>
                </label>
                <input value={form.reporterName} onChange={e => set('reporterName', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>
                  Email <span className="normal-case tracking-normal text-gray-300">optional</span>
                </label>
                <input
                  type="email"
                  value={form.reporterEmail}
                  onChange={e => set('reporterEmail', e.target.value)}
                  placeholder="So we can follow up"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 bg-[#2d6a4f]/5 border border-[#2d6a4f]/20 px-4 py-3">
            <Lock size={14} className="text-[#2d6a4f] mt-0.5 shrink-0" />
            <p className="font-sans text-xs text-gray-600 leading-relaxed">
              Only our verification office can read what you send. It is never shown on a listing, and it is never
              passed to the business you are reporting in a form that identifies you.
            </p>
          </div>
        </div>

        {error && (
          <p className="font-sans text-sm text-red-500 bg-red-50 border border-red-200 px-4 py-3">{error}</p>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="font-sans text-xs text-gray-400 flex items-center gap-1.5 max-w-sm leading-relaxed">
            <ShieldAlert size={13} className="shrink-0" />
            If someone is in immediate danger, call emergency services first.
          </p>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex items-center gap-2 bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </main>

      <Footer />
    </div>
  )
}

'use client'

/**
 * /waiver/[token] — the participant's signing page.
 *
 * Public and unauthenticated: the token in the URL is the only credential,
 * and it reaches the database exclusively through vd_waiver_open /
 * vd_waiver_submit, which validate it server-side on every call.
 *
 * Designed mobile-first — most participants open this on a phone, often
 * outdoors, sometimes on a poor connection.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, AlertCircle, Loader2, Eraser } from 'lucide-react'
import {
  openWaiver, submitWaiver, WAIVER_FIELD_LABELS,
  type OpenWaiver,
} from '@/lib/waivers'

const inp = 'w-full font-sans text-sm border border-black/15 rounded-lg px-3 py-2.5 outline-none focus:border-[#2d6a4f] bg-white'
const lbl = 'block font-sans text-xs tracking-[0.08em] uppercase text-black/40 mb-1.5'

const REASON_COPY: Record<string, { title: string; body: string }> = {
  not_found:      { title: 'This link isn\'t valid', body: 'Check that you copied the whole link from your email. If it still doesn\'t work, ask your operator to resend it.' },
  expired:        { title: 'This link has expired', body: 'Your operator can send you a fresh link to sign.' },
  already_signed: { title: 'Already signed', body: 'This waiver has been completed. There\'s nothing more you need to do.' },
  void:           { title: 'This waiver was withdrawn', body: 'Your operator withdrew this form. Contact them if you think that\'s a mistake.' },
}

/** Age in whole years, or null when the date can't be read. */
function ageFrom(dob: string): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  // Size the bitmap to the element so strokes aren't stretched, and account
  // for device pixel ratio so the line stays crisp on phones.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#111'
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    drawing.current = true
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasInk) setHasInk(true)
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas && hasInk) onChange(canvas.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full h-40 border border-black/15 rounded-lg bg-white touch-none"
        style={{ touchAction: 'none' }}
      />
      <div className="flex items-center justify-between mt-1.5">
        <p className="font-sans text-xs text-black/35">Sign with your finger or mouse.</p>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 font-sans text-xs text-black/40 hover:text-black/70 transition-colors"
        >
          <Eraser size={12} /> Clear
        </button>
      </div>
    </div>
  )
}

export default function WaiverSigningPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<OpenWaiver | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({})
  const [signedName, setSignedName] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    openWaiver(token).then(s => {
      setState(s)
      if (s.ok) setSignedName(s.request.participantName ?? '')
      setLoading(false)
    })
  }, [token])

  const needsGuardian = useCallback(() => {
    if (!state?.ok || !state.template.fields.dateOfBirth) return false
    const age = ageFrom(answers.dateOfBirth ?? '')
    return age !== null && age < state.template.minorAge
  }, [state, answers.dateOfBirth])

  async function handleSubmit() {
    if (!state?.ok) return
    if (!signedName.trim()) { setError('Please type your full name to sign.'); return }

    const missing = state.template.clauses.find(
      c => c.required && !acknowledged[c.id],
    )
    if (missing) { setError('Please accept all required statements before signing.'); return }

    if (needsGuardian() && !guardianName.trim()) {
      setError('A parent or guardian must countersign for participants under ' + state.template.minorAge + '.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await submitWaiver({
        token,
        answers,
        acknowledged,
        signedName: signedName.trim(),
        signature,
        guardianName: needsGuardian() ? guardianName.trim() : null,
      })
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit this waiver. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center px-6">
        <p className="font-sans text-sm text-black/30">Loading your waiver…</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-[#2d6a4f]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={28} className="text-[#2d6a4f]" />
          </div>
          <h1 className="font-display italic text-3xl text-black mb-3">Waiver signed</h1>
          <p className="font-sans text-sm text-black/50 leading-relaxed mb-8">
            Thank you. Your operator has received your signed waiver — there&apos;s nothing
            further you need to do. Keep an eye on your inbox for trip details.
          </p>
          <Link
            href="/"
            className="inline-block bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm rounded-lg hover:bg-[#235a3f] transition-colors"
          >
            Visit Drakensberg
          </Link>
        </div>
      </div>
    )
  }

  if (!state?.ok) {
    const copy = REASON_COPY[state?.reason ?? 'not_found'] ?? REASON_COPY.not_found
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle size={24} className="text-amber-600" />
          </div>
          <h1 className="font-display italic text-2xl text-black mb-2">{copy.title}</h1>
          <p className="font-sans text-sm text-black/50 leading-relaxed">{copy.body}</p>
        </div>
      </div>
    )
  }

  const { request, template, supplierName } = state

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      {/* Header */}
      <header className="bg-[#2d6a4f] text-white px-5 py-8 sm:px-8 sm:py-10">
        <div className="max-w-2xl mx-auto">
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">
            {supplierName || 'Visit Drakensberg'}
          </p>
          <h1 className="font-display italic text-2xl sm:text-3xl mb-2">{template.title}</h1>
          <p className="font-sans text-sm text-white/60">
            {request.activityName}
            {request.serviceDate && ` · ${new Date(request.serviceDate).toLocaleDateString('en-ZA', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}`}
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 sm:px-8 py-8 space-y-5">
        {template.intro && (
          <div className="bg-white border border-black/8 rounded-xl p-5">
            <p className="font-sans text-sm text-black/60 leading-relaxed whitespace-pre-wrap">
              {template.intro}
            </p>
          </div>
        )}

        {/* Participant details */}
        <section className="bg-white border border-black/8 rounded-xl p-5 space-y-4">
          <h2 className="font-display italic text-lg text-black/90">Your details</h2>

          <div>
            <label className={lbl}>Full name</label>
            <input
              value={signedName}
              onChange={e => setSignedName(e.target.value)}
              placeholder="As it appears on your ID"
              className={inp}
            />
          </div>

          {WAIVER_FIELD_LABELS.filter(f => template.fields[f.key]).map(f => (
            <div key={f.key}>
              <label className={lbl}>{f.label}</label>
              {f.key === 'medical' || f.key === 'address' ? (
                <textarea
                  rows={3}
                  value={answers[f.key] ?? ''}
                  onChange={e => setAnswers(a => ({ ...a, [f.key]: e.target.value }))}
                  placeholder={f.key === 'medical' ? 'Allergies, medication, conditions — or "none"' : ''}
                  className={`${inp} resize-none`}
                />
              ) : (
                <input
                  type={f.key === 'dateOfBirth' ? 'date' : f.key === 'phone' ? 'tel' : 'text'}
                  value={answers[f.key] ?? ''}
                  onChange={e => setAnswers(a => ({ ...a, [f.key]: e.target.value }))}
                  className={inp}
                />
              )}
              <p className="font-sans text-xs text-black/30 mt-1">{f.hint}</p>
            </div>
          ))}
        </section>

        {/* Clauses */}
        <section className="bg-white border border-black/8 rounded-xl p-5">
          <h2 className="font-display italic text-lg text-black/90 mb-3">Please read and accept</h2>
          <div className="space-y-3">
            {template.clauses.map(c => (
              <label key={c.id} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(acknowledged[c.id])}
                  onChange={e => setAcknowledged(a => ({ ...a, [c.id]: e.target.checked }))}
                  className="accent-[#2d6a4f] mt-1 w-4 h-4 shrink-0"
                />
                <span className="font-sans text-sm text-black/65 leading-relaxed">
                  {c.text}
                  {!c.required && <span className="text-black/30"> (optional)</span>}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Signature */}
        <section className="bg-white border border-black/8 rounded-xl p-5 space-y-4">
          <h2 className="font-display italic text-lg text-black/90">Signature</h2>
          <SignaturePad onChange={setSignature} />

          {needsGuardian() && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
              <p className="font-sans text-sm font-medium text-amber-800 mb-2">
                Guardian signature required
              </p>
              <p className="font-sans text-xs text-amber-700 leading-relaxed mb-3">
                This participant is under {template.minorAge}. A parent or guardian must
                countersign by entering their full name below.
              </p>
              <input
                value={guardianName}
                onChange={e => setGuardianName(e.target.value)}
                placeholder="Parent or guardian full name"
                className={inp}
              />
            </div>
          )}
        </section>

        {error && (
          <p className="font-sans text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-[#C9A96E] text-black font-sans text-sm font-medium py-3.5 rounded-lg hover:bg-[#b8965d] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <><Loader2 size={15} className="animate-spin" /> Submitting…</> : 'Sign & submit waiver'}
        </button>

        <p className="font-sans text-xs text-black/30 text-center leading-relaxed pb-8">
          By submitting you confirm the information above is accurate and that you
          accept the statements you have ticked. A copy is sent to {supplierName || 'your operator'}.
        </p>
      </main>
    </div>
  )
}

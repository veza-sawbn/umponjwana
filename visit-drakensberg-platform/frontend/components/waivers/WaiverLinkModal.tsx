'use client'

/**
 * Creates a shareable group link for one trip, then shows it ready to share.
 *
 * Unlike SendWaiverModal, nobody is emailed: the supplier gets one link (and
 * a QR code) to post in a group chat, add to their own confirmation, or show
 * at the meeting point. Everyone who opens it signs their own waiver, and
 * each signature lands in the Sent tab like any other.
 *
 * Passing `link` skips the form and opens straight on the share view, which
 * is how the Group links tab re-shows an existing link.
 */

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { Link2, Copy, Check, Share2, Download, Mail, CalendarDays, Loader2 } from 'lucide-react'
import {
  createWaiverLink, waiverUrl, sendWaiverToParticipant, emailWaiverRequest,
  type WaiverTemplate, type WaiverRequestDetails,
} from '@/lib/waivers'
import { getMyDepartures, type Departure } from '@/lib/departures'
import { getBookingsForDeparture, getGuestsForDeparture } from '@/lib/departure-guests'
import { departureParticipants, alreadySentTo, type WaiverParticipant } from '@/lib/waiver-participants'

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
const label = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-black/35 mb-1.5'

type SharedLink = { token: string; activityName: string }

/** A data: URL decoded to a PNG Blob, synchronously, so a share sheet opened
 *  straight afterwards still counts as part of the user's tap. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function ShareView({ link }: { link: SharedLink }) {
  const url = waiverUrl(link.token)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, { margin: 1, width: 480 })
      .then(d => { if (!cancelled) setQr(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [url])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  /**
   * An <a download> pointing at a data: URL doesn't save on iOS Safari: it
   * asks, then opens the data: URL as a page. So the PNG is built as a real
   * file. On a touch device it goes to the share sheet ("Save Image" puts it
   * in Photos); everywhere else, or if sharing files isn't supported, it
   * downloads through an object URL.
   */
  async function saveQr() {
    if (!qr) return
    const filename = `waiver-${link.activityName.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'link'}.png`
    const blob = dataUrlToBlob(qr)
    const file = new File([blob], filename, { type: 'image/png' })

    const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    if (touch && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Waiver QR code — ${link.activityName}` })
        return
      } catch (e) {
        // Dismissing the sheet is a choice, not a failure.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  async function share() {
    try {
      await navigator.share({
        title: `Waiver — ${link.activityName}`,
        text: `Please sign the waiver for ${link.activityName} before the trip:`,
        url,
      })
    } catch {
      // Dismissing the share sheet rejects; nothing to report.
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input readOnly value={url} onFocus={e => e.currentTarget.select()} className={`${inp} text-black/60`} />
        <button
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 border border-black/15 rounded-lg font-sans text-sm text-black/60 hover:border-[#C9A96E]/50 transition-colors"
        >
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
        </button>
      </div>

      {canShare && (
        <button
          onClick={share}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 font-sans text-sm border border-black/15 rounded-lg text-black/60 hover:border-[#C9A96E]/50 transition-colors"
        >
          <Share2 size={14} /> Share…
        </button>
      )}

      <div className="border border-black/8 rounded-xl p-4 flex flex-col items-center">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR code for the waiver link" className="w-48 h-48" />
        ) : (
          <div className="w-48 h-48 bg-black/[0.03] rounded" />
        )}
        <p className="font-sans text-xs text-black/35 mt-2 text-center">
          Participants can scan this to sign — handy at the meeting point.
        </p>
        {qr && (
          <button
            type="button"
            onClick={saveQr}
            className="mt-2 inline-flex items-center gap-1 font-sans text-xs text-[#2d6a4f] hover:underline"
          >
            <Download size={12} /> Download QR code
          </button>
        )}
      </div>

      <p className="font-sans text-[11px] text-black/35 leading-relaxed">
        Anyone with this link can sign for this trip, so share it only with your group.
        Each signature appears under Sent, and you can close the link from the Group links tab.
      </p>
    </div>
  )
}

type SendState = 'idle' | 'sending' | 'sent' | 'already' | 'failed'

/**
 * The departure's guests, each with a Send email button: one personal waiver
 * per guest (tracked by name in the Sent tab), on top of the group link.
 */
function ParticipantSendList({ participants, initiallySent, send }: {
  participants: WaiverParticipant[]
  initiallySent: Set<string>
  send: (p: WaiverParticipant) => Promise<{ requestId: string; emailed: boolean; error?: string }>
}) {
  // The waiver made for each guest, so Retry re-sends it rather than making another.
  const [made, setMade] = useState<Record<string, string>>({})
  const [state, setState] = useState<Record<string, SendState>>(() =>
    Object.fromEntries(participants.map(p => [p.key, initiallySent.has(p.key) ? 'already' : 'idle'])))
  const [bulk, setBulk] = useState(false)

  async function one(p: WaiverParticipant) {
    setState(s => ({ ...s, [p.key]: 'sending' }))
    try {
      const existing = made[p.key]
      const r = existing ? { requestId: existing, ...(await emailWaiverRequest(existing)) } : await send(p)
      setMade(m => ({ ...m, [p.key]: r.requestId }))
      setState(s => ({ ...s, [p.key]: r.emailed ? 'sent' : 'failed' }))
      if (!r.emailed) toast.error(`Waiver created for ${p.name}, but the email didn't send${r.error ? ` (${r.error})` : ''}. Copy their link from Sent.`)
    } catch (e) {
      setState(s => ({ ...s, [p.key]: 'failed' }))
      toast.error(e instanceof Error ? e.message : `Could not send to ${p.name}.`)
    }
  }

  const pending = participants.filter(p => p.email && (state[p.key] === 'idle' || state[p.key] === 'failed'))
  async function all() {
    setBulk(true)
    for (const p of pending) await one(p)
    setBulk(false)
  }

  return (
    <div className="border border-black/8 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans text-sm font-medium text-black/80">Email each guest their own waiver</p>
          <p className="font-sans text-[11px] text-black/40 mt-0.5">
            Each guest gets a personal link to sign, tracked by name under Sent. The group link above still works for anyone else.
          </p>
        </div>
        {pending.length > 1 && (
          <button onClick={all} disabled={bulk}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A96E] text-white font-sans text-xs disabled:opacity-50">
            {bulk ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} Send to all ({pending.length})
          </button>
        )}
      </div>
      <ul className="divide-y divide-black/5">
        {participants.map(p => {
          const st = state[p.key]
          return (
            <li key={p.key} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block font-sans text-sm text-black/80 truncate">
                  {p.name}{p.seats > 1 && <span className="text-black/35"> · {p.seats} seats</span>}
                </span>
                <span className="block font-sans text-[11px] text-black/40 truncate">
                  {p.email ?? 'No email: share the group link with them'}{p.source === 'online' ? ' · booked online' : ''}
                </span>
              </span>
              {p.email && (
                st === 'sent' || st === 'already' ? (
                  <span className="shrink-0 inline-flex items-center gap-1 font-sans text-xs text-emerald-700">
                    <Check size={12} /> {st === 'sent' ? 'Sent' : 'Already sent'}
                  </span>
                ) : (
                  <button onClick={() => one(p)} disabled={st === 'sending' || bulk}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/15 font-sans text-xs text-black/70 hover:border-[#C9A96E]/60 disabled:opacity-50">
                    {st === 'sending' ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                    {st === 'failed' ? 'Retry' : 'Send email'}
                  </button>
                )
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function WaiverLinkModal({
  templates, link: existing, onClose, onCreated, onSent, requests = [],
}: {
  templates: WaiverTemplate[]
  link?: SharedLink
  onClose: () => void
  onCreated?: () => void
  /** A personal waiver was created for a guest (emailed or not): refresh Sent. */
  onSent?: () => void
  /** Waivers already sent, so a guest who has one isn't offered another. */
  requests?: WaiverRequestDetails[]
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [activityName, setActivityName] = useState('')
  const [serviceDate, setServiceDate] = useState('')
  const [bookingReference, setBookingReference] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [maxSignatures, setMaxSignatures] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<SharedLink | null>(existing ?? null)

  // Pull a scheduled departure: fills the trip details and loads its guests.
  const [departures, setDepartures] = useState<Departure[]>([])
  const [departureId, setDepartureId] = useState('')
  const [participants, setParticipants] = useState<WaiverParticipant[]>([])
  const [loadingGuests, setLoadingGuests] = useState(false)
  useEffect(() => {
    if (existing) return
    const today = new Date().toISOString().slice(0, 10)
    getMyDepartures()
      .then(ds => setDepartures(ds.filter(d => d.date >= today).sort((a, b) => a.date.localeCompare(b.date))))
      .catch(() => setDepartures([]))
  }, [existing])

  // Bumped on every pick: a slower answer for an earlier departure must never
  // replace the guests of the one now selected (its Send buttons would email
  // this trip's waiver to the other trip's guests).
  const pickGeneration = useRef(0)
  async function pickDeparture(id: string) {
    const generation = ++pickGeneration.current
    setDepartureId(id)
    setParticipants([])
    setLoadingGuests(false)
    const d = departures.find(x => x.id === id)
    if (!d) return
    setActivityName(d.tour)
    setServiceDate(d.date)
    setExpiresAt(d.date)
    setMaxSignatures(d.bookedSeats > 0 ? String(d.bookedSeats) : '')
    setLoadingGuests(true)
    try {
      const [b, g] = await Promise.all([getBookingsForDeparture(id), getGuestsForDeparture(id)])
      if (generation !== pickGeneration.current) return
      setParticipants(departureParticipants(b, g))
    } finally {
      if (generation === pickGeneration.current) setLoadingGuests(false)
    }
  }

  // Captured at creation so the per-guest emails match the link exactly.
  const [sendBasis, setSendBasis] = useState<{ activityName: string; serviceDate: string | null; bookingReference: string | null; expiresAt: string | null } | null>(null)
  const initiallySent = new Set(participants
    .filter(p => alreadySentTo(p.email, serviceDate || null, activityName, requests))
    .map(p => p.key))

  async function submit() {
    if (!templateId) { toast.error('Choose a waiver form.'); return }
    if (!activityName.trim()) { toast.error('Name the activity or tour.'); return }

    let cap: number | null = null
    if (maxSignatures.trim()) {
      cap = Number(maxSignatures)
      if (!Number.isInteger(cap) || cap < 1 || cap > 1000) {
        toast.error('Group size must be a whole number between 1 and 1000.')
        return
      }
    }

    setBusy(true)
    try {
      // A date input gives midnight at the start of the day; keep the link
      // open through the whole of the chosen day.
      const expiry = expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null
      const { token } = await createWaiverLink({
        templateId,
        activityName,
        serviceDate: serviceDate || null,
        bookingReference: bookingReference || null,
        expiresAt: expiry,
        maxSignatures: cap,
      })
      setSendBasis({
        activityName: activityName.trim(),
        serviceDate: serviceDate || null,
        bookingReference: bookingReference || null,
        expiresAt: expiry,
      })
      setCreated({ token, activityName: activityName.trim() })
      onCreated?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5">
          <h2 className="font-display italic text-2xl text-black/90 flex items-center gap-2">
            <Link2 size={20} className="text-[#C9A96E]" />
            {created ? 'Share group link' : 'Create group link'}
          </h2>
          <p className="font-sans text-sm text-black/40 mt-1">
            {created
              ? created.activityName
              : 'One link for the whole trip. Everyone who opens it fills in and signs their own waiver — no emails needed.'}
          </p>
        </div>

        {created ? (
          <>
            <ShareView link={created} />
            {sendBasis && participants.length > 0 && (
              <div className="mt-4">
                <ParticipantSendList
                  participants={participants}
                  initiallySent={initiallySent}
                  send={async p => {
                    const r = await sendWaiverToParticipant({ templateId, ...sendBasis, name: p.name, email: p.email! })
                    onSent?.()
                    return r
                  }}
                />
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full mt-6 py-2.5 font-sans text-sm bg-[#C9A96E] text-white rounded-lg hover:bg-[#b8965d] transition-colors"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label className={label}>Departure <span className="normal-case tracking-normal text-black/20">optional</span></label>
                <select value={departureId} onChange={e => pickDeparture(e.target.value)} className={inp}>
                  <option value="">{departures.length ? 'Pick a scheduled departure…' : 'No upcoming departures'}</option>
                  {departures.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.tour} · {new Date(`${d.date}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} · {d.bookedSeats}/{d.maxSeats} booked
                    </option>
                  ))}
                </select>
                {departureId && (
                  <p className="font-sans text-[11px] text-black/40 mt-1 flex items-center gap-1">
                    <CalendarDays size={11} />
                    {loadingGuests ? 'Loading guests…'
                      : participants.length === 0 ? 'No guests on this departure yet. The link still works for anyone you share it with.'
                      : `${participants.length} guest${participants.length === 1 ? '' : 's'} found. After creating the link you can email each one their waiver.`}
                  </p>
                )}
              </div>

              <div>
                <label className={label}>Waiver form</label>
                <select value={templateId} onChange={e => setTemplateId(e.target.value)} className={inp}>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>

              <div>
                <label className={label}>Activity / tour</label>
                <input
                  value={activityName}
                  onChange={e => setActivityName(e.target.value)}
                  placeholder="e.g. Tugela Gorge day hike"
                  className={inp}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Date of activity</label>
                  <input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={label}>Booking ref <span className="normal-case tracking-normal text-black/20">optional</span></label>
                  <input value={bookingReference} onChange={e => setBookingReference(e.target.value)} className={inp} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Group size <span className="normal-case tracking-normal text-black/20">optional</span></label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    inputMode="numeric"
                    value={maxSignatures}
                    onChange={e => setMaxSignatures(e.target.value)}
                    placeholder="No limit"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={label}>Link expires <span className="normal-case tracking-normal text-black/20">optional</span></label>
                  <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={inp} />
                </div>
              </div>
              <p className="font-sans text-[11px] text-black/30 -mt-2">
                The link stops accepting signatures once the group size is reached or after the
                expiry date. Setting both keeps a forwarded link from being misused.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 font-sans text-sm border border-black/15 rounded-lg text-black/50 hover:border-black/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 font-sans text-sm bg-[#C9A96E] text-white rounded-lg hover:bg-[#b8965d] disabled:opacity-50 transition-colors"
              >
                <Link2 size={14} /> {busy ? 'Creating…' : 'Create link'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

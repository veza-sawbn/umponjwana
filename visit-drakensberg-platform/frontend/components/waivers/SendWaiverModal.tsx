'use client'

/**
 * Sends a waiver form to one or more participants.
 *
 * Each participant gets their own request row and their own token, so a link
 * is never shared between people and withdrawing one doesn't affect the rest.
 */

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, X, Send } from 'lucide-react'
import { sendWaiverRequests, type WaiverTemplate } from '@/lib/waivers'

type Participant = { name: string; email: string }

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
const label = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-black/35 mb-1.5'

export default function SendWaiverModal({
  templates, onClose, onSent,
}: {
  templates: WaiverTemplate[]
  onClose: () => void
  onSent: () => void
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [activityName, setActivityName] = useState('')
  const [serviceDate, setServiceDate] = useState('')
  const [bookingReference, setBookingReference] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([{ name: '', email: '' }])
  const [busy, setBusy] = useState(false)

  function setP(i: number, patch: Partial<Participant>) {
    setParticipants(ps => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }

  async function submit() {
    if (!templateId) { toast.error('Choose a waiver form.'); return }
    if (!activityName.trim()) { toast.error('Name the activity or tour.'); return }

    const cleaned = participants
      .map(p => ({ name: p.name.trim(), email: p.email.trim() }))
      .filter(p => p.name || p.email)

    if (cleaned.length === 0) { toast.error('Add at least one participant.'); return }
    const bad = cleaned.find(p => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
    if (bad) { toast.error(`${bad.name || 'A participant'} needs a valid email address.`); return }

    setBusy(true)
    try {
      await sendWaiverRequests({
        templateId,
        activityName,
        serviceDate: serviceDate || null,
        bookingReference: bookingReference || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        participants: cleaned,
      })
      toast.success(
        cleaned.length === 1
          ? 'Waiver sent.'
          : `${cleaned.length} waivers sent.`,
      )
      onSent()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send the waivers.')
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
          <h2 className="font-display italic text-2xl text-black/90">Send Waiver</h2>
          <p className="font-sans text-sm text-black/40 mt-1">
            Each participant gets their own private link to sign.
          </p>
        </div>

        <div className="space-y-4">
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

          <div>
            <label className={label}>Link expires <span className="normal-case tracking-normal text-black/20">optional</span></label>
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={inp} />
            <p className="font-sans text-[11px] text-black/30 mt-1">
              After this date the link stops working. Leave blank to keep it open.
            </p>
          </div>

          <div>
            <label className={label}>Participants</label>
            <div className="space-y-2">
              {participants.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={p.name}
                    onChange={e => setP(i, { name: e.target.value })}
                    placeholder="Full name"
                    className={inp}
                  />
                  <input
                    value={p.email}
                    onChange={e => setP(i, { email: e.target.value })}
                    placeholder="email@example.com"
                    className={inp}
                  />
                  {participants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setParticipants(ps => ps.filter((_, idx) => idx !== i))}
                      className="shrink-0 px-2 text-black/25 hover:text-red-500 transition-colors"
                      aria-label="Remove participant"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setParticipants(ps => [...ps, { name: '', email: '' }])}
              className="mt-2 inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline"
            >
              <Plus size={13} /> Add another participant
            </button>
          </div>
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
            <Send size={14} /> {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

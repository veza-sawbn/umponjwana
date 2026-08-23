'use client'

/**
 * Builder for a waiver form. Used by both /supplier/waivers/new and
 * /supplier/waivers/[id].
 *
 * Clause ids are generated once and kept stable across edits, because
 * submissions record acknowledgement per clause id — reusing or reindexing
 * them would corrupt what past participants are shown to have agreed to.
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { ChevronLeft, Plus, X, GripVertical } from 'lucide-react'
import {
  saveWaiverTemplate, newClauseId, WAIVER_FIELD_LABELS,
  type WaiverTemplate, type WaiverClause, type WaiverFields,
} from '@/lib/waivers'

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

const STARTER_CLAUSES: string[] = [
  'I understand that this activity takes place in a mountain environment and carries inherent risks, including injury.',
  'I confirm I am physically fit to take part and have disclosed any medical condition that may affect my participation.',
  'I agree to follow the guide\'s instructions and safety briefings at all times.',
]

export default function WaiverTemplateForm({ existing }: { existing?: WaiverTemplate }) {
  const router = useRouter()
  const [title, setTitle] = useState(existing?.title ?? '')
  const [intro, setIntro] = useState(existing?.intro ?? '')
  const [clauses, setClauses] = useState<WaiverClause[]>(
    existing?.clauses ?? STARTER_CLAUSES.map(text => ({ id: newClauseId(), text, required: true })),
  )
  const [fields, setFields] = useState<WaiverFields>(
    existing?.fields ?? { dateOfBirth: true, phone: true, emergencyContact: true, medical: true },
  )
  const [minorAge, setMinorAge] = useState(existing?.minor_age ?? 18)
  const [isActive, setIsActive] = useState(existing?.is_active ?? true)
  const [saving, setSaving] = useState(false)

  function setClause(id: string, patch: Partial<WaiverClause>) {
    setClauses(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  async function save() {
    if (!title.trim()) { toast.error('Give the form a title.'); return }
    const cleaned = clauses
      .map(c => ({ ...c, text: c.text.trim() }))
      .filter(c => c.text)
    if (cleaned.length === 0) { toast.error('Add at least one clause.'); return }

    setSaving(true)
    try {
      await saveWaiverTemplate({
        id: existing?.id,
        title, intro, clauses: cleaned, fields, minorAge, isActive,
      })
      toast.success(existing ? 'Waiver form updated.' : 'Waiver form created.')
      router.push('/supplier/waivers')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the form.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      <button
        onClick={() => router.push('/supplier/waivers')}
        className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"
      >
        <ChevronLeft size={14} /> Waivers
      </button>
      <h1 className="font-display italic text-2xl text-black/90 mb-6">
        {existing ? 'Edit Waiver Form' : 'New Waiver Form'}
      </h1>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        <div>
          <label className="font-sans text-sm font-medium text-black/70 block mb-1.5">
            Title <span className="text-[#C9A96E]">*</span>
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Guided Hike — Liability Waiver"
            className={inp}
          />
        </div>

        <div>
          <label className="font-sans text-sm font-medium text-black/70 block mb-1.5">Introduction</label>
          <textarea
            value={intro}
            onChange={e => setIntro(e.target.value)}
            rows={4}
            placeholder="Explain what this waiver covers and why you need it…"
            className={`${inp} resize-none`}
          />
          <p className="font-sans text-xs text-black/35 mt-1">
            Shown at the top of the form before the clauses.
          </p>
        </div>

        {/* Clauses */}
        <div>
          <label className="font-sans text-sm font-medium text-black/70 block mb-1.5">
            Clauses <span className="text-[#C9A96E]">*</span>
          </label>
          <div className="space-y-2">
            {clauses.map(c => (
              <div key={c.id} className="border border-black/8 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <GripVertical size={14} className="text-black/15 mt-2 shrink-0" />
                  <textarea
                    value={c.text}
                    onChange={e => setClause(c.id, { text: e.target.value })}
                    rows={2}
                    placeholder="Write the statement the participant must agree to…"
                    className="flex-1 font-sans text-sm outline-none resize-none bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setClauses(cs => cs.filter(x => x.id !== c.id))}
                    className="text-black/20 hover:text-red-500 shrink-0 mt-1 transition-colors"
                    aria-label="Remove clause"
                  >
                    <X size={14} />
                  </button>
                </div>
                <label className="flex items-center gap-2 mt-2 pl-6 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.required}
                    onChange={e => setClause(c.id, { required: e.target.checked })}
                    className="accent-[#C9A96E]"
                  />
                  <span className="font-sans text-xs text-black/40">
                    Must be ticked before the participant can submit
                  </span>
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setClauses(cs => [...cs, { id: newClauseId(), text: '', required: true }])}
            className="mt-2 inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline"
          >
            <Plus size={13} /> Add clause
          </button>
        </div>

        {/* Participant details */}
        <div>
          <label className="font-sans text-sm font-medium text-black/70 block mb-1.5">
            Details to collect
          </label>
          <div className="space-y-2">
            {WAIVER_FIELD_LABELS.map(f => (
              <label key={f.key} className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(fields[f.key])}
                  onChange={e => setFields(v => ({ ...v, [f.key]: e.target.checked }))}
                  className="accent-[#C9A96E] mt-0.5"
                />
                <span>
                  <span className="block font-sans text-sm text-black/70">{f.label}</span>
                  <span className="block font-sans text-xs text-black/35">{f.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-sans text-sm font-medium text-black/70 block mb-1.5">
              Guardian required under
            </label>
            <input
              type="number"
              value={minorAge}
              onChange={e => setMinorAge(+e.target.value)}
              min={0}
              max={21}
              className={inp}
            />
            <p className="font-sans text-xs text-black/35 mt-1">
              Only applies when you collect date of birth.
            </p>
          </div>
          <div>
            <label className="font-sans text-sm font-medium text-black/70 block mb-1.5">Status</label>
            <div className="flex gap-2">
              {[['Active', true], ['Draft', false]].map(([lbl, val]) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setIsActive(val as boolean)}
                  className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    isActive === val
                      ? 'bg-[#C9A96E] text-white border-[#C9A96E]'
                      : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'
                  }`}
                >
                  {lbl as string}
                </button>
              ))}
            </div>
            <p className="font-sans text-xs text-black/35 mt-2">
              Only active forms can be sent.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Create form'}
        </button>
        <button
          onClick={() => router.push('/supplier/waivers')}
          className="font-sans text-sm px-5 py-2.5 border border-black/15 rounded-lg text-black/50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

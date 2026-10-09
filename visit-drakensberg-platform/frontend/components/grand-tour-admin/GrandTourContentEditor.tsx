'use client'

/**
 * Edit the words and pictures of /grand-tour: hero, introduction, every stage
 * and its highlights, and the "how booking works" band. Saved to site_content
 * (admin-only write) via lib/grand-tour-content.ts; the page renders it on the
 * next request.
 *
 * Ids are kept when text changes: day tours point at highlight ids and stage
 * features point at stage ids, so renaming "Sani Top" never detaches the tours
 * that visit it. New stages and highlights get fresh ids.
 */

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Plus, RotateCcw, Trash2, Check } from 'lucide-react'
import { MediaPicker } from '@/components/media/MediaPicker'
import { adminMediaSource } from '@/lib/admin-supabase'
import type { GrandTourStage, GrandTourHighlight } from '@/lib/grand-tour'
import {
  getGrandTourContent, saveGrandTourContent, contentId, DEFAULT_GRAND_TOUR_CONTENT, type GrandTourContent,
} from '@/lib/grand-tour-content'

const inp = 'w-full border border-gray-200 bg-white px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]'
const AREAS = ['Northern Drakensberg', 'Central Drakensberg', 'Southern Drakensberg']
const REGION_PAGES = [
  { slug: '', label: 'No region link' },
  { slug: 'north-berg', label: 'Northern Drakensberg' },
  { slug: 'central-berg', label: 'Central Drakensberg' },
  { slug: 'south-berg', label: 'Southern Drakensberg' },
]

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block font-sans text-[11px] tracking-wider uppercase text-gray-500 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block font-sans text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}

function Panel({ title, subtitle, open, onToggle, actions, children }: {
  title: string; subtitle?: string; open: boolean; onToggle: () => void; actions?: ReactNode; children: ReactNode
}) {
  return (
    <section className="bg-white border border-gray-200">
      <div className="flex items-center gap-2 pr-3">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex-1 text-left px-5 py-4 flex items-center gap-3 min-w-0">
          <ChevronDown size={16} className={`text-gray-400 transition-transform shrink-0 ${open ? '' : '-rotate-90'}`} />
          <span className="min-w-0">
            <span className="block font-sans text-sm font-medium text-gray-900 truncate">{title}</span>
            {subtitle && <span className="block font-sans text-xs text-gray-400 truncate">{subtitle}</span>}
          </span>
        </button>
        {actions}
      </div>
      {open && <div className="border-t border-gray-100 p-5 space-y-4">{children}</div>}
    </section>
  )
}

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= list.length) return list
  const next = list.slice()
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export default function GrandTourContentEditor() {
  const [content, setContent] = useState<GrandTourContent | null>(null)
  const [saved, setSaved] = useState<string>('')
  const [open, setOpen] = useState<Set<string>>(new Set(['hero']))
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    getGrandTourContent().then(c => { setContent(c); setSaved(JSON.stringify(c)) })
  }, [])

  // Warn before leaving with unsaved edits.
  const dirty = !!content && JSON.stringify(content) !== saved
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (!content) return <p className="font-sans text-sm text-gray-400">Loading page content…</p>

  const toggle = (key: string) => setOpen(o => { const n = new Set(o); n.has(key) ? n.delete(key) : n.add(key); return n })
  const patch = (fn: (c: GrandTourContent) => GrandTourContent) => { setContent(c => (c ? fn(c) : c)); setStatus(null) }
  const setStage = (i: number, p: Partial<GrandTourStage>) =>
    patch(c => ({ ...c, stages: c.stages.map((s, k) => (k === i ? { ...s, ...p } : s)) }))
  const setHighlight = (si: number, hi: number, p: Partial<GrandTourHighlight>) =>
    setStage(si, { highlights: content.stages[si].highlights.map((h, k) => (k === hi ? { ...h, ...p } : h)) })

  function addStage() {
    const id = contentId('stage')
    patch(c => ({
      ...c,
      stages: [...c.stages, {
        id, number: c.stages.length + 1, area: '', regionSlug: '', name: 'New stage', kicker: '', intro: '', image: '',
        highlights: [],
      }],
    }))
    setOpen(o => new Set(o).add(`stage:${id}`))
  }

  function removeStage(i: number) {
    const s = content!.stages[i]
    if (!window.confirm(`Remove “${s.name}” from the Grand Tour? Day tours that only visit its highlights lose their place on the route, and anything featured on it stops showing.`)) return
    patch(c => ({ ...c, stages: c.stages.filter((_, k) => k !== i) }))
  }

  function removeHighlight(si: number, hi: number) {
    const h = content!.stages[si].highlights[hi]
    if (!window.confirm(`Remove “${h.name || 'this highlight'}”? Day tours that visit it will no longer list it.`)) return
    setStage(si, { highlights: content!.stages[si].highlights.filter((_, k) => k !== hi) })
  }

  async function save() {
    if (!content) return
    const empty = content.stages.find(s => !s.name.trim())
    if (empty) { setStatus({ kind: 'error', text: 'Every stage needs a name.' }); return }
    setSaving(true)
    try {
      await saveGrandTourContent(content)
      setSaved(JSON.stringify(content))
      setStatus({ kind: 'ok', text: 'Saved. The page shows the new content now.' })
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save.' })
    } finally {
      setSaving(false)
    }
  }

  function resetToOriginal() {
    if (!window.confirm('Replace everything here with the original Grand Tour text and pictures? Nothing is saved until you press Save.')) return
    patch(() => structuredClone(DEFAULT_GRAND_TOUR_CONTENT))
  }

  const { hero, intro, stages, howItWorks } = content

  return (
    <div className="space-y-4 pb-40 lg:pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-sans text-sm text-gray-500">
          Edits go live when you press <strong>Save</strong>. Leave a blank line between paragraphs.
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={resetToOriginal} className="font-sans text-xs text-gray-500 hover:text-black px-2 py-2 flex items-center gap-1"><RotateCcw size={12} /> Original text</button>
          <Link href="/grand-tour" target="_blank" className="font-sans text-xs text-gray-500 hover:text-black px-2 py-2 flex items-center gap-1">View page <ExternalLink size={11} /></Link>
        </div>
      </div>

      {/* Hero */}
      <Panel title="Hero" subtitle={hero.title} open={open.has('hero')} onToggle={() => toggle('hero')}>
        <Field label="Title"><input value={hero.title} onChange={e => patch(c => ({ ...c, hero: { ...c.hero, title: e.target.value } }))} className={inp} /></Field>
        <Field label="Subtitle"><textarea rows={2} value={hero.subtitle} onChange={e => patch(c => ({ ...c, hero: { ...c.hero, subtitle: e.target.value } }))} className={inp} /></Field>
        <Field label="Line above the title" hint="Leave blank to show “North to south · 7 stages · 20 highlights”, counted from the stages below.">
          <input value={hero.eyebrow} onChange={e => patch(c => ({ ...c, hero: { ...c.hero, eyebrow: e.target.value } }))} className={inp} />
        </Field>
        <Field label="Background image">
          <MediaPicker value={hero.image} onChange={url => patch(c => ({ ...c, hero: { ...c.hero, image: url } }))} source={adminMediaSource} />
        </Field>
        <Field label="Image description" hint="Read aloud by screen readers.">
          <input value={hero.imageAlt} onChange={e => patch(c => ({ ...c, hero: { ...c.hero, imageAlt: e.target.value } }))} className={inp} />
        </Field>
      </Panel>

      {/* Intro */}
      <Panel title="Introduction" subtitle={intro.heading} open={open.has('intro')} onToggle={() => toggle('intro')}>
        <Field label="Small heading"><input value={intro.kicker} onChange={e => patch(c => ({ ...c, intro: { ...c.intro, kicker: e.target.value } }))} className={inp} /></Field>
        <Field label="Heading"><input value={intro.heading} onChange={e => patch(c => ({ ...c, intro: { ...c.intro, heading: e.target.value } }))} className={inp} /></Field>
        <Field label="Text"><textarea rows={5} value={intro.body} onChange={e => patch(c => ({ ...c, intro: { ...c.intro, body: e.target.value } }))} className={inp} /></Field>
      </Panel>

      {/* Stages */}
      <div className="pt-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display italic text-2xl">Stages</h2>
          <p className="font-sans text-xs text-gray-500">In route order. Numbers follow the order automatically.</p>
        </div>
        <button type="button" onClick={addStage} className="font-sans text-xs border border-[#2d6a4f] text-[#2d6a4f] px-3 py-2 hover:bg-[#2d6a4f] hover:text-white flex items-center gap-1"><Plus size={12} /> Add stage</button>
      </div>

      {stages.map((stage, si) => {
        const key = `stage:${stage.id}`
        return (
          <Panel
            key={stage.id}
            title={`${si + 1}. ${stage.name || 'Untitled stage'}`}
            subtitle={`${stage.highlights.length} highlight${stage.highlights.length === 1 ? '' : 's'}${stage.area ? ` · ${stage.area}` : ''}`}
            open={open.has(key)}
            onToggle={() => toggle(key)}
            actions={
              <div className="flex items-center shrink-0">
                <button type="button" onClick={() => patch(c => ({ ...c, stages: move(c.stages, si, -1) }))} disabled={si === 0} aria-label="Move stage up" className="p-2 text-gray-400 hover:text-black disabled:opacity-30"><ArrowUp size={14} /></button>
                <button type="button" onClick={() => patch(c => ({ ...c, stages: move(c.stages, si, 1) }))} disabled={si === stages.length - 1} aria-label="Move stage down" className="p-2 text-gray-400 hover:text-black disabled:opacity-30"><ArrowDown size={14} /></button>
                <button type="button" onClick={() => removeStage(si)} disabled={stages.length === 1} aria-label="Remove stage" className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30"><Trash2 size={14} /></button>
              </div>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><input value={stage.name} onChange={e => setStage(si, { name: e.target.value })} className={inp} /></Field>
              <Field label="Tagline"><input value={stage.kicker} onChange={e => setStage(si, { kicker: e.target.value })} className={inp} placeholder="e.g. Over the top, into Lesotho" /></Field>
              <Field label="Area" hint="Shown above the name, and used to suggest things to feature here.">
                <input list="gt-areas" value={stage.area} onChange={e => setStage(si, { area: e.target.value })} className={inp} />
              </Field>
              <Field label="“Explore the region” link">
                <select value={stage.regionSlug} onChange={e => setStage(si, { regionSlug: e.target.value })} className={inp}>
                  {REGION_PAGES.map(r => <option key={r.slug} value={r.slug}>{r.label}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Introduction"><textarea rows={3} value={stage.intro} onChange={e => setStage(si, { intro: e.target.value })} className={inp} /></Field>
            <Field label="Image"><MediaPicker value={stage.image} onChange={url => setStage(si, { image: url })} source={adminMediaSource} /></Field>
            {si > 0 && (
              <Field label="Travel from the previous stage" hint="Shown between stages, e.g. “About 1 h 30 by road”. Leave blank to hide.">
                <input value={stage.legFromPrevious ?? ''} onChange={e => setStage(si, { legFromPrevious: e.target.value || undefined })} className={inp} />
              </Field>
            )}

            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <p className="font-sans text-[11px] tracking-wider uppercase text-gray-500">Highlights</p>
                <button
                  type="button"
                  onClick={() => setStage(si, { highlights: [...stage.highlights, { id: contentId('highlight'), name: '', blurb: '' }] })}
                  className="font-sans text-xs text-[#2d6a4f] hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Add highlight
                </button>
              </div>
              {stage.highlights.length === 0 && <p className="font-sans text-xs text-gray-400">No highlights yet.</p>}
              <ol className="space-y-3">
                {stage.highlights.map((h, hi) => (
                  <li key={h.id} className="border border-gray-100 bg-[#F7F5F2]/60 p-3">
                    <div className="flex items-start gap-2">
                      <span className="font-display italic text-lg text-[#C9A96E] w-10 shrink-0 tabular-nums">{si + 1}.{hi + 1}</span>
                      <div className="flex-1 grid gap-2 sm:grid-cols-[1fr_180px]">
                        <input value={h.name} onChange={e => setHighlight(si, hi, { name: e.target.value })} placeholder="Name, e.g. Sani Top" aria-label="Highlight name" className={inp} />
                        <input value={h.fact ?? ''} onChange={e => setHighlight(si, hi, { fact: e.target.value || undefined })} placeholder="Fact, e.g. 2,876 m" aria-label="Fact" className={inp} />
                        <textarea rows={2} value={h.blurb} onChange={e => setHighlight(si, hi, { blurb: e.target.value })} placeholder="One or two sentences" aria-label="Description" className={`${inp} sm:col-span-2`} />
                      </div>
                      <div className="flex flex-col shrink-0">
                        <button type="button" onClick={() => setStage(si, { highlights: move(stage.highlights, hi, -1) })} disabled={hi === 0} aria-label="Move highlight up" className="p-1.5 text-gray-400 hover:text-black disabled:opacity-30"><ArrowUp size={13} /></button>
                        <button type="button" onClick={() => setStage(si, { highlights: move(stage.highlights, hi, 1) })} disabled={hi === stage.highlights.length - 1} aria-label="Move highlight down" className="p-1.5 text-gray-400 hover:text-black disabled:opacity-30"><ArrowDown size={13} /></button>
                        <button type="button" onClick={() => removeHighlight(si, hi)} aria-label="Remove highlight" className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Panel>
        )
      })}
      <datalist id="gt-areas">{AREAS.map(a => <option key={a} value={a} />)}</datalist>

      {/* How it works */}
      <div className="pt-4"><h2 className="font-display italic text-2xl">Closing section</h2></div>
      <Panel title="How booking works" subtitle={howItWorks.heading} open={open.has('how')} onToggle={() => toggle('how')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Small heading"><input value={howItWorks.kicker} onChange={e => patch(c => ({ ...c, howItWorks: { ...c.howItWorks, kicker: e.target.value } }))} className={inp} /></Field>
          <Field label="Heading"><input value={howItWorks.heading} onChange={e => patch(c => ({ ...c, howItWorks: { ...c.howItWorks, heading: e.target.value } }))} className={inp} /></Field>
        </div>
        {howItWorks.steps.map((st, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[200px_1fr]">
            <Field label={`Step ${i + 1}`}>
              <input value={st.title} onChange={e => patch(c => ({ ...c, howItWorks: { ...c.howItWorks, steps: c.howItWorks.steps.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) } }))} className={inp} />
            </Field>
            <Field label="Text">
              <input value={st.text} onChange={e => patch(c => ({ ...c, howItWorks: { ...c.howItWorks, steps: c.howItWorks.steps.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) } }))} className={inp} />
            </Field>
          </div>
        ))}
        <Field label="Line for operators"><input value={howItWorks.supplierLine} onChange={e => patch(c => ({ ...c, howItWorks: { ...c.howItWorks, supplierLine: e.target.value } }))} className={inp} /></Field>
        <Field label="Button text" hint="Links to /list-with-us. Leave blank to hide the button.">
          <input value={howItWorks.supplierCta} onChange={e => patch(c => ({ ...c, howItWorks: { ...c.howItWorks, supplierCta: e.target.value } }))} className={inp} />
        </Field>
      </Panel>

      {/* Save bar */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] lg:bottom-0 right-0 left-0 lg:left-60 z-30 bg-white border-t border-gray-200 px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
        <p className={`font-sans text-sm ${status?.kind === 'error' ? 'text-red-600' : status?.kind === 'ok' ? 'text-emerald-700' : 'text-gray-500'}`} role="status">
          {status ? <>{status.kind === 'ok' && <Check size={14} className="inline mr-1" />}{status.text}</> : dirty ? 'Unsaved changes' : 'All changes saved'}
        </p>
        <button type="button" onClick={save} disabled={saving || !dirty} className="bg-[#2d6a4f] text-white font-sans text-sm px-6 py-2.5 hover:bg-[#235a3f] disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

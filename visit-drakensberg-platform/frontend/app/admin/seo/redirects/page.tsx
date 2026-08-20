'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Loader2, Plus, Trash2, Pencil, CheckCircle, AlertCircle,
  AlertTriangle, ArrowRight, ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/auth'
import {
  getRedirects, addRedirect, updateRedirect, deleteRedirect,
} from '@/lib/redirects'
import type { Redirect } from '@/lib/redirects'

// ── Helpers ───────────────────────────────────────────────────────────────────

const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'
const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'

function pathHint(value: string): string | null {
  if (!value) return null
  if (!value.startsWith('/') && !value.startsWith('http')) return 'Path should start with /'
  if (value === '/') return null
  if (value.endsWith('/') && value.length > 1) return 'Avoid trailing slash'
  return null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Form state ────────────────────────────────────────────────────────────────

type FormState = {
  from: string
  to: string
  statusCode: 301 | 302
  note: string
}

const EMPTY_FORM: FormState = { from: '', to: '', statusCode: 301, note: '' }

// ── Main component ────────────────────────────────────────────────────────────

export default function RedirectsPage() {
  const [redirects, setRedirects] = useState<Redirect[]>([])
  const [loading, setLoading] = useState(true)

  // Form
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [collapseNotice, setCollapseNotice] = useState<{ original: string; resolved: string } | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Current user
  const [userEmail, setUserEmail] = useState('admin')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) setUserEmail(data.session.user.email)
    })
    load()
  }, [])

  async function load() {
    try {
      setRedirects(await getRedirects())
    } finally {
      setLoading(false)
    }
  }

  function startEdit(r: Redirect) {
    setEditingId(r.id)
    setForm({ from: r.from, to: r.to, statusCode: r.statusCode, note: r.note })
    setFormError(null)
    setCollapseNotice(null)
    setConfirmDeleteId(null)
    // Scroll to form
    document.getElementById('redirect-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setCollapseNotice(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.from || !form.to) return
    setSaving(true)
    setFormError(null)
    setCollapseNotice(null)

    try {
      const result = editingId
        ? await updateRedirect(editingId, { from: form.from, to: form.to, statusCode: form.statusCode, note: form.note })
        : await addRedirect({ from: form.from, to: form.to, statusCode: form.statusCode, note: form.note, createdBy: userEmail })

      if (!result.ok) {
        setFormError(result.error.message)
        return
      }

      if (result.collapsed) setCollapseNotice(result.collapsed)

      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await load()
    } catch {
      setFormError('Failed to save redirect — check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setDeleting(true)
    try {
      await deleteRedirect(id)
      setConfirmDeleteId(null)
      await load()
    } catch {
      setFormError('Failed to delete redirect.')
    } finally {
      setDeleting(false)
    }
  }

  const fromHint = pathHint(form.from)
  const toHint = pathHint(form.to)
  const isValid = form.from.length > 0 && form.to.length > 0 && !fromHint && !toHint && form.from !== form.to

  return (
    <div className="p-8 min-h-screen">

      {/* Breadcrumb + header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/admin/seo"
            className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 hover:text-[#2d6a4f] transition-colors"
          >
            SEO Dashboard
          </Link>
          <span className="text-gray-300 text-xs">›</span>
          <span className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-500">Redirect Manager</span>
        </div>
        <h1 className="font-display italic text-3xl text-[#000000]">Redirect Manager</h1>
        <p className="font-sans text-sm text-gray-500 mt-1">
          301/302 redirects served by the platform middleware — no deploy required.
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex gap-6 mb-8 font-sans text-sm text-gray-600">
        <span>
          <span className="font-semibold text-gray-900 tabular-nums">{redirects.length}</span> redirect{redirects.length !== 1 ? 's' : ''} active
        </span>
        <span className="text-gray-300">|</span>
        <span>
          <span className="font-semibold tabular-nums">{redirects.filter(r => r.statusCode === 301).length}</span> permanent (301)
        </span>
        <span>
          <span className="font-semibold tabular-nums">{redirects.filter(r => r.statusCode === 302).length}</span> temporary (302)
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* ── ADD / EDIT FORM ──────────────────────────────────────────────── */}
        <aside className="w-full lg:w-96 shrink-0">
          <div id="redirect-form" className="bg-white border border-gray-200 p-6">
            <h2 className="font-display italic text-xl mb-1">
              {editingId ? 'Edit Redirect' : 'Add Redirect'}
            </h2>
            {!editingId && (
              <p className="font-sans text-xs text-gray-400 mb-5">
                Chains are collapsed automatically. Loops are rejected.
              </p>
            )}
            {editingId && (
              <p className="font-sans text-xs text-gray-400 mb-5">
                Editing an existing redirect.{' '}
                <button onClick={cancelEdit} className="underline text-gray-500 hover:text-[#2d6a4f]">Cancel</button>
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>From path</label>
                <input
                  value={form.from}
                  onChange={e => setForm(f => ({ ...f, from: e.target.value.trim() }))}
                  placeholder="/old-page-slug"
                  className={inputCls}
                  autoComplete="off"
                  spellCheck={false}
                />
                {fromHint && (
                  <p className="font-sans text-[11px] text-amber-600 mt-1">{fromHint}</p>
                )}
              </div>

              <div className="flex items-center justify-center text-gray-300">
                <ArrowRight size={16} />
              </div>

              <div>
                <label className={labelCls}>To path or URL</label>
                <input
                  value={form.to}
                  onChange={e => setForm(f => ({ ...f, to: e.target.value.trim() }))}
                  placeholder="/new-page-slug"
                  className={inputCls}
                  autoComplete="off"
                  spellCheck={false}
                />
                {toHint && (
                  <p className="font-sans text-[11px] text-amber-600 mt-1">{toHint}</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Status code</label>
                <div className="flex gap-3">
                  {([301, 302] as const).map(code => (
                    <label key={code} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="statusCode"
                        value={code}
                        checked={form.statusCode === code}
                        onChange={() => setForm(f => ({ ...f, statusCode: code }))}
                        className="accent-[#2d6a4f]"
                      />
                      <span className="font-sans text-sm text-gray-700">
                        {code} {code === 301 ? '— Permanent' : '— Temporary'}
                      </span>
                    </label>
                  ))}
                </div>
                {form.statusCode === 302 && (
                  <p className="font-sans text-[11px] text-amber-600 mt-1.5">
                    302s are not cached by browsers or crawlers. Use 301 unless the old URL will return.
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>Note (optional)</label>
                <input
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. slug rename Jan 2025"
                  className={inputCls}
                />
              </div>

              {formError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 text-red-700 font-sans text-sm">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}

              {collapseNotice && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 text-amber-800 font-sans text-xs">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Chain collapsed: <code className="font-mono">{collapseNotice.original}</code> already redirects
                    to <code className="font-mono">{collapseNotice.resolved}</code>. Saved as a direct redirect to avoid a chain.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={saving || !isValid}
                className={`w-full py-2.5 font-sans text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2 ${
                  savedFlash
                    ? 'bg-[#2d6a4f] text-white'
                    : 'bg-[#C9A96E] text-[#1a1a1a] hover:bg-[#b8935e]'
                }`}
              >
                {saving
                  ? <Loader2 size={15} className="animate-spin" />
                  : savedFlash
                  ? <CheckCircle size={15} />
                  : <Plus size={15} />}
                {saving ? 'Saving…' : savedFlash ? 'Saved' : editingId ? 'Update Redirect' : 'Add Redirect'}
              </button>
            </form>

            {/* Info panel */}
            <div className="mt-6 pt-5 border-t border-gray-100 space-y-2">
              <p className={labelCls}>How it works</p>
              <p className="font-sans text-xs text-gray-500 leading-relaxed">
                Redirects are matched by exact path and served by the Next.js middleware before any page renders.
                No deploy needed — changes take effect within seconds.
              </p>
              <p className="font-sans text-xs text-gray-500 leading-relaxed">
                <strong className="text-gray-700">Chain collapse:</strong> if <code className="font-mono text-[11px]">B→C</code> exists
                and you add <code className="font-mono text-[11px]">A→B</code>, the system writes <code className="font-mono text-[11px]">A→C</code> directly.
              </p>
              <p className="font-sans text-xs text-gray-500 leading-relaxed">
                <strong className="text-gray-700">Loop protection:</strong> any redirect that would eventually resolve back to its own source is rejected.
              </p>
            </div>
          </div>
        </aside>

        {/* ── REDIRECT LIST ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center gap-3 text-gray-400 font-sans text-sm py-12">
              <Loader2 size={16} className="animate-spin" /> Loading redirects…
            </div>
          ) : redirects.length === 0 ? (
            <div className="bg-white border border-gray-200 flex items-center justify-center py-16 px-8 text-center">
              <div>
                <ArrowRight size={28} className="text-gray-200 mx-auto mb-3" />
                <p className="font-sans text-sm text-gray-400">No redirects yet.</p>
                <p className="font-sans text-xs text-gray-300 mt-1">Add one using the form to get started.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-gray-100 bg-[#F7F5F2]">
                <p className={`${labelCls} mb-0`}>From</p>
                <p className={`${labelCls} mb-0`}>To</p>
                <p className={`${labelCls} mb-0`}>Code</p>
                <p className={`${labelCls} mb-0`}>Created</p>
                <p className={`${labelCls} mb-0`} />
              </div>

              {redirects.map(r => (
                <div
                  key={r.id}
                  className={`grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 items-center px-5 py-4 border-b border-gray-100 last:border-0 transition-colors ${
                    editingId === r.id ? 'bg-[#2d6a4f]/5' : 'hover:bg-[#F7F5F2]'
                  }`}
                >
                  {/* From */}
                  <div className="min-w-0">
                    <code className="font-mono text-xs text-gray-700 block truncate">{r.from}</code>
                    {r.note && (
                      <span className="font-sans text-[10px] text-gray-400 block mt-0.5 truncate">{r.note}</span>
                    )}
                  </div>

                  {/* To */}
                  <div className="min-w-0 flex items-center gap-1.5">
                    <ArrowRight size={12} className="text-gray-300 shrink-0" />
                    {r.to.startsWith('http') ? (
                      <a
                        href={r.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-[#2d6a4f] hover:underline truncate flex items-center gap-1"
                      >
                        {r.to} <ExternalLink size={10} className="shrink-0" />
                      </a>
                    ) : (
                      <code className="font-mono text-xs text-gray-700 block truncate">{r.to}</code>
                    )}
                  </div>

                  {/* Status code */}
                  <div>
                    <span className={`font-sans text-[10px] font-semibold px-2 py-0.5 tabular-nums ${
                      r.statusCode === 301
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {r.statusCode}
                    </span>
                  </div>

                  {/* Created */}
                  <div>
                    <span className="font-sans text-[11px] text-gray-400 whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </span>
                    {r.hitCount > 0 && (
                      <span className="font-sans text-[10px] text-gray-400 block tabular-nums">
                        {r.hitCount.toLocaleString()} hit{r.hitCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => editingId === r.id ? cancelEdit() : startEdit(r)}
                      className="p-1.5 text-gray-400 hover:text-[#2d6a4f] transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deleting && confirmDeleteId === r.id}
                      className={`p-1.5 transition-colors ${
                        confirmDeleteId === r.id
                          ? 'text-red-600 bg-red-50'
                          : 'text-gray-400 hover:text-red-500'
                      }`}
                      title={confirmDeleteId === r.id ? 'Click again to confirm' : 'Delete'}
                    >
                      {deleting && confirmDeleteId === r.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dismiss confirm-delete on click outside */}
          {confirmDeleteId && (
            <p className="font-sans text-xs text-red-500 mt-2 flex items-center gap-1.5">
              <AlertTriangle size={12} />
              Click the bin icon again to confirm deletion of this redirect.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

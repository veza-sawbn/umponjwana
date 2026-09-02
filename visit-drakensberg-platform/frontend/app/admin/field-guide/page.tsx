'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, X, Loader2, ExternalLink, Pencil, Trash2, Feather } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { slugify, uniqueSlug } from '@/lib/slugify'
import {
  listFieldGuidePages,
  createFieldGuidePage,
  deleteFieldGuidePage,
  publishFieldGuidePage,
  unpublishFieldGuidePage,
  type FieldGuidePage,
} from '@/lib/field-guide'

// Access is enforced in three independent places and this page is none of
// them: middleware routes non-staff away from /admin, and RLS on
// vd_field_guide_* admits is_admin() only. If a non-admin ever reaches this
// URL, every query below returns nothing rather than someone else's drafts.

const STATUS_STYLE: Record<string, string> = {
  published: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  draft: 'bg-gray-100 text-gray-500',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminFieldGuideListPage() {
  const router = useRouter()
  const [pages, setPages] = useState<FieldGuidePage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listFieldGuidePages(supabase)
      .then(rows => { if (!cancelled) setPages(rows) })
      .catch(err => { if (!cancelled) setError(String(err?.message || err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleCreate() {
    if (!title.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const slug = uniqueSlug(slugify(title), pages.map(p => p.slug))
      const created = await createFieldGuidePage({ slug, title: title.trim() }, supabase)
      router.push(`/admin/field-guide/${created.id}`)
    } catch (err: any) {
      setError(err?.message || 'Could not create the guide.')
      setSaving(false)
    }
  }

  async function togglePublish(page: FieldGuidePage) {
    setError(null)
    try {
      if (page.status === 'published') {
        await unpublishFieldGuidePage(page.id, page.slug, supabase)
        setPages(p => p.map(x => x.id === page.id ? { ...x, status: 'draft' } : x))
      } else {
        await publishFieldGuidePage(page.id, page.slug, supabase)
        const now = new Date().toISOString()
        setPages(p => p.map(x => x.id === page.id ? { ...x, status: 'published', published_at: now } : x))
      }
    } catch (err: any) {
      setError(err?.message || 'Could not change the publication status.')
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await deleteFieldGuidePage(id, supabase)
      setPages(p => p.filter(x => x.id !== id))
      setConfirmDelete(null)
    } catch (err: any) {
      setError(err?.message || 'Could not delete the guide.')
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Layered Field Guide</h1>
          <p className="font-sans text-xs text-gray-400 mt-1.5 max-w-xl leading-relaxed">
            Illustrated natural-history pages built from independently positioned layers. Each specimen is a
            pinned chapter whose artwork assembles itself as the visitor scrolls.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="shrink-0 inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors"
        >
          {showCreate ? <X size={15} /> : <Plus size={15} />}
          {showCreate ? 'Cancel' : 'New Guide'}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 font-sans text-sm">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="bg-white border border-gray-200 p-6 mb-8 max-w-xl">
          <h2 className="font-display italic text-xl mb-4">New Layered Guide</h2>
          <label htmlFor="fg-new-title" className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">
            Page title
          </label>
          <input
            id="fg-new-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="A Field Guide to the Drakensberg"
            className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm bg-[#F7F5F2] focus:outline-none focus:border-[#2d6a4f]"
          />
          <p className="font-sans text-xs text-gray-400 mt-2">
            The slug, background and SEO fields are set in the editor. New guides start as drafts.
          </p>
          <button
            onClick={handleCreate}
            disabled={saving || !title.trim()}
            className="mt-5 inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Create Draft
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
      ) : pages.length === 0 ? (
        <div className="bg-white border border-gray-200 py-20 text-center">
          <Feather className="w-7 h-7 text-gray-200 mx-auto mb-3" />
          <p className="font-sans text-sm text-gray-400">No layered guides yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100">
                {['Guide', 'Slug', 'Status', 'Last published', ''].map((h, i) => (
                  <th key={i} className="text-left font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 px-5 py-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pages.map(page => (
                <tr key={page.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-4">
                    <Link href={`/admin/field-guide/${page.id}`} className="font-sans text-sm text-gray-800 hover:text-[#2d6a4f] transition-colors">
                      {page.title}
                    </Link>
                  </td>
                  <td className="px-5 py-4 font-sans text-xs text-gray-400">/field-guide/{page.slug}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-block font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STATUS_STYLE[page.status]}`}>
                      {page.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-sans text-xs text-gray-400">{formatDate(page.published_at)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => togglePublish(page)}
                        className="font-sans text-xs px-3 py-1.5 border border-gray-200 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
                      >
                        {page.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      {page.status === 'published' && (
                        <a
                          href={`/field-guide/${page.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          title="View live page"
                          className="p-2 text-gray-400 hover:text-[#2d6a4f] transition-colors"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <Link href={`/admin/field-guide/${page.id}`} title="Edit" className="p-2 text-gray-400 hover:text-[#2d6a4f] transition-colors">
                        <Pencil size={14} />
                      </Link>
                      <button onClick={() => setConfirmDelete(page.id)} title="Delete" className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[1100] bg-black/60 flex items-center justify-center p-6" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-display italic text-xl mb-2">Delete this guide?</h2>
            <p className="font-sans text-sm text-gray-500 leading-relaxed mb-5">
              Every specimen chapter and layer in it goes too. The image files themselves stay in the Media
              Library. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)} className="bg-red-500 text-white px-5 py-2.5 font-sans text-sm hover:bg-red-600 transition-colors">
                Delete guide
              </button>
              <button onClick={() => setConfirmDelete(null)} className="border border-gray-200 text-gray-600 px-5 py-2.5 font-sans text-sm hover:bg-[#F7F5F2] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

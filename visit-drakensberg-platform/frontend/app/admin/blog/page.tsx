'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Eye, Trash2, X, CheckCircle, Loader2 } from 'lucide-react'
import { adminMediaSource } from '@/lib/admin-supabase'
import { MediaPicker } from '@/components/media/MediaPicker'
import { supabase } from '@/lib/auth'
import { getAllPostsAdmin, upsertPost, setPostStatus, deletePost } from '@/lib/blog-posts'
import type { BlogPost } from '@/lib/blog-posts'

const CATEGORIES = ['Culture', 'Heritage', 'Wildlife', 'Cuisine', 'History', 'Hiking Stories', 'Conservation', 'Photography']

type Post = {
  id: string
  title: string
  slug: string
  category: string
  featured_image: string
  excerpt: string
  body: string
  author_name: string
  author_role: string
  author_bio: string
  seo_title: string
  seo_description: string
  status: string
  published_at: string | null
}

function dbToPost(row: BlogPost): Post {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category ?? 'Culture',
    featured_image: row.featured_image ?? '',
    excerpt: row.excerpt ?? '',
    body: row.body ?? '',
    author_name: row.author_name ?? '',
    author_role: row.author_role ?? '',
    author_bio: row.author_bio ?? '',
    seo_title: row.seo_title ?? '',
    seo_description: row.seo_description ?? '',
    status: row.status,
    published_at: row.published_at,
  }
}

const BLANK_NEW = {
  title: '', slug: '', category: 'Culture', excerpt: '', body: '',
  featured_image: '', author_name: '', author_role: '', author_bio: '',
  seo_title: '', seo_description: '',
}

const STATUS_STYLE: Record<string, string> = {
  published: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  draft: 'bg-gray-100 text-gray-500',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newPost, setNewPost] = useState(BLANK_NEW)
  const [saving, setSaving] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getAllPostsAdmin(supabase)
      .then(rows => { if (!cancelled) setPosts(rows.map(dbToPost)) })
      .catch(err => { if (!cancelled) setError(String(err?.message || err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleCreate() {
    if (!newPost.title || saving) return
    setSaving(true)
    setError(null)
    try {
      const row = await upsertPost({ ...newPost, status: 'draft' }, supabase)
      setPosts(p => [dbToPost(row), ...p])
      setNewPost(BLANK_NEW)
      setShowCreate(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to create post')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit() {
    if (!editingPost || saving) return
    setSaving(true)
    setError(null)
    try {
      const row = await upsertPost(editingPost, supabase)
      setPosts(p => p.map(post => post.id === row.id ? dbToPost(row) : post))
      setEditingPost(null)
    } catch (err: any) {
      setError(err?.message || 'Failed to save post')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish(id: string) {
    setError(null)
    try {
      await setPostStatus(id, 'published', supabase)
      setPosts(p => p.map(post => post.id === id
        ? { ...post, status: 'published', published_at: new Date().toISOString() }
        : post))
    } catch (err: any) {
      setError(err?.message || 'Failed to publish post')
    }
  }

  async function handleUnpublish(id: string) {
    setError(null)
    try {
      await setPostStatus(id, 'draft', supabase)
      setPosts(p => p.map(post => post.id === id ? { ...post, status: 'draft' } : post))
    } catch (err: any) {
      setError(err?.message || 'Failed to unpublish post')
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await deletePost(id, supabase)
      if (editingPost?.id === id) setEditingPost(null)
      setPosts(p => p.filter(post => post.id !== id))
    } catch (err: any) {
      setError(err?.message || 'Failed to delete post')
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Blog & Content</h1>
        </div>
        <button
          onClick={() => { setShowCreate(v => !v); setEditingPost(null) }}
          className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors"
        >
          {showCreate ? <X size={15} /> : <Plus size={15} />}
          {showCreate ? 'Cancel' : 'New Post'}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 font-sans text-sm">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border border-gray-200 p-6 mb-8">
          <h2 className="font-display italic text-xl mb-5">New Blog Post</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Title *</label>
              <input
                value={newPost.title}
                onChange={e => setNewPost(p => ({ ...p, title: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }))}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                placeholder="Article title"
              />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Slug</label>
              <input
                value={newPost.slug}
                onChange={e => setNewPost(p => ({ ...p, slug: e.target.value }))}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                placeholder="article-slug"
              />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Category</label>
              <select
                value={newPost.category}
                onChange={e => setNewPost(p => ({ ...p, category: e.target.value }))}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Featured Image</label>
              <MediaPicker value={newPost.featured_image} onChange={url => setNewPost(p => ({ ...p, featured_image: url }))} source={adminMediaSource} />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Author Name</label>
              <input
                value={newPost.author_name}
                onChange={e => setNewPost(p => ({ ...p, author_name: e.target.value }))}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                placeholder="e.g. Sipho Dlamini"
              />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Author Role</label>
              <input
                value={newPost.author_role}
                onChange={e => setNewPost(p => ({ ...p, author_role: e.target.value }))}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                placeholder="e.g. FGASA Mountain Guide"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Excerpt</label>
            <textarea
              value={newPost.excerpt}
              onChange={e => setNewPost(p => ({ ...p, excerpt: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none bg-[#F7F5F2]"
              placeholder="Short description shown in article cards"
            />
          </div>
          <div className="mb-4">
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">
              Article Body <span className="text-gray-300 font-normal normal-case tracking-normal">— markdown supported: ## Heading</span>
            </label>
            <textarea
              value={newPost.body}
              onChange={e => setNewPost(p => ({ ...p, body: e.target.value }))}
              rows={8}
              className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none bg-[#F7F5F2]"
              placeholder="## First Heading&#10;&#10;Paragraph text here…&#10;&#10;## Second Heading&#10;&#10;More text…"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">SEO Title</label>
              <input
                value={newPost.seo_title}
                onChange={e => setNewPost(p => ({ ...p, seo_title: e.target.value }))}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                placeholder="Overrides title in search results"
              />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">SEO Description</label>
              <input
                value={newPost.seo_description}
                onChange={e => setNewPost(p => ({ ...p, seo_description: e.target.value }))}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                placeholder="Overrides excerpt in search results"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Save as Draft
            </button>
            <button onClick={() => setShowCreate(false)} className="border border-gray-200 text-gray-600 px-6 py-2.5 font-sans text-sm hover:bg-[#F7F5F2] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Edit panel */}
      {editingPost && (
        <div className="bg-white border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display italic text-xl">Edit Post</h2>
            <button onClick={() => setEditingPost(null)} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Title *</label>
              <input
                value={editingPost.title}
                onChange={e => setEditingPost(p => p ? { ...p, title: e.target.value } : p)}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Slug</label>
              <input
                value={editingPost.slug}
                onChange={e => setEditingPost(p => p ? { ...p, slug: e.target.value } : p)}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Category</label>
              <select
                value={editingPost.category}
                onChange={e => setEditingPost(p => p ? { ...p, category: e.target.value } : p)}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Featured Image</label>
              <MediaPicker value={editingPost.featured_image} onChange={url => setEditingPost(p => p ? { ...p, featured_image: url } : p)} source={adminMediaSource} />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Author Name</label>
              <input
                value={editingPost.author_name}
                onChange={e => setEditingPost(p => p ? { ...p, author_name: e.target.value } : p)}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Author Role</label>
              <input
                value={editingPost.author_role}
                onChange={e => setEditingPost(p => p ? { ...p, author_role: e.target.value } : p)}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Excerpt</label>
            <textarea
              value={editingPost.excerpt}
              onChange={e => setEditingPost(p => p ? { ...p, excerpt: e.target.value } : p)}
              rows={2}
              className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none bg-[#F7F5F2]"
            />
          </div>
          <div className="mb-4">
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">
              Article Body <span className="text-gray-300 font-normal normal-case tracking-normal">— markdown: ## Heading</span>
            </label>
            <textarea
              value={editingPost.body}
              onChange={e => setEditingPost(p => p ? { ...p, body: e.target.value } : p)}
              rows={8}
              className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none bg-[#F7F5F2]"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">SEO Title</label>
              <input
                value={editingPost.seo_title}
                onChange={e => setEditingPost(p => p ? { ...p, seo_title: e.target.value } : p)}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                placeholder="Overrides title in search results"
              />
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">SEO Description</label>
              <input
                value={editingPost.seo_description}
                onChange={e => setEditingPost(p => p ? { ...p, seo_description: e.target.value } : p)}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                placeholder="Overrides excerpt in search results"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Save Changes
            </button>
            <button onClick={() => setEditingPost(null)} className="border border-gray-200 text-gray-600 px-6 py-2.5 font-sans text-sm hover:bg-[#F7F5F2] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Posts table */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400 font-sans text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading posts…
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Title', 'Category', 'Author', 'Status', 'Published', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center font-sans text-sm text-gray-400">
                    No posts yet. Click <strong>New Post</strong> to create one.
                  </td>
                </tr>
              ) : posts.map(post => (
                <tr key={post.id} className={`transition-colors ${editingPost?.id === post.id ? 'bg-[#C9A96E]/5' : 'hover:bg-[#F7F5F2]'}`}>
                  <td className="px-5 py-4">
                    <p className="font-sans text-sm font-medium">{post.title}</p>
                    <p className="font-sans text-xs text-gray-400 font-mono">{post.slug}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-sans text-xs bg-[#F7F5F2] px-2 py-1 text-gray-600">{post.category}</span>
                  </td>
                  <td className="px-5 py-4 font-sans text-sm text-gray-600">{post.author_name || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STATUS_STYLE[post.status] ?? 'bg-gray-100 text-gray-500'}`}>{post.status}</span>
                  </td>
                  <td className="px-5 py-4 font-sans text-xs text-gray-400">{formatDate(post.published_at)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        title="Edit"
                        onClick={() => { setEditingPost(post); setShowCreate(false) }}
                        className="p-1.5 text-gray-400 hover:text-[#2d6a4f] transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      {post.status === 'published' && (
                        <>
                          <Link href={`/mydrakensberg/${post.slug}`} target="_blank" title="View" className="p-1.5 text-gray-400 hover:text-[#2d6a4f] transition-colors inline-flex">
                            <Eye size={14} />
                          </Link>
                          <button onClick={() => handleUnpublish(post.id)} className="px-2.5 py-1 border border-gray-200 text-gray-500 font-sans text-xs hover:bg-[#F7F5F2] transition-colors">
                            Unpublish
                          </button>
                        </>
                      )}
                      {post.status === 'draft' && (
                        <button onClick={() => handlePublish(post.id)} className="px-2.5 py-1 bg-[#2d6a4f] text-white font-sans text-xs hover:bg-[#235a3f] transition-colors flex items-center gap-1">
                          <CheckCircle size={11} /> Publish
                        </button>
                      )}
                      <button onClick={() => handleDelete(post.id)} title="Delete" className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}

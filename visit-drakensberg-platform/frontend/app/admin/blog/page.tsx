'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Eye, Trash2, X, CheckCircle } from 'lucide-react'
import { adminMediaSource } from '@/lib/admin-supabase'
import { MediaPicker } from '@/components/media/MediaPicker'

const CATEGORIES = ['Culture', 'Heritage', 'Wildlife', 'Cuisine', 'History', 'Hiking Stories', 'Conservation', 'Photography']

type Post = {
  id: string
  title: string
  slug: string
  category: string
  featured_image: string
  excerpt: string
  body: string
  author: string
  status: string
  published: string | null
  views: number
}

const INITIAL_POSTS: Post[] = [
  { id: 'p1', title: 'The Ancient Art of the San Bushmen', slug: 'san-bushmen-rock-art', category: 'Heritage', featured_image: '', excerpt: '', body: '', author: 'Lerato Sithole', status: 'published', published: '10 Jun 2026', views: 1240 },
  { id: 'p2', title: "Climbing the Chain Ladder: A First-Timer's Guide", slug: 'chain-ladder-guide', category: 'Hiking Stories', featured_image: '', excerpt: '', body: '', author: 'Sipho Dlamini', status: 'published', published: '5 Jun 2026', views: 2180 },
  { id: 'p3', title: "The Bearded Vulture: Drakensberg's Rarest Resident", slug: 'bearded-vulture-drakensberg', category: 'Wildlife', featured_image: '', excerpt: '', body: '', author: 'Anele Mokoena', status: 'published', published: '28 May 2026', views: 890 },
  { id: 'p4', title: 'Hidden Waterfalls of Champagne Valley', slug: 'champagne-valley-waterfalls', category: 'Hiking Stories', featured_image: '', excerpt: '', body: '', author: 'Thabo Ndlovu', status: 'draft', published: null, views: 0 },
  { id: 'p5', title: 'A Week in the Southern Drakensberg', slug: 'southern-berg-itinerary', category: 'Culture', featured_image: '', excerpt: '', body: '', author: 'Admin', status: 'draft', published: null, views: 0 },
]

const STATUS_STYLE: Record<string, string> = {
  published: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  draft: 'bg-gray-100 text-gray-500',
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS)
  const [showCreate, setShowCreate] = useState(false)
  const [newPost, setNewPost] = useState({ title: '', slug: '', category: 'Culture', excerpt: '', body: '', featured_image: '' })
  const [editingPost, setEditingPost] = useState<Post | null>(null)

  function handleCreate() {
    if (!newPost.title) return
    setPosts(p => [...p, {
      id: `p${Date.now()}`,
      ...newPost,
      author: 'Admin',
      status: 'draft',
      published: null,
      views: 0,
    }])
    setNewPost({ title: '', slug: '', category: 'Culture', excerpt: '', body: '', featured_image: '' })
    setShowCreate(false)
  }

  function handleSaveEdit() {
    if (!editingPost) return
    setPosts(p => p.map(post => post.id === editingPost.id ? editingPost : post))
    setEditingPost(null)
  }

  function publish(id: string) {
    setPosts(p => p.map(post => post.id === id ? { ...post, status: 'published', published: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) } : post))
  }

  function remove(id: string) {
    if (editingPost?.id === id) setEditingPost(null)
    setPosts(p => p.filter(post => post.id !== id))
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
          <div className="mb-5">
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Article Body</label>
            <textarea
              value={newPost.body}
              onChange={e => setNewPost(p => ({ ...p, body: e.target.value }))}
              rows={8}
              className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none bg-[#F7F5F2]"
              placeholder="Full article content…"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">Save as Draft</button>
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
          <div className="mb-5">
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Article Body</label>
            <textarea
              value={editingPost.body}
              onChange={e => setEditingPost(p => p ? { ...p, body: e.target.value } : p)}
              rows={8}
              className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none bg-[#F7F5F2]"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSaveEdit} className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">Save Changes</button>
            <button onClick={() => setEditingPost(null)} className="border border-gray-200 text-gray-600 px-6 py-2.5 font-sans text-sm hover:bg-[#F7F5F2] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Posts table */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {['Title', 'Category', 'Author', 'Status', 'Published', 'Views', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {posts.map(post => (
              <tr key={post.id} className={`transition-colors ${editingPost?.id === post.id ? 'bg-[#C9A96E]/5' : 'hover:bg-[#F7F5F2]'}`}>
                <td className="px-5 py-4">
                  <p className="font-sans text-sm font-medium">{post.title}</p>
                  <p className="font-sans text-xs text-gray-400 font-mono">{post.slug}</p>
                </td>
                <td className="px-5 py-4">
                  <span className="font-sans text-xs bg-[#F7F5F2] px-2 py-1 text-gray-600">{post.category}</span>
                </td>
                <td className="px-5 py-4 font-sans text-sm text-gray-600">{post.author}</td>
                <td className="px-5 py-4">
                  <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${STATUS_STYLE[post.status]}`}>{post.status}</span>
                </td>
                <td className="px-5 py-4 font-sans text-xs text-gray-400">{post.published || '—'}</td>
                <td className="px-5 py-4 font-sans text-sm text-gray-600">{post.views > 0 ? post.views.toLocaleString() : '—'}</td>
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
                      <Link href={`/mydrakensberg/${post.slug}`} target="_blank" title="View" className="p-1.5 text-gray-400 hover:text-[#2d6a4f] transition-colors inline-flex">
                        <Eye size={14} />
                      </Link>
                    )}
                    {post.status === 'draft' && (
                      <button onClick={() => publish(post.id)} className="px-2.5 py-1 bg-[#2d6a4f] text-white font-sans text-xs hover:bg-[#235a3f] transition-colors flex items-center gap-1">
                        <CheckCircle size={11} /> Publish
                      </button>
                    )}
                    <button onClick={() => remove(post.id)} title="Delete" className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

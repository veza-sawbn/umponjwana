'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Plus, Trash2, Package, Users, Calendar, Eye, EyeOff, UserPlus } from 'lucide-react'

interface TourPackage {
  id: string
  title: string
  description: string
  price: number
  duration_days: number
  includes: string[]
  tour_start: string
  tour_end: string
  max_participants: number
  is_published: boolean
  collaborators: string[]
  created_by: string
}

import { supabase } from '@/lib/auth'
import {
  getSupplierEntities, addSupplierEntity, updateSupplierEntity, deleteSupplierEntity,
} from '@/lib/supplier-entities'

const ENTITY = 'packages'

export default function PackagesPage() {
  const [packages, setPackages] = useState<TourPackage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) setPackages(await getSupplierEntities<any>(ENTITY, user.id) as unknown as TourPackage[])
      setLoading(false)
    })
  }, [])
  const [showForm, setShowForm] = useState(false)
  const [collabInput, setCollabInput] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    duration_days: '',
    includes: '',
    tour_start: '',
    tour_end: '',
    max_participants: '',
  })

  async function handleCreate() {
    if (!form.title || !form.price) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('no session')
      const saved = await addSupplierEntity<any>(ENTITY, {
        supplierId: user.id,
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        duration_days: parseInt(form.duration_days) || 0,
        includes: form.includes.split(',').map(s => s.trim()).filter(Boolean),
        tour_start: form.tour_start,
        tour_end: form.tour_end,
        max_participants: parseInt(form.max_participants) || 0,
        is_published: false,
        collaborators: [],
        created_by: user.id,
        status: 'draft',
      })
      setPackages(prev => [...prev, saved as unknown as TourPackage])
      setForm({ title: '', description: '', price: '', duration_days: '', includes: '', tour_start: '', tour_end: '', max_participants: '' })
      setShowForm(false)
      toast.success('Package created.')
    } catch {
      toast.error('Could not create the package. Please try again.')
    }
  }

  async function togglePublish(id: string) {
    const pkg = packages.find(p => p.id === id)
    if (!pkg) return
    const is_published = !pkg.is_published
    try {
      await updateSupplierEntity(ENTITY, id, { is_published, status: is_published ? 'active' : 'draft' })
      setPackages(prev => prev.map(p => p.id === id ? { ...p, is_published } : p))
    } catch {
      toast.error('Could not update the package.')
    }
  }

  async function addCollaborator(id: string) {
    const name = collabInput[id]?.trim()
    if (!name) return
    const pkg = packages.find(p => p.id === id)
    if (!pkg || pkg.collaborators.includes(name)) return
    const collaborators = [...pkg.collaborators, name]
    try {
      await updateSupplierEntity(ENTITY, id, { collaborators })
      setPackages(prev => prev.map(p => p.id === id ? { ...p, collaborators } : p))
      setCollabInput(prev => ({ ...prev, [id]: '' }))
    } catch {
      toast.error('Could not add the collaborator.')
    }
  }

  async function handleDelete(id: string) {
    const prev = packages
    setPackages(ps => ps.filter(p => p.id !== id))
    try {
      await deleteSupplierEntity(ENTITY, id)
    } catch {
      setPackages(prev)
      toast.error('Could not delete the package.')
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#2d6a4f] text-white py-16 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/supplier" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h1 className="font-display italic text-4xl lg:text-5xl">Tour Packages</h1>
          <p className="mt-3 text-white/70 font-sans text-lg">
            Create multi-day packages, set tour dates, and collaborate with other suppliers.
          </p>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="flex items-center justify-between mb-8">
          <p className="font-sans text-gray-600">{packages.length} package{packages.length !== 1 ? 's' : ''}</p>
          <button
            onClick={() => setShowForm(v => !v)}
            className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm font-medium hover:bg-[#235a3f] transition-colors"
          >
            <Plus size={16} /> Create Package
          </button>
        </div>

        {showForm && (
          <div className="bg-white border border-gray-200 p-8 mb-8">
            <h2 className="font-display italic text-2xl text-[#2d6a4f] mb-6">New Package</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Package Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="e.g. Drakensberg Highlands Explorer"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Price per Person (R) *</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="8500"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Duration (days)</label>
                <input
                  type="number"
                  value={form.duration_days}
                  onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="7"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Tour Start Date</label>
                <input
                  type="date"
                  value={form.tour_start}
                  onChange={e => setForm(f => ({ ...f, tour_start: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Tour End Date</label>
                <input
                  type="date"
                  value={form.tour_end}
                  onChange={e => setForm(f => ({ ...f, tour_end: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Max Participants</label>
                <input
                  type="number"
                  value={form.max_participants}
                  onChange={e => setForm(f => ({ ...f, max_participants: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="12"
                />
              </div>
              <div>
                <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">What's Included (comma-separated)</label>
                <input
                  value={form.includes}
                  onChange={e => setForm(f => ({ ...f, includes: e.target.value }))}
                  className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                  placeholder="Accommodation, Meals, Guide, Transport"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleCreate} className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm font-medium hover:bg-[#235a3f] transition-colors">
                Create Package
              </button>
              <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-6 py-2.5 font-sans text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {packages.map(pkg => (
            <div key={pkg.id} className="bg-white border border-gray-200">
              <div className="p-6 lg:p-8">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-display italic text-2xl text-[#000000]">{pkg.title}</h3>
                      <span className={`font-sans text-xs px-2.5 py-1 ${pkg.is_published ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]' : 'bg-gray-100 text-gray-500'}`}>
                        {pkg.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p className="font-sans text-gray-600 text-sm">{pkg.description}</p>
                  </div>
                  <div className="text-right ml-6">
                    <p className="font-display italic text-2xl text-[#2d6a4f]">R {pkg.price.toLocaleString()}</p>
                    <p className="font-sans text-xs text-gray-400">per person</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 py-4 border-y border-gray-100">
                  <div>
                    <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">Duration</p>
                    <p className="font-sans text-sm font-medium">{pkg.duration_days} days</p>
                  </div>
                  <div>
                    <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">Max Guests</p>
                    <p className="font-sans text-sm font-medium">{pkg.max_participants}</p>
                  </div>
                  {pkg.tour_start && (
                    <div>
                      <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">Departs</p>
                      <p className="font-sans text-sm font-medium">{new Date(pkg.tour_start).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  )}
                  {pkg.tour_end && (
                    <div>
                      <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">Returns</p>
                      <p className="font-sans text-sm font-medium">{new Date(pkg.tour_end).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  )}
                </div>

                {pkg.includes.length > 0 && (
                  <div className="mb-6">
                    <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">What's Included</p>
                    <div className="flex flex-wrap gap-2">
                      {pkg.includes.map(item => (
                        <span key={item} className="bg-[#F7F5F2] px-3 py-1 font-sans text-xs text-gray-700">✓ {item}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">Collaborators</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {pkg.collaborators.length === 0 && (
                      <span className="font-sans text-xs text-gray-400 italic">No collaborators yet</span>
                    )}
                    {pkg.collaborators.map(c => (
                      <span key={c} className="bg-[#C9A96E]/10 text-[#2d6a4f] px-3 py-1 font-sans text-xs flex items-center gap-1.5">
                        <Users size={11} /> {c}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 max-w-sm">
                    <input
                      value={collabInput[pkg.id] || ''}
                      onChange={e => setCollabInput(prev => ({ ...prev, [pkg.id]: e.target.value }))}
                      placeholder="Supplier name or email"
                      className="flex-1 border border-gray-300 px-3 py-2 font-sans text-xs focus:outline-none focus:border-[#2d6a4f]"
                    />
                    <button
                      onClick={() => addCollaborator(pkg.id)}
                      className="bg-[#C9A96E] text-white px-3 py-2 font-sans text-xs hover:bg-[#b8935e] transition-colors"
                    >
                      <UserPlus size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => togglePublish(pkg.id)}
                    className="inline-flex items-center gap-2 border border-[#2d6a4f] text-[#2d6a4f] px-4 py-2 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors"
                  >
                    {pkg.is_published ? <><EyeOff size={14} /> Unpublish</> : <><Eye size={14} /> Publish</>}
                  </button>
                  <button
                    onClick={() => handleDelete(pkg.id)}
                    className="inline-flex items-center gap-2 text-red-500 hover:text-red-700 font-sans text-sm transition-colors ml-auto"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {packages.length === 0 && (
          <div className="text-center py-20 bg-white border border-gray-200">
            <Package size={40} className="text-gray-300 mx-auto mb-4" />
            <p className="font-display italic text-2xl text-gray-400 mb-2">No packages yet</p>
            <p className="font-sans text-gray-500 text-sm">Create a package to offer guests a complete guided experience.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

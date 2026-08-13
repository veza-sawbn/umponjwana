'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Search, RefreshCw, Building2, Check, X, AlertCircle, Mail,
  ChevronRight, ExternalLink, Save, ArrowUpRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/auth'

// ─── Types ─────────────────────────────────────────────────────────────────────

type SupplierRow = {
  id: string
  businessName: string
  email: string
  ownerContactEmail: string | null
  supplierType: string | null
  bio: string | null
  website: string | null
  isApproved: boolean
  isVdManaged: boolean
  createdAt: string
  lastSignIn: string | null
}

const SUPPLIER_TYPES = ['Accommodation', 'Activity', 'Guided Tours', 'Shuttle', 'Experience']

// ─── Helpers ───────────────────────────────────────────────────────────────────

function typeBadge(type: string | null) {
  if (!type) return <span className="text-gray-300 font-sans text-xs">—</span>
  const colors: Record<string, string> = {
    Accommodation: 'bg-blue-50 text-blue-700',
    Activity: 'bg-emerald-50 text-emerald-700',
    'Guided Tours': 'bg-amber-50 text-amber-700',
    Shuttle: 'bg-purple-50 text-purple-700',
    Experience: 'bg-rose-50 text-rose-700',
  }
  return (
    <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 ${colors[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {type}
    </span>
  )
}

function fmt(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Supplier Detail Panel ──────────────────────────────────────────────────────

function SupplierDetailPanel({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: SupplierRow
  onClose: () => void
  onSaved: () => void
}) {
  const [businessName, setBusinessName] = useState(supplier.businessName)
  const [supplierType, setSupplierType] = useState(supplier.supplierType ?? '')
  const [bio, setBio] = useState(supplier.bio ?? '')
  const [website, setWebsite] = useState(supplier.website ?? '')
  const [ownerContactEmail, setOwnerContactEmail] = useState(supplier.ownerContactEmail ?? '')
  const [isApproved, setIsApproved] = useState(supplier.isApproved)
  const [saving, setSaving] = useState(false)

  // Transfer state
  const [transferEmail, setTransferEmail] = useState(supplier.ownerContactEmail ?? '')
  const [transferring, setTransferring] = useState(false)
  const [transferred, setTransferred] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/supplier/${supplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim() || undefined,
          supplierType: supplierType || undefined,
          bio: bio || undefined,
          website: website.trim() || undefined,
          ownerContactEmail: ownerContactEmail.trim() || null,
          isApproved,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not save')
      toast.success('Profile saved.')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function transfer() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(transferEmail.trim())) {
      toast.error('Enter a valid owner email address.')
      return
    }
    if (!confirm(`Transfer this account to ${transferEmail.trim()}?\n\nThe supplier's login email will be updated and a setup link will be sent to the owner. This action cannot be undone easily.`)) return
    setTransferring(true)
    try {
      const res = await fetch(`/api/admin/supplier/${supplier.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerEmail: transferEmail.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not transfer account')
      toast.success(`Account transferred. Setup link sent to ${json.ownerEmail}.`)
      setTransferred(true)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed')
    } finally {
      setTransferring(false)
    }
  }

  const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'
  const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-lg bg-white shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Supplier Profile</p>
              {supplier.isVdManaged && (
                <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-[#C9A96E]/15 text-[#8B6914]">
                  VD Managed
                </span>
              )}
            </div>
            <h2 className="font-display italic text-2xl truncate">{supplier.businessName}</h2>
            <p className="font-sans text-xs text-gray-400 mt-0.5 truncate">{supplier.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-3 gap-3 text-xs font-sans border border-gray-100 divide-x divide-gray-100">
            <div className="px-3 py-2.5">
              <p className="text-gray-400 uppercase tracking-[0.1em] text-[10px] mb-0.5">Joined</p>
              <p className="text-gray-800">{fmt(supplier.createdAt)}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-gray-400 uppercase tracking-[0.1em] text-[10px] mb-0.5">Last sign-in</p>
              <p className="text-gray-800">{fmt(supplier.lastSignIn)}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-gray-400 uppercase tracking-[0.1em] text-[10px] mb-0.5">Approval</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsApproved(a => !a)}
                  className={`relative w-8 h-4 rounded-full transition-colors ${isApproved ? 'bg-[#2d6a4f]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isApproved ? 'left-[18px]' : 'left-[2px]'}`} />
                </button>
                <span className={isApproved ? 'text-[#2d6a4f]' : 'text-gray-400'}>
                  {isApproved ? 'Approved' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Business details */}
          <div>
            <label className={labelCls}>Business / Property Name</label>
            <input value={businessName} onChange={e => setBusinessName(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Supplier Type</label>
            <select value={supplierType} onChange={e => setSupplierType(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Select type…</option>
              {SUPPLIER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Bio / Description</label>
            <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} className={`${inputCls} resize-none`} />
          </div>

          <div>
            <label className={labelCls}>Website <span className="normal-case tracking-normal text-gray-300">optional</span></label>
            <input value={website} onChange={e => setWebsite(e.target.value)} className={inputCls} placeholder="https://" />
          </div>

          {/* Owner contact email (for VD-managed accounts) */}
          <div>
            <label className={labelCls}>
              Owner Contact Email
              <span className="ml-1.5 normal-case tracking-normal text-gray-300">
                {supplier.isVdManaged ? 'stored for transfer — not the login address' : 'owner\'s email'}
              </span>
            </label>
            <input
              type="email"
              value={ownerContactEmail}
              onChange={e => setOwnerContactEmail(e.target.value)}
              className={inputCls}
              placeholder="owner@property.co.za"
            />
          </div>

          {/* Ops assignments link */}
          <div className="border border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-sans text-xs font-medium text-gray-700">Ops Assignments</p>
              <p className="font-sans text-[11px] text-gray-400 mt-0.5">Manage which operations employees are assigned to this supplier.</p>
            </div>
            <Link
              href={`/admin/operations/managed-suppliers/${supplier.id}`}
              className="shrink-0 inline-flex items-center gap-1 font-sans text-xs text-[#2d6a4f] hover:underline"
            >
              View <ArrowUpRight size={11} />
            </Link>
          </div>

          {/* Transfer to owner — only for VD-managed accounts */}
          {supplier.isVdManaged && !transferred && (
            <div className="border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-sans text-xs font-medium text-amber-800">Transfer to property owner</p>
                  <p className="font-sans text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                    The supplier's login email will be updated to the owner's address and a setup link
                    will be sent so they can create their own password. VD-managed flag is cleared.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={transferEmail}
                  onChange={e => setTransferEmail(e.target.value)}
                  placeholder="owner@property.co.za"
                  className="flex-1 border border-amber-200 bg-white px-3 py-2 font-sans text-sm focus:outline-none focus:border-amber-400 transition-colors"
                />
                <button
                  onClick={transfer}
                  disabled={transferring}
                  className="inline-flex items-center gap-1.5 px-3 py-2 font-sans text-xs bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <Mail size={12} /> {transferring ? 'Transferring…' : 'Send Transfer Link'}
                </button>
              </div>
            </div>
          )}

          {transferred && (
            <div className="border border-[#2d6a4f]/30 bg-[#2d6a4f]/5 px-4 py-3 flex items-center gap-2">
              <Check size={14} className="text-[#2d6a4f]" />
              <p className="font-sans text-xs text-[#2d6a4f]">Account transferred. Setup link sent to owner.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 font-sans text-sm border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
          >
            Close
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-sans text-sm transition-colors ${saving ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}
          >
            <Save size={13} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'vd_managed'>('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SupplierRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all supplier profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, bio, is_approved, supplier_type, website, created_at')
        .eq('role', 'supplier')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Enrich with VD-managed flag from API (auth metadata)
      // For performance we build the list from the profile data first, then
      // lazily mark VD-managed accounts based on the known alias pattern.
      // Admins can open the panel for full metadata including auth user details.
      const rows: SupplierRow[] = (data ?? []).map((p: any) => {
        const emailStr: string = p.email ?? ''
        // A VD-managed alias always contains '+' in the local part — self-registered
        // users and property owners never use plus-addressed emails as logins.
        const isVdManaged = emailStr.includes('+') && emailStr.includes('@')
        return {
          id: p.id,
          businessName: p.full_name || p.email || 'Unnamed',
          email: emailStr,
          ownerContactEmail: null, // loaded on detail open
          supplierType: p.supplier_type ?? null,
          bio: p.bio ?? null,
          website: p.website ?? null,
          isApproved: Boolean(p.is_approved),
          isVdManaged,
          createdAt: p.created_at ?? '',
          lastSignIn: null, // loaded on detail open
        }
      })
      setSuppliers(rows)
    } catch (e) {
      toast.error('Could not load suppliers.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Open detail panel — fetch full profile from API so we have auth metadata
  async function openDetail(row: SupplierRow) {
    try {
      const res = await fetch(`/api/admin/supplier/${row.id}`)
      if (res.ok) {
        const full = await res.json()
        setSelected({ ...row, ...full })
      } else {
        setSelected(row)
      }
    } catch {
      setSelected(row)
    }
  }

  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      const searchable = `${s.businessName} ${s.email} ${s.supplierType ?? ''}`.toLowerCase()
      const matchSearch = searchable.includes(search.toLowerCase())
      const matchFilter =
        filter === 'all' ? true
        : filter === 'pending' ? !s.isApproved
        : filter === 'approved' ? s.isApproved
        : filter === 'vd_managed' ? s.isVdManaged
        : true
      return matchSearch && matchFilter
    })
  }, [suppliers, search, filter])

  const counts = {
    all: suppliers.length,
    pending: suppliers.filter(s => !s.isApproved).length,
    approved: suppliers.filter(s => s.isApproved).length,
    vd_managed: suppliers.filter(s => s.isVdManaged).length,
  }

  const tabs: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending approval' },
    { key: 'approved', label: 'Approved' },
    { key: 'vd_managed', label: 'VD Managed' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Suppliers</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">
            All supplier profiles — approved, pending, and VD-managed.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-5 py-3 font-sans text-sm border-b-2 transition-colors whitespace-nowrap ${
              filter === tab.key ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 font-sans text-xs text-gray-400">({counts[tab.key]})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-200 p-4 mb-6 flex items-center gap-2">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or type…"
          className="flex-1 font-sans text-sm focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-100">
              {['Business', 'Email / Alias', 'Type', 'Status', 'Joined', ''].map(h => (
                <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={6} className="px-5 py-12 text-center font-sans text-sm text-gray-400">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center font-sans text-sm text-gray-400">No suppliers found.</td></tr>
            )}
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-[#F7F5F2] transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-sm shrink-0">
                      {(s.businessName[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-medium truncate">{s.businessName}</p>
                      {s.isVdManaged && (
                        <span className="font-sans text-[10px] tracking-[0.08em] uppercase text-[#8B6914]">VD Managed</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <p className="font-sans text-xs text-gray-500 truncate max-w-[200px]">{s.email}</p>
                </td>
                <td className="px-5 py-4">{typeBadge(s.supplierType)}</td>
                <td className="px-5 py-4">
                  <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${
                    s.isApproved ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]' : 'bg-[#C9A96E]/15 text-[#8B6914]'
                  }`}>
                    {s.isApproved ? 'Approved' : 'Pending'}
                  </span>
                </td>
                <td className="px-5 py-4 font-sans text-xs text-gray-400">{fmt(s.createdAt)}</td>
                <td className="px-5 py-4">
                  <button
                    onClick={() => openDetail(s)}
                    className="inline-flex items-center gap-1 font-sans text-xs text-[#2d6a4f] hover:underline"
                  >
                    Manage <ChevronRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <SupplierDetailPanel
          supplier={selected}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); load() }}
        />
      )}
    </div>
  )
}

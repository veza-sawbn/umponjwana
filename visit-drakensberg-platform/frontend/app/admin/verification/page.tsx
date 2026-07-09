'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Search, ShieldCheck, PauseCircle, XCircle, ChevronDown, ChevronUp, RefreshCw, FileText } from 'lucide-react'
import {
  VERIFICATION_KINDS, adminListKind, adminModerateEntity, moderationStatus,
  adminListSupplierAccounts, adminSetSupplierStatus, adminSupplierApplication,
  type VerificationItem, type VerificationKind, type ModerationDecision, type ModerationStatus, type SupplierAccount,
} from '@/lib/admin-verification'
import type { OperatorProfile } from '@/lib/operators'

const STATUS_STYLE: Record<ModerationStatus, string> = {
  approved: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  pending: 'bg-[#C9A96E]/15 text-[#8B6914]',
  suspended: 'bg-orange-100 text-orange-700',
  rejected: 'bg-red-100 text-red-700',
}
const STATUS_FILTERS: ('all' | ModerationStatus)[] = ['all', 'pending', 'approved', 'suspended', 'rejected']

// Entity fields that are bookkeeping, not application content.
const HIDDEN_FIELDS = new Set(['id', 'supplierId', 'createdAt', 'updatedAt', 'status', 'propertyId'])
const IMAGE_FIELDS = new Set(['images', 'photos', 'gallery', 'portrait', 'logo'])

function labelize(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, c => c.toUpperCase())
}

function FieldValue({ field, value }: { field: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null
  if (IMAGE_FIELDS.has(field)) {
    const urls = (Array.isArray(value) ? value : [value]).filter(v => typeof v === 'string' && v.trim()) as string[]
    if (urls.length === 0) return null
    return (
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-24 h-16 overflow-hidden border border-gray-200 bg-gray-50">
            <img src={url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </a>
        ))}
      </div>
    )
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
      return <span>{value.join(', ')}</span>
    }
    return <span className="font-mono text-[11px] text-gray-500 break-all">{JSON.stringify(value)}</span>
  }
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>
  if (typeof value === 'object') return <span className="font-mono text-[11px] text-gray-500 break-all">{JSON.stringify(value)}</span>
  return <span className="whitespace-pre-line">{String(value)}</span>
}

function ApplicationDetails({ fields }: { fields: Record<string, unknown> }) {
  const entries = Object.entries(fields).filter(([k, v]) => !HIDDEN_FIELDS.has(k) && v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
  if (entries.length === 0) return <p className="font-sans text-sm text-gray-400">No further details were submitted.</p>
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
      {entries.map(([k, v]) => (
        <div key={k} className={IMAGE_FIELDS.has(k) ? 'md:col-span-2' : ''}>
          <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-0.5">{labelize(k)}</p>
          <div className="font-sans text-sm text-gray-700 leading-relaxed"><FieldValue field={k} value={v} /></div>
        </div>
      ))}
    </div>
  )
}

function DecisionButtons({ status, busy, onDecide }: { status: ModerationStatus; busy: boolean; onDecide: (d: ModerationDecision) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {status !== 'approved' && (
        <button disabled={busy} onClick={() => onDecide('approved')} className="px-2.5 py-1 bg-[#2d6a4f] text-white font-sans text-xs hover:bg-[#235a3f] transition-colors flex items-center gap-1 disabled:opacity-50">
          <ShieldCheck size={11} /> Approve
        </button>
      )}
      {status !== 'suspended' && (
        <button disabled={busy} onClick={() => onDecide('suspended')} className="px-2.5 py-1 border border-orange-200 text-orange-600 font-sans text-xs hover:bg-orange-50 transition-colors flex items-center gap-1 disabled:opacity-50">
          <PauseCircle size={11} /> Suspend
        </button>
      )}
      {status !== 'rejected' && (
        <button disabled={busy} onClick={() => onDecide('rejected')} className="px-2.5 py-1 border border-red-200 text-red-500 font-sans text-xs hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-50">
          <XCircle size={11} /> Reject
        </button>
      )}
    </div>
  )
}

export default function AdminVerificationPage() {
  const [tab, setTab] = useState<'suppliers' | string>('suppliers')
  const [statusFilter, setStatusFilter] = useState<'all' | ModerationStatus>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [accounts, setAccounts] = useState<SupplierAccount[]>([])
  const [items, setItems] = useState<Record<string, VerificationItem[]>>({})
  const [applications, setApplications] = useState<Record<string, OperatorProfile | null>>({})

  const supplierName = useMemo(() => {
    const map: Record<string, string> = {}
    accounts.forEach(a => { map[a.id] = a.name })
    return map
  }, [accounts])

  async function loadAll() {
    setLoading(true)
    try {
      const [supplierAccounts, ...lists] = await Promise.all([
        adminListSupplierAccounts(),
        ...VERIFICATION_KINDS.map(k => adminListKind(k)),
      ])
      setAccounts(supplierAccounts)
      setItems(Object.fromEntries(VERIFICATION_KINDS.map((k, i) => [k.key, lists[i]])))
    } catch {
      toast.error('Could not load verification queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  async function loadApplication(supplierId: string) {
    if (supplierId in applications) return
    const profile = await adminSupplierApplication(supplierId)
    setApplications(a => ({ ...a, [supplierId]: profile }))
  }

  async function decideSupplier(account: SupplierAccount, decision: ModerationDecision) {
    setBusyId(account.id)
    try {
      await adminSetSupplierStatus(account, decision)
      setAccounts(list => list.map(a => a.id === account.id ? { ...a, status: decision } : a))
      toast.success(`Supplier ${decision}.`)
    } catch {
      toast.error('Could not update the supplier. Run the 20260709 migration if this persists.')
    } finally {
      setBusyId(null)
    }
  }

  async function decideEntity(kind: VerificationKind, item: VerificationItem, decision: ModerationDecision) {
    setBusyId(item.id)
    try {
      const status = await adminModerateEntity(kind, item, decision)
      setItems(all => ({ ...all, [kind.key]: all[kind.key].map(i => i.id === item.id ? { ...i, status } : i) }))
      toast.success(`${kind.label.replace(/s$/i, '')} ${decision}.`)
    } catch {
      toast.error('Could not update the item.')
    } finally {
      setBusyId(null)
    }
  }

  const activeKind = VERIFICATION_KINDS.find(k => k.key === tab) ?? null

  const visibleAccounts = accounts.filter(a =>
    (statusFilter === 'all' || a.status === statusFilter) &&
    `${a.name} ${a.email} ${a.bio}`.toLowerCase().includes(search.toLowerCase())
  )
  const visibleItems = (activeKind ? items[activeKind.key] ?? [] : []).filter(i =>
    (statusFilter === 'all' || moderationStatus(i.status) === statusFilter) &&
    `${i.name} ${supplierName[i.supplierId] ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const countFor = (f: 'all' | ModerationStatus) => tab === 'suppliers'
    ? accounts.filter(a => f === 'all' || a.status === f).length
    : (items[tab] ?? []).filter(i => f === 'all' || moderationStatus(i.status) === f).length

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Verification</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Approve, suspend or reject suppliers and everything they submit. Suspended and rejected items are hidden from visitors immediately.</p>
        </div>
        <button onClick={loadAll} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-4 overflow-x-auto">
        {[{ key: 'suppliers', label: 'Suppliers' }, ...VERIFICATION_KINDS].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setExpanded(null) }}
            className={`px-5 py-3 font-sans text-sm border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {t.label}
            <span className="ml-1.5 font-sans text-xs text-gray-400">
              ({t.key === 'suppliers' ? accounts.length : (items[t.key] ?? []).length})
            </span>
          </button>
        ))}
      </div>

      {/* Status filter + search */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 font-sans text-xs capitalize border transition-colors ${
                statusFilter === f ? 'bg-[#2d6a4f] border-[#2d6a4f] text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-[#2d6a4f]'
              }`}
            >
              {f} ({countFor(f)})
            </button>
          ))}
        </div>
        <div className="bg-white border border-gray-200 px-3 py-2 flex items-center gap-2 flex-1 min-w-[220px]">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="flex-1 font-sans text-sm focus:outline-none" />
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 px-5 py-12 text-center font-sans text-sm text-gray-400">Loading verification queue…</div>
      ) : (
        <div className="space-y-3">
          {/* Supplier accounts */}
          {tab === 'suppliers' && visibleAccounts.map(account => {
            const open = expanded === account.id
            const application = applications[account.id]
            return (
              <div key={account.id} className="bg-white border border-gray-200">
                <div className="p-5 flex items-center gap-4 flex-wrap">
                  <div className="w-9 h-9 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] shrink-0">
                    {account.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm font-medium">{account.name}</p>
                    <p className="font-sans text-xs text-gray-400 truncate">{account.email}{account.createdAt ? ` · joined ${new Date(account.createdAt).toLocaleDateString()}` : ''}</p>
                  </div>
                  <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 shrink-0 ${STATUS_STYLE[account.status]}`}>{account.status}</span>
                  <DecisionButtons status={account.status} busy={busyId === account.id} onDecide={d => decideSupplier(account, d)} />
                  <button
                    onClick={() => { setExpanded(open ? null : account.id); if (!open) loadApplication(account.id) }}
                    className="inline-flex items-center gap-1 font-sans text-xs text-gray-500 hover:text-[#2d6a4f] transition-colors shrink-0"
                  >
                    <FileText size={12} /> Application {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
                {open && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-[#F7F5F2]/60">
                    {account.bio && (
                      <div className="mb-4">
                        <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-0.5">Bio</p>
                        <p className="font-sans text-sm text-gray-700 leading-relaxed">{account.bio}</p>
                      </div>
                    )}
                    {application === undefined ? (
                      <p className="font-sans text-sm text-gray-400">Loading application…</p>
                    ) : application === null ? (
                      <p className="font-sans text-sm text-gray-400">No company profile submitted yet — the supplier hasn&apos;t completed their public application (company details, licences, insurance, emergency procedures).</p>
                    ) : (
                      <ApplicationDetails fields={application as unknown as Record<string, unknown>} />
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {tab === 'suppliers' && visibleAccounts.length === 0 && (
            <div className="bg-white border border-gray-200 px-5 py-12 text-center font-sans text-sm text-gray-400">No suppliers match.</div>
          )}

          {/* Catalog entities */}
          {activeKind && visibleItems.map(item => {
            const status = moderationStatus(item.status)
            const open = expanded === item.id
            return (
              <div key={item.id} className="bg-white border border-gray-200">
                <div className="p-5 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm font-medium">{item.name}</p>
                    <p className="font-sans text-xs text-gray-400 truncate">
                      {supplierName[item.supplierId] || (item.supplierId ? `Supplier ${item.supplierId.slice(0, 8)}…` : 'No supplier on record')}
                      {item.createdAt ? ` · submitted ${new Date(item.createdAt).toLocaleDateString()}` : ''}
                      {` · stored status: ${item.status}`}
                    </p>
                  </div>
                  <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 shrink-0 ${STATUS_STYLE[status]}`}>{status}</span>
                  <DecisionButtons status={status} busy={busyId === item.id} onDecide={d => decideEntity(activeKind, item, d)} />
                  <button
                    onClick={() => setExpanded(open ? null : item.id)}
                    className="inline-flex items-center gap-1 font-sans text-xs text-gray-500 hover:text-[#2d6a4f] transition-colors shrink-0"
                  >
                    <FileText size={12} /> Details {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
                {open && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-[#F7F5F2]/60">
                    <ApplicationDetails fields={item.fields} />
                  </div>
                )}
              </div>
            )
          })}
          {activeKind && visibleItems.length === 0 && (
            <div className="bg-white border border-gray-200 px-5 py-12 text-center font-sans text-sm text-gray-400">Nothing submitted in this category yet.</div>
          )}
        </div>
      )}
    </div>
  )
}

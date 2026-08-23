'use client'

/**
 * /admin/operations/managed-suppliers/[supplierId]
 *
 * Supplier detail page within the delegated management system.
 *
 * Two main actors:
 *   - VD Operations employees: see their assignment, permissions, supplier info,
 *     and an "Enter Management Tools" button that puts them in acting-as mode.
 *   - Platform admins: see everything above + commercial terms panel + all
 *     assignees + controls to edit the commercial agreement.
 *
 * Security: all data loaded via RLS-gated queries; the client can only see what
 * the DB policies allow. The "Enter Management Tools" path validates the
 * assignment server-side before entering acting-as mode.
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Building2, Users, Settings, ChevronRight,
  LogIn, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Calendar, Percent, FileText, Shield, Pencil, X, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/auth'
import {
  getAssignmentsForSupplier,
  setAssignment,
  ALL_PERMISSIONS,
  OPS_ROLE_LABEL,
  DEFAULT_PERMISSIONS_BY_ROLE,
  type OpsAssignmentDetails,
  type OpsRole,
} from '@/lib/ops-assignments'
import {
  getSupplierTerms,
  upsertSupplierTerms,
  MANAGEMENT_MODEL_LABEL,
  MANAGEMENT_STATUS_LABEL,
  AGREEMENT_TYPE_LABEL,
  type CommercialTerms,
  type ManagementModel,
  type ManagementStatus,
  type AgreementType,
} from '@/lib/commercial-agreements'
import { SUPPLIER_CONFIG } from '@/lib/supplier-config'

// ─── Types ─────────────────────────────────────────────────────────────────────

type SupplierProfile = {
  id: string
  full_name: string | null
  email: string | null
  supplier_type: string | null
  approval_status: string | null
  is_approved: boolean | null
  created_at: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function typeBadge(type: string | null) {
  if (!type) return null
  const colors: Record<string, string> = {
    Accommodation: 'bg-blue-50 text-blue-700 border-blue-100',
    Activity: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'Guided Tours': 'bg-amber-50 text-amber-700 border-amber-100',
    Shuttle: 'bg-purple-50 text-purple-700 border-purple-100',
    Experience: 'bg-rose-50 text-rose-700 border-rose-100',
  }
  return (
    <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 border ${colors[type] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {type}
    </span>
  )
}

function approvalBadge(status: string | null) {
  const variants: Record<string, { cls: string; label: string }> = {
    approved:  { cls: 'text-[#2d6a4f] bg-[#2d6a4f]/10', label: 'Approved' },
    pending:   { cls: 'text-amber-700 bg-amber-50',      label: 'Pending' },
    suspended: { cls: 'text-red-700 bg-red-50',          label: 'Suspended' },
  }
  const v = variants[status ?? ''] ?? { cls: 'text-gray-500 bg-gray-100', label: status ?? 'Unknown' }
  return (
    <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 ${v.cls}`}>
      {v.label}
    </span>
  )
}

function modelBadge(model: string) {
  if (model === 'vd_managed') {
    return <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-[#C9A96E]/15 text-[#8B6914]">VD Managed</span>
  }
  return <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-gray-100 text-gray-600">Supplier Managed</span>
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    active:            'bg-[#2d6a4f]/10 text-[#2d6a4f]',
    pending_agreement: 'bg-amber-50 text-amber-700',
    suspended:         'bg-red-50 text-red-700',
    terminated:        'bg-gray-200 text-gray-500',
  }
  return (
    <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 ${colors[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {MANAGEMENT_STATUS_LABEL[status as ManagementStatus] ?? status}
    </span>
  )
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Commercial Terms Panel (admin only) ───────────────────────────────────────

function CommercialTermsPanel({
  supplierId,
  terms,
  onSaved,
}: {
  supplierId: string
  terms: CommercialTerms | null
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [model, setModel]             = useState<ManagementModel>(terms?.management_model ?? 'supplier_managed')
  const [status, setStatus]           = useState<ManagementStatus>(terms?.management_status ?? 'active')
  const [agreementType, setAgreementType] = useState<AgreementType | ''>(terms?.agreement_type ?? '')
  const [commission, setCommission]   = useState(terms?.commission_rate?.toString() ?? '')
  const [mgmtFee, setMgmtFee]         = useState(terms?.management_fee?.toString() ?? '')
  const [platformFee, setPlatformFee] = useState(terms?.platform_fee_rate?.toString() ?? '')
  const [settlement, setSettlement]   = useState(terms?.settlement_frequency ?? 'monthly')
  const [effectiveDate, setEffectiveDate] = useState(terms?.agreement_effective_date ?? '')
  const [expiryDate, setExpiryDate]   = useState(terms?.agreement_expiry_date ?? '')
  const [reference, setReference]     = useState(terms?.agreement_reference ?? '')
  const [notes, setNotes]             = useState(terms?.agreement_notes ?? '')

  function reset() {
    setModel(terms?.management_model ?? 'supplier_managed')
    setStatus(terms?.management_status ?? 'active')
    setAgreementType(terms?.agreement_type ?? '')
    setCommission(terms?.commission_rate?.toString() ?? '')
    setMgmtFee(terms?.management_fee?.toString() ?? '')
    setPlatformFee(terms?.platform_fee_rate?.toString() ?? '')
    setSettlement(terms?.settlement_frequency ?? 'monthly')
    setEffectiveDate(terms?.agreement_effective_date ?? '')
    setExpiryDate(terms?.agreement_expiry_date ?? '')
    setReference(terms?.agreement_reference ?? '')
    setNotes(terms?.agreement_notes ?? '')
    setEditing(false)
  }

  async function save() {
    setSaving(true)
    try {
      await upsertSupplierTerms(supplierId, {
        management_model: model,
        management_status: status,
        agreement_type: agreementType || null,
        commission_rate: commission ? parseFloat(commission) : null,
        management_fee: mgmtFee ? parseFloat(mgmtFee) : null,
        platform_fee_rate: platformFee ? parseFloat(platformFee) : null,
        settlement_frequency: settlement,
        agreement_effective_date: effectiveDate || null,
        agreement_expiry_date: expiryDate || null,
        agreement_reference: reference || null,
        agreement_notes: notes || null,
      })
      toast.success('Commercial terms saved')
      setEditing(false)
      onSaved()
    } catch (e: any) {
      toast.error(e.message || 'Could not save terms')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-gray-200 bg-white px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]'
  const selectCls = `${inputCls} bg-white`

  return (
    <div className="bg-white border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-display italic text-lg flex items-center gap-2">
          <Percent size={16} className="text-[#C9A96E]" /> Commercial Agreement
        </h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-sans text-xs text-gray-600 border border-gray-200 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
          >
            <Pencil size={12} /> Edit
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 font-sans text-xs text-gray-500 border border-gray-200 hover:border-gray-400 transition-colors disabled:opacity-50"
            >
              <X size={12} /> Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 font-sans text-xs text-white bg-[#2d6a4f] hover:bg-[#245741] transition-colors disabled:opacity-50"
            >
              <Check size={12} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Management model + status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Management Model</label>
            {editing ? (
              <select value={model} onChange={e => setModel(e.target.value as ManagementModel)} className={selectCls}>
                <option value="supplier_managed">Supplier Managed</option>
                <option value="vd_managed">Visit Drakensberg Managed</option>
              </select>
            ) : (
              <div>{modelBadge(terms?.management_model ?? 'supplier_managed')}</div>
            )}
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Status</label>
            {editing ? (
              <select value={status} onChange={e => setStatus(e.target.value as ManagementStatus)} className={selectCls}>
                <option value="active">Active</option>
                <option value="pending_agreement">Pending Agreement</option>
                <option value="suspended">Suspended</option>
                <option value="terminated">Terminated</option>
              </select>
            ) : (
              <div>{statusBadge(terms?.management_status ?? 'active')}</div>
            )}
          </div>
        </div>

        {/* Agreement type + reference */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Agreement Type</label>
            {editing ? (
              <select value={agreementType} onChange={e => setAgreementType(e.target.value as AgreementType | '')} className={selectCls}>
                <option value="">— None —</option>
                <option value="marketplace_agreement">Marketplace Agreement</option>
                <option value="managed_asset_agreement">Managed Asset Agreement</option>
              </select>
            ) : (
              <p className="font-sans text-sm text-gray-700">
                {terms?.agreement_type
                  ? AGREEMENT_TYPE_LABEL[terms.agreement_type as AgreementType]
                  : <span className="text-gray-400">—</span>}
              </p>
            )}
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Agreement Reference</label>
            {editing ? (
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. VD-MA-2026-001" className={inputCls} />
            ) : (
              <p className="font-sans text-sm text-gray-700">{terms?.agreement_reference || <span className="text-gray-400">—</span>}</p>
            )}
          </div>
        </div>

        {/* Rates */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Commission Rate (%)</label>
            {editing ? (
              <input type="number" min="0" max="100" step="0.1" value={commission} onChange={e => setCommission(e.target.value)} placeholder="e.g. 15" className={inputCls} />
            ) : (
              <p className="font-sans text-sm text-gray-700">
                {terms?.commission_rate != null ? `${terms.commission_rate}%` : <span className="text-gray-400">—</span>}
              </p>
            )}
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Management Fee (%)</label>
            {editing ? (
              <input type="number" min="0" max="100" step="0.1" value={mgmtFee} onChange={e => setMgmtFee(e.target.value)} placeholder="e.g. 5" className={inputCls} />
            ) : (
              <p className="font-sans text-sm text-gray-700">
                {terms?.management_fee != null ? `${terms.management_fee}%` : <span className="text-gray-400">—</span>}
              </p>
            )}
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Platform Fee (%)</label>
            {editing ? (
              <input type="number" min="0" max="100" step="0.1" value={platformFee} onChange={e => setPlatformFee(e.target.value)} placeholder="e.g. 2.5" className={inputCls} />
            ) : (
              <p className="font-sans text-sm text-gray-700">
                {terms?.platform_fee_rate != null ? `${terms.platform_fee_rate}%` : <span className="text-gray-400">—</span>}
              </p>
            )}
          </div>
        </div>

        {/* Settlement + dates */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Settlement Frequency</label>
            {editing ? (
              <select value={settlement} onChange={e => setSettlement(e.target.value)} className={selectCls}>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            ) : (
              <p className="font-sans text-sm text-gray-700 capitalize">{terms?.settlement_frequency || 'monthly'}</p>
            )}
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Effective Date</label>
            {editing ? (
              <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className={inputCls} />
            ) : (
              <p className="font-sans text-sm text-gray-700">{fmtDate(terms?.agreement_effective_date)}</p>
            )}
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Expiry Date</label>
            {editing ? (
              <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={inputCls} />
            ) : (
              <p className="font-sans text-sm text-gray-700">{fmtDate(terms?.agreement_expiry_date)}</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Agreement Notes</label>
          {editing ? (
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Any notes about this commercial agreement…" />
          ) : (
            <p className="font-sans text-sm text-gray-700 whitespace-pre-line">
              {terms?.agreement_notes || <span className="text-gray-400">—</span>}
            </p>
          )}
        </div>

        {/* Last updated */}
        {terms?.updated_at && (
          <p className="font-sans text-[11px] text-gray-400">
            Last updated {fmtDate(terms.updated_at)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Edit Assignment Panel ─────────────────────────────────────────────────────

function EditAssignmentPanel({
  assignment,
  onSaved,
  onClose,
}: {
  assignment: OpsAssignmentDetails
  onSaved: () => void
  onClose: () => void
}) {
  const [permissions, setPermissions] = useState<string[]>(assignment.permissions ?? [])
  const [isActive, setIsActive]       = useState(assignment.is_active)
  const [notes, setNotes]             = useState(assignment.notes ?? '')
  const [saving, setSaving]           = useState(false)

  function toggle(key: string) {
    setPermissions(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    )
  }

  function applyRole(role: OpsRole) {
    setPermissions(DEFAULT_PERMISSIONS_BY_ROLE[role])
  }

  async function save() {
    setSaving(true)
    try {
      await setAssignment({
        employeeId: assignment.employee_id,
        supplierId: assignment.supplier_id,
        permissions,
        isActive,
        notes: notes || null,
      })
      toast.success('Assignment updated')
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Could not save assignment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-display italic text-lg">Edit Assignment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <p className="font-sans text-sm font-medium text-gray-700">{assignment.employee_name ?? assignment.employee_email}</p>
            <p className="font-sans text-xs text-gray-400">
              {assignment.ops_role ? OPS_ROLE_LABEL[assignment.ops_role as OpsRole] : 'Unknown role'}
            </p>
          </div>

          {/* Quick-fill by role */}
          <div>
            <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">Apply defaults from role</p>
            <div className="flex flex-wrap gap-2">
              {(['reservation_agent', 'reservations_manager', 'asset_manager', 'ops_administrator'] as OpsRole[]).map(r => (
                <button
                  key={r}
                  onClick={() => applyRole(r)}
                  className="px-2 py-1 font-sans text-xs border border-gray-200 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
                >
                  {OPS_ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions grid */}
          <div>
            <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">Permissions</p>
            <div className="grid grid-cols-1 gap-1">
              {ALL_PERMISSIONS.map(p => (
                <label key={p.key} className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={permissions.includes(p.key)}
                    onChange={() => toggle(p.key)}
                    className="accent-[#2d6a4f]"
                  />
                  <span className="font-sans text-sm text-gray-700 group-hover:text-gray-900">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Active status */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="accent-[#2d6a4f]"
            />
            <span className="font-sans text-sm text-gray-700">Assignment is active</span>
          </label>

          {/* Notes */}
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 bg-white px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 font-sans text-sm text-gray-600 border border-gray-200 hover:border-gray-400 transition-colors">Cancel</button>
          <button
            onClick={save}
            disabled={saving || permissions.length === 0}
            className="px-4 py-2 font-sans text-sm text-white bg-[#2d6a4f] hover:bg-[#245741] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ManagedSupplierDetailPage() {
  const { supplierId } = useParams<{ supplierId: string }>()
  const router = useRouter()

  const [supplier, setSupplier]       = useState<SupplierProfile | null>(null)
  const [assignments, setAssignments] = useState<OpsAssignmentDetails[]>([])
  const [terms, setTerms]             = useState<CommercialTerms | null>(null)
  const [myAssignment, setMyAssignment] = useState<OpsAssignmentDetails | null>(null)
  const [isAdmin, setIsAdmin]         = useState(false)
  const [isOps, setIsOps]             = useState(false)
  const [loading, setLoading]         = useState(true)
  const [enteringTools, setEnteringTools] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<OpsAssignmentDetails | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !supplierId) { setLoading(false); return }

    // Determine actor type
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, staff_role, ops_role, organisation')
      .eq('id', user.id)
      .maybeSingle()

    const adminUser = profile?.role === 'admin'
    const opsUser = profile?.organisation === 'vd_operations' && profile?.ops_role != null
    setIsAdmin(adminUser)
    setIsOps(opsUser)

    // Load supplier profile
    const { data: supplierData } = await supabase
      .from('profiles')
      .select('id, full_name, email, supplier_type, approval_status, is_approved, created_at')
      .eq('id', supplierId)
      .maybeSingle()
    setSupplier(supplierData as SupplierProfile | null)

    // Load assignments — admin sees all, ops employee sees their own
    if (adminUser) {
      const allAssignments = await getAssignmentsForSupplier(supplierId)
      setAssignments(allAssignments)
      const mine = allAssignments.find(a => a.employee_id === user.id) ?? null
      setMyAssignment(mine)
      // Load commercial terms (admin only)
      const t = await getSupplierTerms(supplierId)
      setTerms(t)
    } else if (opsUser) {
      // Ops employee — only fetch their own assignment via the RLS-scoped view
      const { data: opsAssignment } = await supabase
        .from('vd_ops_assignment_details')
        .select('*')
        .eq('supplier_id', supplierId)
        .eq('employee_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      const mine = opsAssignment as OpsAssignmentDetails | null
      setMyAssignment(mine)
      if (mine) setAssignments([mine])
    }

    setLoading(false)
  }, [supplierId])

  useEffect(() => { load() }, [load])

  async function handleEnterTools() {
    if (!supplierId) return
    setEnteringTools(true)
    try {
      // Store the selection in sessionStorage — the ManagedSupplierProvider
      // will pick it up and validate it server-side on next render.
      try { sessionStorage.setItem('vd_managed_supplier_id', supplierId) } catch {}
      // Navigate into the supplier tools area
      router.push('/supplier')
    } catch {
      toast.error('Could not enter management tools')
      setEnteringTools(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-gray-400">
        <RefreshCw size={14} className="animate-spin" />
        <span className="font-sans text-sm">Loading…</span>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="p-8">
        <Link href="/admin/operations/managed-suppliers" className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to Managed Suppliers
        </Link>
        <p className="font-sans text-sm text-gray-400">Supplier not found or you do not have access to this supplier.</p>
      </div>
    )
  }

  const supplierTypeLabel = supplier.supplier_type
    ? (SUPPLIER_CONFIG[supplier.supplier_type as keyof typeof SUPPLIER_CONFIG]?.label ?? supplier.supplier_type)
    : null

  const hasAccess = myAssignment?.is_active === true
  const activeAssignments = assignments.filter(a => a.is_active)
  const pastAssignments   = assignments.filter(a => !a.is_active)

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <Link
        href="/admin/operations/managed-suppliers"
        className="inline-flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Managed Suppliers
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded bg-[#C9A96E]/15 flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-[#C9A96E]" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <h1 className="font-display italic text-3xl text-[#000000]">
                {supplier.full_name ?? supplier.email ?? supplierId}
              </h1>
              {typeBadge(supplierTypeLabel)}
              {approvalBadge(supplier.approval_status)}
            </div>
            <p className="font-sans text-sm text-gray-400">
              {supplier.email}
              {supplier.created_at && (
                <> · Joined {fmtDate(supplier.created_at)}</>
              )}
            </p>
          </div>
        </div>

        {/* Enter Management Tools */}
        {(isOps || isAdmin) && hasAccess && (
          <button
            onClick={handleEnterTools}
            disabled={enteringTools}
            className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-4 py-2.5 font-sans text-sm hover:bg-[#245741] disabled:opacity-60 transition-colors"
          >
            <LogIn size={15} />
            {enteringTools ? 'Entering…' : 'Enter Management Tools'}
          </button>
        )}

        {/* Admin: supplier has no active assignment but admin wants to see the page */}
        {isAdmin && !hasAccess && (
          <Link
            href="/admin/suppliers"
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2.5 font-sans text-sm hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
          >
            View in Suppliers
          </Link>
        )}
      </div>

      {/* Access denied for ops employee (no active assignment) */}
      {!isAdmin && !hasAccess && (
        <div className="mb-6 flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3.5">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-sans text-sm font-medium text-amber-800">No active assignment</p>
            <p className="font-sans text-xs text-amber-700 mt-0.5">You do not have an active management assignment for this supplier.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: assignment + permissions */}
        <div className="lg:col-span-2 space-y-6">

          {/* My / Current Assignment */}
          {myAssignment && (
            <div className="bg-white border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-display italic text-lg flex items-center gap-2">
                  <Shield size={16} className="text-[#2d6a4f]" /> Your Assignment
                </h2>
                {myAssignment.is_active ? (
                  <span className="inline-flex items-center gap-1 font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-[#2d6a4f]/10 text-[#2d6a4f]">
                    <CheckCircle2 size={10} /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-gray-100 text-gray-500">
                    <XCircle size={10} /> Inactive
                  </span>
                )}
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">Your Role</p>
                    <p className="font-sans text-sm text-gray-700">
                      {myAssignment.ops_role ? OPS_ROLE_LABEL[myAssignment.ops_role as OpsRole] : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">Assigned</p>
                    <p className="font-sans text-sm text-gray-700">{fmtDate(myAssignment.started_at)}</p>
                  </div>
                </div>

                <div>
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">Permissions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(myAssignment.permissions ?? []).map(p => {
                      const def = ALL_PERMISSIONS.find(x => x.key === p)
                      return (
                        <span key={p} className="font-sans text-[10px] tracking-[0.08em] px-2 py-0.5 bg-[#2d6a4f]/8 text-[#2d6a4f] border border-[#2d6a4f]/20">
                          {def?.label ?? p}
                        </span>
                      )
                    })}
                    {(!myAssignment.permissions || myAssignment.permissions.length === 0) && (
                      <span className="font-sans text-xs text-gray-400">No permissions configured</span>
                    )}
                  </div>
                </div>

                {myAssignment.notes && (
                  <div>
                    <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1">Notes</p>
                    <p className="font-sans text-sm text-gray-600">{myAssignment.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin: All assignees table */}
          {isAdmin && assignments.length > 0 && (
            <div className="bg-white border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-display italic text-lg flex items-center gap-2">
                  <Users size={16} className="text-[#2d6a4f]" /> Assigned Employees
                  <span className="font-sans text-xs text-gray-400">({activeAssignments.length} active)</span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Employee', 'Role', 'Assigned', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {assignments.map(a => (
                      <tr key={a.id} className={a.is_active ? '' : 'opacity-50'}>
                        <td className="px-4 py-3">
                          <p className="font-sans text-sm text-gray-700">{a.employee_name ?? '—'}</p>
                          <p className="font-sans text-[11px] text-gray-400">{a.employee_email}</p>
                        </td>
                        <td className="px-4 py-3 font-sans text-xs text-gray-600">
                          {a.ops_role ? OPS_ROLE_LABEL[a.ops_role as OpsRole] : '—'}
                        </td>
                        <td className="px-4 py-3 font-sans text-xs text-gray-500">{fmtDate(a.started_at)}</td>
                        <td className="px-4 py-3">
                          {a.is_active ? (
                            <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-[#2d6a4f]/10 text-[#2d6a4f]">Active</span>
                          ) : (
                            <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-gray-100 text-gray-500">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setEditingAssignment(a)}
                            className="font-sans text-xs text-gray-400 hover:text-[#2d6a4f] transition-colors inline-flex items-center gap-1"
                          >
                            <Pencil size={11} /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {assignments.length === 0 && (
                  <p className="px-4 py-6 font-sans text-sm text-gray-400 text-center">No employees assigned to this supplier.</p>
                )}
              </div>
            </div>
          )}

          {/* Commercial terms (admin only) */}
          {isAdmin && (
            <CommercialTermsPanel
              supplierId={supplierId}
              terms={terms}
              onSaved={load}
            />
          )}
        </div>

        {/* Right column: supplier info */}
        <div className="space-y-6">
          {/* Supplier info */}
          <div className="bg-white border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-display italic text-base flex items-center gap-2">
                <Building2 size={14} className="text-[#C9A96E]" /> Supplier Info
              </h2>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-0.5">Name</p>
                <p className="font-sans text-sm text-gray-700">{supplier.full_name ?? '—'}</p>
              </div>
              <div>
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-0.5">Email</p>
                <p className="font-sans text-sm text-gray-700">{supplier.email ?? '—'}</p>
              </div>
              <div>
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-0.5">Type</p>
                <div className="mt-1">{supplierTypeLabel ? typeBadge(supplierTypeLabel) : <span className="font-sans text-sm text-gray-400">—</span>}</div>
              </div>
              <div>
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-0.5">Approval</p>
                <div className="mt-1">{approvalBadge(supplier.approval_status)}</div>
              </div>
              {isAdmin && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-0.5">Management</p>
                  <div className="mt-1">{modelBadge(terms?.management_model ?? 'supplier_managed')}</div>
                </div>
              )}
            </div>
            {isAdmin && (
              <div className="px-5 py-3 border-t border-gray-100">
                <Link
                  href={`/admin/suppliers`}
                  className="font-sans text-xs text-gray-400 hover:text-[#2d6a4f] transition-colors inline-flex items-center gap-1"
                >
                  View full supplier profile <ChevronRight size={11} />
                </Link>
              </div>
            )}
          </div>

          {/* Quick actions */}
          {hasAccess && (
            <div className="bg-white border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-display italic text-base">Quick Actions</h2>
              </div>
              <div className="p-2 space-y-0.5">
                <button
                  onClick={handleEnterTools}
                  disabled={enteringTools}
                  className="w-full flex items-center justify-between px-3 py-2.5 font-sans text-sm text-gray-700 hover:bg-[#2d6a4f]/8 hover:text-[#2d6a4f] rounded transition-colors group"
                >
                  <span className="flex items-center gap-2">
                    <LogIn size={14} className="text-[#2d6a4f]" />
                    {enteringTools ? 'Entering tools…' : 'Enter Management Tools'}
                  </span>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-[#2d6a4f] transition-colors" />
                </button>
                {myAssignment?.permissions?.includes('view_bookings') && (
                  <button
                    onClick={handleEnterTools}
                    className="w-full flex items-center justify-between px-3 py-2.5 font-sans text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" /> View Bookings
                    </span>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </button>
                )}
                {isAdmin && (
                  <Link
                    href="/admin/finance"
                    className="w-full flex items-center justify-between px-3 py-2.5 font-sans text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <Percent size={14} className="text-gray-400" /> Finance & Settlements
                    </span>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Permissions summary for ops employee */}
          {!isAdmin && myAssignment && myAssignment.permissions && myAssignment.permissions.length > 0 && (
            <div className="bg-white border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-display italic text-base">Your Access</h2>
              </div>
              <div className="p-5">
                <div className="space-y-1">
                  {ALL_PERMISSIONS.map(p => {
                    const granted = myAssignment.permissions.includes(p.key)
                    return (
                      <div key={p.key} className={`flex items-center gap-2 font-sans text-xs py-0.5 ${granted ? 'text-gray-700' : 'text-gray-300'}`}>
                        {granted
                          ? <CheckCircle2 size={12} className="text-[#2d6a4f] shrink-0" />
                          : <XCircle size={12} className="text-gray-200 shrink-0" />
                        }
                        {p.label}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <EditAssignmentPanel
          assignment={editingAssignment}
          onSaved={load}
          onClose={() => setEditingAssignment(null)}
        />
      )}
    </div>
  )
}

'use client'

/**
 * /admin/operations/managed-suppliers
 *
 * Visit Drakensberg Operations — Managed Suppliers Dashboard
 *
 * Shows two views depending on who is logged in:
 *   - Platform admins: see all suppliers, all assignments, can configure everything
 *   - VD Operations employees: see only their assigned suppliers, can enter each one
 *
 * Security: All data fetched via Supabase client with proper RLS — the views
 * vd_managed_suppliers_summary and vd_ops_assignment_details are RLS-scoped.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Building2, Users, Plus, RefreshCw, ChevronRight, UserPlus, Settings, AlertCircle, Check, Mail, PlusCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/auth'
import {
  getMyManagedSuppliers,
  getAllAssignmentDetails,
  getOpsEmployees,
  setAssignment,
  OPS_ROLES,
  DEFAULT_PERMISSIONS_BY_ROLE,
  ALL_PERMISSIONS,
  OPS_ROLE_LABEL,
  type ManagedSupplierSummary,
  type OpsAssignmentDetails,
  type OpsRole,
} from '@/lib/ops-assignments'
import { MANAGEMENT_MODEL_LABEL, MANAGEMENT_STATUS_LABEL } from '@/lib/commercial-agreements'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function typeBadge(type: string | null) {
  if (!type) return null
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

function modelBadge(model: string) {
  if (model === 'vd_managed') {
    return (
      <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-[#C9A96E]/15 text-[#8B6914]">
        VD Managed
      </span>
    )
  }
  return (
    <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-gray-100 text-gray-500">
      Supplier Managed
    </span>
  )
}

// ─── Invite Employee Modal ─────────────────────────────────────────────────────

function InviteEmployeeModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [opsRole, setOpsRole] = useState<OpsRole>('reservation_agent')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/ops/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), fullName: fullName.trim(), opsRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not send invite')
      toast.success(`Invite sent to ${email.trim()}.`)
      onInvited()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-5">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">VD Operations</p>
          <h2 className="font-display italic text-2xl">Invite Employee</h2>
          <p className="font-sans text-sm text-gray-500 mt-1">
            Invite a new Visit Drakensberg Operations team member.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none"
              placeholder="employee@visitdrakensberg.co.za"
            />
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Full Name (optional)</label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Operational Role</label>
            <div className="space-y-2">
              {OPS_ROLES.map(r => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                    opsRole === r.value ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="opsRole"
                    checked={opsRole === r.value}
                    onChange={() => setOpsRole(r.value)}
                    className="mt-1 accent-[#2d6a4f]"
                  />
                  <span>
                    <span className="block font-sans text-sm font-medium text-gray-800">{r.label}</span>
                    <span className="block font-sans text-xs text-gray-400 mt-0.5">{r.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 font-sans text-sm border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={`flex-1 py-2.5 font-sans text-sm transition-colors ${busy ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}
          >
            {busy ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Set Ops Role (inline, for profiles that are missing ops_role) ─────────────

function SetOpsRoleRow({
  userId,
  currentRole,
  onSaved,
}: {
  userId: string
  currentRole: OpsRole | null
  onSaved: () => void
}) {
  const [role, setRole] = useState<OpsRole>(currentRole ?? 'reservation_agent')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/ops/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, opsRole: role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not set role')
      toast.success('Operational role configured.')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not set role')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <select
        value={role}
        onChange={e => setRole(e.target.value as OpsRole)}
        className="border border-gray-200 bg-white px-2 py-1 font-sans text-xs focus:outline-none"
      >
        {OPS_ROLES.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={busy}
        className="inline-flex items-center gap-1 px-2 py-1 font-sans text-xs bg-[#2d6a4f] text-white hover:bg-[#245741] disabled:opacity-50 transition-colors"
      >
        <Check size={10} /> {busy ? 'Saving…' : 'Set Role'}
      </button>
    </div>
  )
}

// ─── Resend Invite / Setup Email Button ───────────────────────────────────────

/**
 * Resends the invite email (if the user never accepted) or a password-reset /
 * account-setup email (if they already confirmed but need to sign in).
 */
function ResendButton({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function resend() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/ops/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not resend')
      const label = json.type === 'invite_resent' ? 'Invite resent.' : 'Setup email sent.'
      toast.success(label)
      setSent(true)
      // Reset the "sent" indicator after 30 s so the admin can resend again
      setTimeout(() => setSent(false), 30_000)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not resend email')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1 font-sans text-xs text-emerald-600">
        <Check size={11} /> Sent
      </span>
    )
  }

  return (
    <button
      onClick={resend}
      disabled={busy}
      title="Resend invite / account setup email"
      className="inline-flex items-center gap-1 font-sans text-xs text-gray-400 hover:text-[#2d6a4f] disabled:opacity-40 transition-colors"
    >
      <Mail size={12} /> {busy ? 'Sending…' : 'Resend'}
    </button>
  )
}


// ─── Create Supplier Modal ─────────────────────────────────────────────────────

const SUPPLIER_TYPES = ['Accommodation', 'Activity', 'Guided Tours', 'Shuttle', 'Experience'] as const

/**
 * Allows platform admins and ops_administrators to create an internally-managed
 * supplier profile that can later be transferred to the property owner.
 */
function CreateSupplierModal({ onClose, onCreated }: { onClose: () => void; onCreated: (supplierId: string) => void }) {
  const [businessName, setBusinessName] = useState('')
  const [ownerContactEmail, setOwnerContactEmail] = useState('')
  const [supplierType, setSupplierType] = useState<string>(SUPPLIER_TYPES[0])
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!businessName.trim()) { toast.error('Business name is required.'); return }
    const contactEmail = ownerContactEmail.trim().toLowerCase()
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      toast.error('Enter a valid owner contact email address.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/ops/create-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          supplierType,
          ...(contactEmail ? { ownerContactEmail: contactEmail } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not create supplier')
      toast.success(`Supplier "${businessName.trim()}" created under VD alias.`)
      onCreated(json.supplierId)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create supplier')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-5">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">VD Operations</p>
          <h2 className="font-display italic text-2xl">Create Supplier</h2>
          <p className="font-sans text-sm text-gray-500 mt-1">
            Creates an internally-managed supplier under a VD alias address. Assign staff and transfer to
            the property owner later via the supplier profile panel.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">
              Business / Property Name
            </label>
            <input
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] transition-colors"
              placeholder="Drakensberg Mountain Lodge"
            />
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">
              Property owner's email{' '}
              <span className="normal-case tracking-normal font-normal text-gray-300">optional · for transfer later</span>
            </label>
            <input
              type="email"
              value={ownerContactEmail}
              onChange={e => setOwnerContactEmail(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] transition-colors"
              placeholder="owner@property.co.za"
            />
            <p className="font-sans text-[10px] text-gray-400 mt-1 leading-relaxed">
              Stored for reference only. The account uses an internal VD alias until you transfer it to the owner.
            </p>
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">
              Supplier Type
            </label>
            <select
              value={supplierType}
              onChange={e => setSupplierType(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm bg-white focus:outline-none focus:border-[#2d6a4f] transition-colors"
            >
              {SUPPLIER_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 font-sans text-sm border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={`flex-1 py-2.5 font-sans text-sm transition-colors ${busy ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}
          >
            {busy ? 'Creating…' : 'Create Supplier'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Assign Supplier Modal ─────────────────────────────────────────────────────

function AssignSupplierModal({
  employees,
  onClose,
  onAssigned,
}: {
  employees: { id: string; full_name: string | null; email: string | null; ops_role: OpsRole | null; setup_complete: boolean }[]
  onClose: () => void
  onAssigned: () => void
}) {
  const readyEmployees = employees.filter(e => e.setup_complete)
  const [employeeId, setEmployeeId] = useState(readyEmployees[0]?.id ?? '')
  const [suppliers, setSuppliers] = useState<{ id: string; full_name: string | null; supplier_type: string | null }[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, supplier_type')
      .eq('role', 'supplier')
      .eq('is_approved', true)
      .order('full_name', { ascending: true })
      .then(({ data }) => {
        setSuppliers((data ?? []) as any[])
        if (data?.[0]) setSupplierId(data[0].id)
        setLoadingSuppliers(false)
      })
  }, [])

  // Pre-populate permissions based on selected employee's ops_role
  useEffect(() => {
    const emp = readyEmployees.find(e => e.id === employeeId)
    if (emp?.ops_role) {
      setPermissions(DEFAULT_PERMISSIONS_BY_ROLE[emp.ops_role] ?? [])
    }
  }, [employeeId, readyEmployees])

  function togglePermission(key: string) {
    setPermissions(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key])
  }

  async function submit() {
    if (!employeeId || !supplierId) { toast.error('Select both an employee and a supplier.'); return }
    setBusy(true)
    try {
      await setAssignment({ employeeId, supplierId, permissions })
      toast.success('Assignment saved.')
      onAssigned()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save assignment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="mb-5">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">VD Operations</p>
          <h2 className="font-display italic text-2xl">Assign Supplier</h2>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Employee</label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm bg-white focus:outline-none"
            >
              {readyEmployees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.full_name || e.email} · {e.ops_role ? OPS_ROLE_LABEL[e.ops_role] : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Supplier</label>
            {loadingSuppliers ? (
              <p className="font-sans text-sm text-gray-400">Loading suppliers…</p>
            ) : (
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm bg-white focus:outline-none"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.id} {s.supplier_type ? `· ${s.supplier_type}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">
              Permissions for this supplier
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_PERMISSIONS.map(p => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={permissions.includes(p.key)}
                    onChange={() => togglePermission(p.key)}
                    className="accent-[#2d6a4f]"
                  />
                  <span className="font-sans text-xs text-gray-600 group-hover:text-gray-900">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 font-sans text-sm border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={`flex-1 py-2.5 font-sans text-sm transition-colors ${busy ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}
          >
            {busy ? 'Saving…' : 'Save Assignment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ManagedSuppliersPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOpsEmployee, setIsOpsEmployee] = useState(false)
  // opsRole is the granular VD ops role; used to gate the "Create Supplier" button
  const [opsRole, setOpsRole] = useState<string | null>(null)

  // Admin view: all assignments across all employees
  const [allAssignments, setAllAssignments] = useState<OpsAssignmentDetails[]>([])
  const [employees, setEmployees] = useState<Awaited<ReturnType<typeof getOpsEmployees>>>([])

  // Ops employee view: their own assigned suppliers
  const [mySuppliers, setMySuppliers] = useState<ManagedSupplierSummary[]>([])

  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showCreateSupplier, setShowCreateSupplier] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Try the full profile query (requires the delegated-management migration).
    // If ops_role / organisation columns don't exist yet (42703), fall back to
    // the pre-migration columns so the admin page still loads.
    let profile: { role?: string; staff_role?: string; ops_role?: string; organisation?: string } | null = null
    const { data: fullProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, staff_role, ops_role, organisation')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) {
      // Likely 42703 (undefined column) — migration not yet applied
      const { data: basicProfile } = await supabase
        .from('profiles')
        .select('role, staff_role')
        .eq('id', user.id)
        .maybeSingle()
      profile = basicProfile
    } else {
      profile = fullProfile
    }

    const admin = profile?.role === 'admin'
    // An ops employee is anyone with staff_role='operations' who isn't a full admin.
    // This includes users whose ops_role hasn't been configured yet — they still
    // land on this page (via the middleware redirect) and see their assigned suppliers
    // once setup is complete.
    const opsEmp = !admin && profile?.staff_role === 'operations'

    setIsAdmin(admin)
    setIsOpsEmployee(opsEmp)
    setOpsRole(profile?.ops_role ?? null)

    if (admin) {
      const [assignments, emps] = await Promise.all([
        getAllAssignmentDetails(),
        getOpsEmployees(),
      ])
      setAllAssignments(assignments)
      setEmployees(emps)
    } else if (opsEmp) {
      const suppliers = await getMyManagedSuppliers()
      setMySuppliers(suppliers)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="p-8">
        <p className="font-sans text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  // Operations employees never reach this page — middleware routes them to their
  // own /operations environment. This page is the admin's management view of the
  // operations layer: who is on the team, and which suppliers they cover.
  if (isOpsEmployee) {
    return (
      <div className="p-8">
        <p className="font-sans text-sm text-gray-400">
          Redirecting you to your operations dashboard…
        </p>
        <Link href="/operations" className="font-sans text-sm text-[#2d6a4f] hover:underline">
          Go to /operations
        </Link>
      </div>
    )
  }

  // ── Platform admin view ──────────────────────────────────────────────────────

  // Group assignments by supplier
  const bySupplier = allAssignments.reduce<Record<string, OpsAssignmentDetails[]>>((acc, a) => {
    if (!acc[a.supplier_id]) acc[a.supplier_id] = []
    acc[a.supplier_id].push(a)
    return acc
  }, {})

  // Unique suppliers from assignments
  const uniqueSuppliers = Object.keys(bySupplier).map(sid => {
    const rows = bySupplier[sid]
    const first = rows[0]
    return {
      supplier_id: sid,
      supplier_name: first.supplier_name,
      supplier_type: first.supplier_type,
      management_model: first.management_model,
      management_status: first.management_status,
      approval_status: first.approval_status,
      assignees: rows,
    }
  })

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">
            Admin Console · Operations
          </p>
          <h1 className="font-display italic text-3xl text-[#000000]">Managed Suppliers</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">
            Visit Drakensberg Operations team and their supplier assignments.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 border border-gray-200 px-3 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {employees.length > 0 && (
            <button
              onClick={() => setShowAssign(true)}
              className="inline-flex items-center gap-2 border border-gray-200 px-3 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] transition-colors"
            >
              <Plus size={14} /> Assign Supplier
            </button>
          )}
          <button
            onClick={() => setShowCreateSupplier(true)}
            className="inline-flex items-center gap-2 border border-gray-200 px-3 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] transition-colors"
          >
            <PlusCircle size={14} /> Create Supplier
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-4 py-2 font-sans text-sm hover:bg-[#245741] transition-colors"
          >
            <UserPlus size={14} /> Invite Employee
          </button>
        </div>
      </div>

      {/* Operations Employees */}
      <section className="mb-8">
        <h2 className="font-display italic text-xl mb-4 flex items-center gap-2">
          <Users size={16} className="text-[#2d6a4f]" /> Operations Team
          <span className="font-sans text-xs text-gray-400 ml-1">({employees.length})</span>
        </h2>
        {employees.length === 0 ? (
          <div className="bg-white border border-gray-200 p-6 text-center">
            <p className="font-sans text-sm text-gray-400">No VD Operations employees yet. Invite one to get started.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Name', 'Email', 'Role', 'Assigned Suppliers', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map(emp => {
                  const empAssignments = allAssignments.filter(a => a.employee_id === emp.id && a.is_active)
                  return (
                    <tr key={emp.id} className={`hover:bg-[#F7F5F2] ${!emp.setup_complete ? 'opacity-80' : ''}`}>
                      <td className="px-5 py-4 font-sans text-sm">{emp.full_name || '—'}</td>
                      <td className="px-5 py-4 font-sans text-xs text-gray-500">{emp.email}</td>
                      <td className="px-5 py-4">
                        {emp.setup_complete && emp.ops_role ? (
                          <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-[#2d6a4f]/10 text-[#2d6a4f]">
                            {OPS_ROLE_LABEL[emp.ops_role]}
                          </span>
                        ) : (
                          <div>
                            <div className="inline-flex items-center gap-1 font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertCircle size={10} /> Setup Required
                            </div>
                            <SetOpsRoleRow
                              userId={emp.id}
                              currentRole={emp.ops_role}
                              onSaved={load}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-sans text-sm text-gray-600">
                        {!emp.setup_complete
                          ? <span className="text-gray-300 text-xs">—</span>
                          : empAssignments.length === 0
                            ? <span className="text-gray-400 text-xs">None</span>
                            : empAssignments.map(a => a.supplier_name || a.supplier_id).join(', ')}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {emp.setup_complete && (
                            <button
                              onClick={() => setShowAssign(true)}
                              className="inline-flex items-center gap-1 font-sans text-xs text-[#2d6a4f] hover:underline"
                            >
                              <Settings size={12} /> Manage
                            </button>
                          )}
                          <ResendButton userId={emp.id} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Managed Suppliers */}
      <section>
        <h2 className="font-display italic text-xl mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-[#C9A96E]" /> Managed Suppliers
          <span className="font-sans text-xs text-gray-400 ml-1">({uniqueSuppliers.length})</span>
        </h2>
        {uniqueSuppliers.length === 0 ? (
          <div className="bg-white border border-gray-200 p-6 text-center">
            <p className="font-sans text-sm text-gray-400">No supplier assignments yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Supplier', 'Type', 'Model', 'Status', 'Assigned To', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {uniqueSuppliers.map(s => (
                  <tr key={s.supplier_id} className="hover:bg-[#F7F5F2]">
                    <td className="px-5 py-4 font-sans text-sm font-medium">{s.supplier_name ?? s.supplier_id}</td>
                    <td className="px-5 py-4">{typeBadge(s.supplier_type)}</td>
                    <td className="px-5 py-4">{s.management_model ? modelBadge(s.management_model) : '—'}</td>
                    <td className="px-5 py-4 font-sans text-xs text-gray-500">
                      {MANAGEMENT_STATUS_LABEL[s.management_status as keyof typeof MANAGEMENT_STATUS_LABEL] ?? s.management_status ?? '—'}
                    </td>
                    <td className="px-5 py-4 font-sans text-xs text-gray-600">
                      {s.assignees.map(a => a.employee_name || a.employee_email).join(', ')}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/operations/managed-suppliers/${s.supplier_id}`}
                        className="font-sans text-xs text-[#2d6a4f] hover:underline inline-flex items-center gap-1"
                      >
                        View <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showInvite && (
        <InviteEmployeeModal onClose={() => setShowInvite(false)} onInvited={load} />
      )}
      {showAssign && employees.length > 0 && (
        <AssignSupplierModal
          employees={employees}
          onClose={() => setShowAssign(false)}
          onAssigned={load}
        />
      )}
      {showCreateSupplier && (
        <CreateSupplierModal
          onClose={() => setShowCreateSupplier(false)}
          onCreated={() => { setShowCreateSupplier(false); load() }}
        />
      )}
    </div>
  )
}

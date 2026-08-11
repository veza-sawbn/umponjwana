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
import { Building2, Users, Plus, RefreshCw, ChevronRight, UserPlus, Settings } from 'lucide-react'
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

// ─── Assign Supplier Modal ─────────────────────────────────────────────────────

function AssignSupplierModal({
  employees,
  onClose,
  onAssigned,
}: {
  employees: { id: string; full_name: string | null; email: string | null; ops_role: OpsRole | null }[]
  onClose: () => void
  onAssigned: () => void
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '')
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
    const emp = employees.find(e => e.id === employeeId)
    if (emp?.ops_role) {
      setPermissions(DEFAULT_PERMISSIONS_BY_ROLE[emp.ops_role] ?? [])
    }
  }, [employeeId, employees])

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
              {employees.map(e => (
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

  // Admin view: all assignments across all employees
  const [allAssignments, setAllAssignments] = useState<OpsAssignmentDetails[]>([])
  const [employees, setEmployees] = useState<Awaited<ReturnType<typeof getOpsEmployees>>>([])

  // Ops employee view: their own assigned suppliers
  const [mySuppliers, setMySuppliers] = useState<ManagedSupplierSummary[]>([])

  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [showAssign, setShowAssign] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, ops_role, organisation')
      .eq('id', user.id)
      .maybeSingle()

    const admin = profile?.role === 'admin'
    const opsEmp = !admin && profile?.organisation === 'vd_operations' && profile?.ops_role != null

    setIsAdmin(admin)
    setIsOpsEmployee(opsEmp)

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

  // ── VD Operations employee view ──────────────────────────────────────────────
  if (isOpsEmployee) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">
            Visit Drakensberg Operations
          </p>
          <h1 className="font-display italic text-3xl text-[#000000]">Managed Suppliers</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">
            Select a supplier to enter their management tools.
          </p>
        </div>

        {mySuppliers.length === 0 ? (
          <div className="bg-white border border-gray-200 p-10 text-center">
            <Building2 size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="font-sans text-sm text-gray-500">No suppliers assigned to you yet.</p>
            <p className="font-sans text-xs text-gray-400 mt-1">Contact a platform administrator to have suppliers assigned to your account.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {mySuppliers.map(s => (
              <div key={s.supplier_id} className="bg-white border border-gray-200 p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display italic text-lg text-gray-900 leading-tight">{s.supplier_name ?? 'Unnamed Supplier'}</p>
                    <p className="font-sans text-xs text-gray-400 mt-1">{s.supplier_email}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {typeBadge(s.supplier_type)}
                    {modelBadge(s.management_model)}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-sans text-[10px] text-gray-400">
                      {s.permissions.length} permission{s.permissions.length !== 1 ? 's' : ''} ·{' '}
                      {MANAGEMENT_STATUS_LABEL[s.management_status as keyof typeof MANAGEMENT_STATUS_LABEL] ?? s.management_status}
                    </p>
                  </div>
                  <Link
                    href={`/admin/operations/managed-suppliers/${s.supplier_id}`}
                    className="inline-flex items-center gap-1.5 bg-[#2d6a4f] text-white px-3 py-1.5 font-sans text-xs hover:bg-[#245741] transition-colors"
                  >
                    Manage <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
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
        <div className="flex gap-2">
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
                  {['Name', 'Email', 'Role', 'Assigned Suppliers', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map(emp => {
                  const empAssignments = allAssignments.filter(a => a.employee_id === emp.id && a.is_active)
                  return (
                    <tr key={emp.id} className="hover:bg-[#F7F5F2]">
                      <td className="px-5 py-4 font-sans text-sm">{emp.full_name || '—'}</td>
                      <td className="px-5 py-4 font-sans text-xs text-gray-500">{emp.email}</td>
                      <td className="px-5 py-4">
                        {emp.ops_role && (
                          <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-[#2d6a4f]/10 text-[#2d6a4f]">
                            {OPS_ROLE_LABEL[emp.ops_role]}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-sans text-sm text-gray-600">
                        {empAssignments.length === 0
                          ? <span className="text-gray-400 text-xs">None</span>
                          : empAssignments.map(a => a.supplier_name || a.supplier_id).join(', ')}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setShowAssign(true)}
                          className="font-sans text-xs text-[#2d6a4f] hover:underline"
                        >
                          <Settings size={12} className="inline mr-1" />Manage
                        </button>
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
    </div>
  )
}

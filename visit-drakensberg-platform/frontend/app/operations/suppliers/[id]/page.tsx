'use client'

/**
 * /operations/suppliers/[id] — one supplier's workspace.
 *
 * Shows exactly the tools this employee holds permission for on THIS supplier.
 * Opening a tool arms the acting-as context and hands off into the existing
 * supplier portal, so operations staff and the supplier themselves use the
 * same screens — only the entry path and the permission gate differ.
 */

import { useRouter, useParams } from 'next/navigation'
import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, Lock, ExternalLink } from 'lucide-react'
import { useOperations } from '@/lib/operations-context'
import { armManagedSupplier } from '@/lib/managed-supplier-context'
import { ALL_PERMISSIONS } from '@/lib/ops-assignments'
import { mergeNavForTypes } from '@/lib/supplier-config'
import { permissionForRoute } from '@/lib/ops-permissions'
import {
  MANAGEMENT_MODEL_LABEL, MANAGEMENT_STATUS_LABEL,
} from '@/lib/commercial-agreements'

const PERMISSION_LABEL: Record<string, string> = Object.fromEntries(
  ALL_PERMISSIONS.map(p => [p.key, p.label]),
)

export default function SupplierWorkspacePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { loading, getSupplier } = useOperations()

  const supplier = getSupplier(params.id)

  // Tools this supplier's type offers but the employee may not open — shown
  // greyed out so staff understand the boundary rather than wondering where
  // a tool went.
  const lockedTools = useMemo(() => {
    if (!supplier) return []
    const granted = new Set(supplier.permissions ?? [])
    return mergeNavForTypes(supplier.types).filter(
      item => !granted.has(permissionForRoute(item.href)),
    )
  }, [supplier])

  function openTool(href: string) {
    if (!supplier) return
    armManagedSupplier(supplier.supplier_id)
    router.push(href)
  }

  if (loading) {
    return <div className="p-8"><p className="font-sans text-sm text-gray-400">Loading…</p></div>
  }

  if (!supplier) {
    return (
      <div className="p-8">
        <Link
          href="/operations"
          className="inline-flex items-center gap-2 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-4 max-w-xl">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-sans text-sm font-medium text-amber-800">Supplier not assigned to you</p>
            <p className="font-sans text-xs text-amber-700 mt-1 leading-relaxed">
              You don&apos;t have an active management assignment for this supplier. If this is
              unexpected, ask a platform administrator to review your assignments.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const permissions = supplier.permissions ?? []

  return (
    <div className="p-8">
      <Link
        href="/operations"
        className="inline-flex items-center gap-2 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">
          {MANAGEMENT_MODEL_LABEL[supplier.management_model as keyof typeof MANAGEMENT_MODEL_LABEL]
            ?? supplier.management_model}
        </p>
        <h1 className="font-display italic text-3xl text-black">
          {supplier.supplier_name ?? 'Unnamed Supplier'}
        </h1>
        <p className="font-sans text-sm text-gray-500 mt-1">
          {supplier.types.join(' · ')}
          {' · '}
          {MANAGEMENT_STATUS_LABEL[supplier.management_status as keyof typeof MANAGEMENT_STATUS_LABEL]
            ?? supplier.management_status}
        </p>
      </div>

      {/* Available tools */}
      <section className="mb-8">
        <h2 className="font-display italic text-xl mb-1">Your Tools</h2>
        <p className="font-sans text-sm text-gray-500 mb-4">
          Opening a tool switches you into this supplier&apos;s portal.
        </p>

        {supplier.tools.length === 0 ? (
          <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-4 max-w-xl">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-sans text-sm font-medium text-amber-800">No tools granted</p>
              <p className="font-sans text-xs text-amber-700 mt-1 leading-relaxed">
                You are assigned to this supplier but hold no permissions that open a tool.
                A platform administrator can adjust your permissions for this assignment.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {supplier.tools.map(tool => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.href}
                  onClick={() => openTool(tool.href)}
                  className="bg-white border border-gray-200 p-4 text-left hover:border-[#2d6a4f] transition-colors group"
                >
                  <span className="flex items-center justify-between mb-3">
                    <Icon size={16} className="text-[#2d6a4f]" />
                    <ExternalLink
                      size={12}
                      className="text-gray-200 group-hover:text-[#2d6a4f] transition-colors"
                    />
                  </span>
                  <span className="block font-sans text-sm text-gray-900">{tool.label}</span>
                  <span className="block font-sans text-[10px] text-gray-400 mt-1">
                    {PERMISSION_LABEL[permissionForRoute(tool.href)] ?? permissionForRoute(tool.href)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Locked tools — transparency about the permission boundary */}
      {lockedTools.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display italic text-xl mb-1">Not Granted</h2>
          <p className="font-sans text-sm text-gray-500 mb-4">
            This supplier has these tools, but your assignment doesn&apos;t include them.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {lockedTools.map(tool => (
              <div
                key={tool.href}
                className="bg-gray-50 border border-gray-100 p-4 opacity-60 cursor-not-allowed"
                title={`Requires: ${PERMISSION_LABEL[permissionForRoute(tool.href)] ?? permissionForRoute(tool.href)}`}
              >
                <Lock size={14} className="text-gray-300 mb-3" />
                <span className="block font-sans text-sm text-gray-400">{tool.label}</span>
                <span className="block font-sans text-[10px] text-gray-300 mt-1">
                  {PERMISSION_LABEL[permissionForRoute(tool.href)] ?? permissionForRoute(tool.href)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Permission summary */}
      <section>
        <h2 className="font-display italic text-xl mb-4">Your Permissions Here</h2>
        <div className="bg-white border border-gray-200 p-5">
          <div className="flex flex-wrap gap-2">
            {permissions.length === 0 ? (
              <p className="font-sans text-sm text-gray-400">No permissions granted.</p>
            ) : (
              permissions.map(p => (
                <span
                  key={p}
                  className="font-sans text-[11px] px-2.5 py-1 bg-[#2d6a4f]/8 text-[#2d6a4f]"
                >
                  {PERMISSION_LABEL[p] ?? p}
                </span>
              ))
            )}
          </div>
          <p className="font-sans text-[11px] text-gray-400 mt-4 leading-relaxed">
            Permissions are set per supplier by a platform administrator. They govern this
            supplier only — your access to other suppliers is configured separately.
          </p>
        </div>
      </section>
    </div>
  )
}

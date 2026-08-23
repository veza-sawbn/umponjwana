'use client'

/**
 * ManagedSupplierBanner
 *
 * Displayed when a VD Operations employee is actively managing a specific
 * supplier. Provides clear context about which supplier they are operating,
 * and a safe switch / exit mechanism to prevent accidental cross-supplier edits.
 */

import { Building2, ChevronDown, X, ArrowLeft } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useManagedSupplier } from '@/lib/managed-supplier-context'
import { SUPPLIER_CONFIG } from '@/lib/supplier-config'

export default function ManagedSupplierBanner() {
  const {
    isActingAs,
    isOpsEmployee,
    activeSupplierId,
    activeSupplierName,
    activeSupplierType,
    assignedSuppliers,
    selectSupplier,
    clearSelection,
  } = useManagedSupplier()

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!isOpsEmployee) return null

  if (!isActingAs) {
    // Show a compact "select supplier to manage" prompt
    return (
      <div className="bg-[#1a1a2e] border-b border-[#C9A96E]/20 px-4 py-2 flex items-center gap-3">
        <Building2 size={14} className="text-[#C9A96E] shrink-0" />
        <p className="font-sans text-xs text-white/50">
          Visit Drakensberg Operations ·{' '}
          <Link
            href="/operations"
            className="text-[#C9A96E] hover:text-[#C9A96E]/80"
          >
            Select a supplier to manage
          </Link>
        </p>
      </div>
    )
  }

  const typeLabel = activeSupplierType ? SUPPLIER_CONFIG[activeSupplierType]?.label : null

  return (
    <div className="bg-[#1a1a2e] border-b border-[#C9A96E]/30 px-4 py-2.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Building2 size={14} className="text-[#C9A96E] shrink-0" />
        <div className="min-w-0">
          <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-[#C9A96E]/70">
            Visit Drakensberg Operations · Managing
          </p>
          <p className="font-sans text-sm font-medium text-white truncate">
            {activeSupplierName ?? activeSupplierId}
            {typeLabel && (
              <span className="ml-2 font-sans text-[10px] tracking-[0.1em] uppercase text-white/40">
                {typeLabel}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0" ref={ref}>
        {/* Supplier switcher */}
        {assignedSuppliers.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 font-sans text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
            >
              Switch <ChevronDown size={12} />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1 bg-[#111111] border border-white/10 shadow-xl z-50 min-w-[220px]">
                <p className="px-3 py-2 font-sans text-[10px] tracking-[0.12em] uppercase text-white/30 border-b border-white/8">
                  Switch Supplier
                </p>
                {assignedSuppliers.map(s => (
                  <button
                    key={s.supplier_id}
                    onClick={() => {
                      selectSupplier(s.supplier_id)
                      setOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2.5 font-sans text-sm transition-colors ${
                      s.supplier_id === activeSupplierId
                        ? 'bg-[#C9A96E]/10 text-[#C9A96E]'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {s.supplier_name ?? s.supplier_id}
                    {s.supplier_type && (
                      <span className="block font-sans text-[10px] text-white/30 mt-0.5">
                        {s.supplier_type}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Back to operations dashboard */}
        <Link
          href="/operations"
          className="flex items-center gap-1.5 px-2.5 py-1.5 font-sans text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
        >
          <ArrowLeft size={12} /> Overview
        </Link>

        {/* Clear selection */}
        <button
          onClick={clearSelection}
          title="Exit supplier management mode"
          className="p-1.5 text-white/30 hover:text-white/70 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

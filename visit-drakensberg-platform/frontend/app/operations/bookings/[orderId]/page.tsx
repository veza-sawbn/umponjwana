'use client'

/**
 * /operations/bookings/[orderId] — one booking's itinerary.
 *
 * Ops staff land here from the consolidated bookings queue. Shows every line
 * item on the order that RLS lets this employee see (scoped to suppliers
 * they hold view_bookings on — a line for a supplier outside that scope
 * simply doesn't appear, which is the correct behaviour, not a bug).
 *
 * For any line not yet fulfilled, staff with manage_bookings on that line's
 * supplier can appoint one of the supplier's own guides/drivers to deliver
 * it — the appointee is emailed directly (see assignLineStaff()).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowLeft, CalendarDays, AlertCircle, UserPlus, X, Mail, User2,
} from 'lucide-react'
import { useOperations } from '@/lib/operations-context'
import {
  getOrderLines, setLineFulfilment, assignLineStaff, clearLineStaff, type OrderLine,
} from '@/lib/orders'
import { getSupplierEntities, type SupplierEntity } from '@/lib/supplier-entities'

const FULFILMENT_CHIP: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-emerald-50 text-emerald-700',
  in_progress: 'bg-blue-50 text-blue-600',
  fulfilled: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  cancelled: 'bg-red-50 text-red-600',
}

const FULFILMENT_OPTIONS = ['pending', 'confirmed', 'in_progress', 'fulfilled', 'cancelled']
const EXECUTED = new Set(['fulfilled', 'cancelled'])

type RosterEntry = { kind: 'guides' | 'drivers'; id: string; name: string; email?: string }
type RosterRow = SupplierEntity & { name?: string; fullName?: string; email?: string }

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function money(n: number, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency, maximumFractionDigits: 0 })
    .format(n ?? 0)
}

export default function BookingItineraryPage() {
  const params = useParams<{ orderId: string }>()
  const { loading: ctxLoading, can, getSupplier } = useOperations()
  const [lines, setLines] = useState<OrderLine[]>([])
  const [loading, setLoading] = useState(true)
  const [assigningLine, setAssigningLine] = useState<string | null>(null)
  const [roster, setRoster] = useState<Record<string, RosterEntry[]>>({})
  const [rosterLoading, setRosterLoading] = useState(false)
  const [busyLine, setBusyLine] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setLines(await getOrderLines(params.orderId))
    setLoading(false)
  }

  useEffect(() => { load() }, [params.orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function openAssign(line: OrderLine) {
    setAssigningLine(line.id)
    const supplierId = line.supplier_id
    if (!supplierId || roster[supplierId]) return
    setRosterLoading(true)
    try {
      const [guides, drivers] = await Promise.all([
        getSupplierEntities<RosterRow>('guides', supplierId),
        getSupplierEntities<RosterRow>('drivers', supplierId),
      ])
      const entries: RosterEntry[] = [
        ...guides.map(g => ({ kind: 'guides' as const, id: g.id, name: g.name ?? g.fullName ?? 'Guide', email: g.email })),
        ...drivers.map(d => ({ kind: 'drivers' as const, id: d.id, name: d.name ?? d.fullName ?? 'Driver', email: d.email })),
      ]
      setRoster(r => ({ ...r, [supplierId]: entries }))
    } finally {
      setRosterLoading(false)
    }
  }

  async function doAssign(line: OrderLine, entry: RosterEntry) {
    setBusyLine(line.id)
    try {
      const { assigned, emailed } = await assignLineStaff(line.id, entry.kind, entry.id)
      toast.success(
        emailed
          ? `${assigned.name} appointed — notified by email.`
          : `${assigned.name} appointed, but the email could not be sent.`,
      )
      setAssigningLine(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not appoint staff.')
    } finally {
      setBusyLine(null)
    }
  }

  async function doClear(line: OrderLine) {
    setBusyLine(line.id)
    try {
      await clearLineStaff(line.id)
      await load()
    } catch {
      toast.error('Could not clear the assignment.')
    } finally {
      setBusyLine(null)
    }
  }

  async function changeFulfilment(line: OrderLine, status: string) {
    try {
      await setLineFulfilment(line.id, status)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed.')
    }
  }

  if (ctxLoading || loading) {
    return <div className="p-4 sm:p-6 lg:p-8"><p className="font-sans text-sm text-gray-400">Loading…</p></div>
  }

  const header = lines[0]

  if (!header) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Link
          href="/operations/bookings"
          className="inline-flex items-center gap-2 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to bookings
        </Link>
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-4 max-w-xl">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-sans text-sm font-medium text-amber-800">Nothing to show</p>
            <p className="font-sans text-xs text-amber-700 mt-1 leading-relaxed">
              Either this booking doesn&apos;t exist, or none of its line items belong to a supplier
              you hold View Bookings on.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const total = lines.reduce((sum, l) => sum + (l.gross_amount ?? 0), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link
        href="/operations/bookings"
        className="inline-flex items-center gap-2 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to bookings
      </Link>

      <div className="mb-6">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">
          {header.order_number}
        </p>
        <h1 className="font-display italic text-3xl text-black flex items-center gap-2">
          <CalendarDays size={22} className="text-[#C9A96E]" /> {header.customer_name || 'Guest itinerary'}
        </h1>
        <p className="font-sans text-sm text-gray-500 mt-1">
          {lines.length} item{lines.length !== 1 ? 's' : ''} · {money(total, header.currency)} gross
        </p>
      </div>

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="border-b border-gray-100">
              {['Supplier', 'Item', 'Service Date', 'Status', 'Assigned Staff', ''].map(h => (
                <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map(l => {
              const manage = !!l.supplier_id && can(l.supplier_id, 'manage_bookings')
              const executed = EXECUTED.has(l.fulfilment_status)
              const supplierName = (l.supplier_id && getSupplier(l.supplier_id)?.supplier_name) || l.supplier_name

              return (
                <tr key={l.id} className="align-top">
                  <td className="px-5 py-4 font-sans text-xs text-gray-500">{supplierName}</td>
                  <td className="px-5 py-4">
                    <p className="font-sans text-sm text-gray-900">{l.title}</p>
                    <p className="font-sans text-[11px] text-gray-400 mt-0.5 capitalize">{l.category}</p>
                  </td>
                  <td className="px-5 py-4 font-sans text-xs text-gray-500 whitespace-nowrap">
                    {fmt(l.service_date)}{l.end_date ? ` → ${fmt(l.end_date)}` : ''}
                  </td>
                  <td className="px-5 py-4">
                    {manage ? (
                      <select
                        value={l.fulfilment_status}
                        onChange={e => changeFulfilment(l, e.target.value)}
                        className="border border-gray-200 bg-white px-2 py-1 font-sans text-[11px] focus:outline-none"
                      >
                        {FULFILMENT_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    ) : (
                      <span
                        className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 ${
                          FULFILMENT_CHIP[l.fulfilment_status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {l.fulfilment_status.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {l.assigned_name ? (
                      <div>
                        <p className="font-sans text-sm text-gray-800 flex items-center gap-1.5">
                          <User2 size={12} className="text-[#2d6a4f]" /> {l.assigned_name}
                        </p>
                        <p className="font-sans text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Mail size={10} /> {l.assigned_email}
                        </p>
                      </div>
                    ) : (
                      <span className="font-sans text-xs text-gray-300">Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {manage && !executed && l.supplier_id && (
                      assigningLine === l.id ? (
                        <div className="border border-gray-200 bg-[#F7F5F2] p-3 w-64">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">
                              Appoint staff
                            </p>
                            <button onClick={() => setAssigningLine(null)} className="text-gray-400 hover:text-gray-600">
                              <X size={13} />
                            </button>
                          </div>
                          {rosterLoading && !roster[l.supplier_id] ? (
                            <p className="font-sans text-xs text-gray-400">Loading roster…</p>
                          ) : (roster[l.supplier_id] ?? []).length === 0 ? (
                            <p className="font-sans text-xs text-gray-400 leading-relaxed">
                              This supplier has no guides or drivers registered yet.
                            </p>
                          ) : (
                            <div className="space-y-1 max-h-44 overflow-y-auto">
                              {(roster[l.supplier_id] ?? []).map(r => (
                                <button
                                  key={`${r.kind}-${r.id}`}
                                  disabled={!r.email || busyLine === l.id}
                                  onClick={() => doAssign(l, r)}
                                  title={!r.email ? 'No email on file for this person' : undefined}
                                  className="w-full text-left px-2.5 py-1.5 font-sans text-xs bg-white border border-gray-100 hover:border-[#2d6a4f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {r.name}
                                  <span className="block text-[10px] text-gray-400 capitalize">
                                    {r.kind === 'guides' ? 'Guide' : 'Driver'}{!r.email ? ' · no email on file' : ''}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openAssign(l)}
                            disabled={busyLine === l.id}
                            className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline whitespace-nowrap"
                          >
                            <UserPlus size={12} /> {l.assigned_name ? 'Reassign' : 'Assign staff'}
                          </button>
                          {l.assigned_name && (
                            <button
                              onClick={() => doClear(l)}
                              disabled={busyLine === l.id}
                              className="font-sans text-xs text-gray-400 hover:text-red-500 whitespace-nowrap"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Search, RefreshCw, X, Building2, ShieldCheck, UserPlus, Copy, Ban, Check,
} from 'lucide-react'
import {
  getRoles, getRolePermissions, getPermissions, getEstablishmentAccess,
  getInvitations, inviteEstablishmentUser, revokeAccess, setAccess,
  HANDOVER_CEILING, HANDOVER_LABEL,
  type Role, type Permission, type EstablishmentAccess, type Invitation,
  type HandoverLevel, type PermissionKey,
} from '@/lib/partner-access'
import { supabase } from '@/lib/auth'

// Supplier access assignment — the handover console.
//
// Deliberately NOT called ownership transfer: Visit Drakensberg stays the
// platform administrator afterwards. Revoking access leaves the listing and
// all of its content exactly where they are.
//
// Every control here is a convenience over rules the database enforces on its
// own (see lib/partner-access.ts). Nothing shown or hidden in this page grants
// or withholds anything by itself.

type Establishment = {
  id: string
  kind: string
  status: string
  owner_id: string | null
  value: Record<string, unknown>
}

const ESTABLISHMENT_KINDS = ['property', 'activity', 'tour', 'transport_company', 'package']

function estName(e: Establishment): string {
  const v = e.value ?? {}
  return String(v.name ?? v.title ?? v.trading_name ?? e.id)
}

function AssignModal({ establishment, roles, rolePermissions, permissions, onClose, onDone }: {
  establishment: Establishment
  roles: Role[]
  rolePermissions: Record<string, PermissionKey[]>
  permissions: Permission[]
  onClose: () => void
  onDone: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('supplier_owner')
  const [handover, setHandover] = useState<HandoverLevel>('managed')
  const [autoPublish, setAutoPublish] = useState(false)
  const [extra, setExtra] = useState<PermissionKey[]>([])
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<{ token: string } | null>(null)

  const ceiling = HANDOVER_CEILING[handover]
  const supplierPerms = useMemo(
    () => permissions.filter(p => !p.platform_only),
    [permissions],
  )

  // Mirrors vd_effective_permissions: role ∩ ceiling, then explicit extras,
  // re-clamped to the ceiling. The database repeats this on every write.
  const effective = useMemo(() => {
    const fromRole = (rolePermissions[role] ?? []).filter(p => ceiling.includes(p))
    return [...new Set([...fromRole, ...extra.filter(p => ceiling.includes(p))])].sort()
  }, [role, ceiling, extra, rolePermissions])

  async function submit() {
    if (!email.trim() || !email.includes('@')) { toast.error('Enter the partner’s email address.'); return }
    setBusy(true)
    try {
      const res = await inviteEstablishmentUser({
        establishmentId: establishment.id,
        email: email.trim(),
        role,
        handoverLevel: handover,
        permissions: extra,
        autoPublish,
      })
      setIssued({ token: res.token })
      toast.success('Invitation created.')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the invitation')
    } finally { setBusy(false) }
  }

  const link = issued ? `${typeof window !== 'undefined' ? window.location.origin : ''}/partner/accept?token=${issued.token}` : ''

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white max-w-3xl w-full max-h-[88vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Supplier access</p>
            <h2 className="font-display italic text-2xl">Assign a partner</h2>
            <p className="font-sans text-sm text-gray-500 mt-1">{estName(establishment)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        {issued ? (
          <div className="space-y-4">
            <div className="border border-[#2d6a4f]/30 bg-[#2d6a4f]/5 p-4">
              <p className="font-sans text-sm text-[#2d6a4f] mb-2 flex items-center gap-2">
                <Check size={15} /> Invitation created
              </p>
              <p className="font-sans text-xs text-gray-500 mb-3">
                Send this link to {email}. It expires in 14 days, can be used once, and only by an
                account registered to that address.
              </p>
              <div className="flex gap-2">
                <input readOnly value={link} className="flex-1 border border-gray-200 px-3 py-2 font-mono text-[11px] bg-white" />
                <button
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(link); toast.success('Link copied.') }
                    catch { toast.error('Could not copy — select the link and copy manually.') }
                  }}
                  className="inline-flex items-center gap-1.5 border border-gray-200 px-3 py-2 font-sans text-xs hover:border-[#2d6a4f] hover:text-[#2d6a4f]">
                  <Copy size={13} /> Copy
                </button>
              </div>
            </div>
            <button onClick={onClose} className="px-6 py-3 bg-[#2d6a4f] text-white font-sans text-sm hover:bg-[#245741]">Done</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Partner email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@lodge.co.za"
                  className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Role</label>
                <select value={role} onChange={e => setRole(e.target.value)}
                  className="w-full border border-gray-200 bg-white px-3 py-2.5 font-sans text-sm focus:outline-none">
                  {roles.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">Handover level</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {(['managed', 'self_managed'] as HandoverLevel[]).map(level => (
                <button key={level} onClick={() => setHandover(level)}
                  className={`text-left border p-4 transition-colors ${handover === level ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="font-sans text-sm text-gray-800">{HANDOVER_LABEL[level]}</p>
                  <p className="font-sans text-xs text-gray-500 mt-1">
                    {level === 'managed'
                      ? 'View the listing, submit corrections, respond to enquiries, view bookings.'
                      : 'Edit the listing, manage rooms, photos, availability, rates, offers and bookings.'}
                  </p>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 mb-5">
              <button type="button" onClick={() => setAutoPublish(v => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${autoPublish ? 'bg-[#2d6a4f]' : 'bg-black/20'}`}>
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${autoPublish ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <span className="font-sans text-sm text-gray-700">
                Publish their changes immediately
                <span className="text-gray-400 font-normal"> — otherwise edits queue for review</span>
              </span>
            </div>

            <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">
              Sections they may edit
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mb-4">
              {supplierPerms.map(p => {
                const inRole = (rolePermissions[role] ?? []).includes(p.key)
                const reachable = ceiling.includes(p.key)
                const on = effective.includes(p.key)
                return (
                  <button key={p.key} disabled={!reachable}
                    onClick={() => setExtra(x => x.includes(p.key) ? x.filter(k => k !== p.key) : [...x, p.key])}
                    className={`text-left px-2.5 py-1.5 font-sans text-xs border transition-colors ${
                      !reachable ? 'border-gray-100 text-gray-300 cursor-not-allowed line-through'
                      : on ? 'border-[#2d6a4f] bg-[#2d6a4f]/5 text-[#2d6a4f]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    title={!reachable ? 'Not available at this handover level' : inRole ? 'Included in the role' : 'Added for this partner'}>
                    {p.label}
                  </button>
                )
              })}
            </div>
            <p className="font-sans text-xs text-gray-400 mb-6">
              Struck-through items are outside the {HANDOVER_LABEL[handover].toLowerCase()} level. Publishing,
              commission and platform settings are never available to a partner at any level — the database
              rejects them even if requested directly.
            </p>

            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
              <button onClick={onClose} className="px-5 py-3 border border-gray-200 font-sans text-sm text-gray-600 hover:border-gray-300">Cancel</button>
              <button onClick={submit} disabled={busy}
                className={`inline-flex items-center gap-2 px-6 py-3 font-sans text-sm transition-colors ${busy ? 'bg-gray-100 text-gray-400' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}>
                <UserPlus size={14} /> {busy ? 'Creating…' : 'Send invitation'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AccessPanel({ establishment, roles, onClose }: {
  establishment: Establishment
  roles: Role[]
  onClose: () => void
}) {
  const [access, setAccessRows] = useState<EstablishmentAccess[]>([])
  const [invites, setInvites] = useState<Invitation[]>([])
  const [people, setPeople] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [a, i] = await Promise.all([
      getEstablishmentAccess(establishment.id),
      getInvitations(establishment.id),
    ])
    setAccessRows(a); setInvites(i)
    try {
      const ids = [...new Set(a.map(r => r.user_id))]
      if (ids.length) {
        const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', ids)
        const map: Record<string, string> = {}
        for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
          map[p.id] = p.full_name || p.email || p.id
        }
        setPeople(map)
      }
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [establishment.id])

  async function handleRevoke(row: EstablishmentAccess) {
    try {
      await revokeAccess(row.id, 'revoked from console')
      toast.success('Access revoked. The listing is unchanged.')
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not revoke access') }
  }

  async function handleLevel(row: EstablishmentAccess, level: HandoverLevel) {
    try {
      await setAccess(row.id, { handoverLevel: level })
      toast.success(`Handover level set to ${HANDOVER_LABEL[level].toLowerCase()}.`)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not change the level') }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white max-w-3xl w-full max-h-[88vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Supplier access</p>
            <h2 className="font-display italic text-2xl">{estName(establishment)}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        {loading ? <p className="font-sans text-sm text-gray-400 py-8 text-center">Loading…</p> : (
          <>
            <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">Assigned partners</p>
            {access.length === 0 ? (
              <p className="font-sans text-sm text-gray-400 py-6 border border-gray-100 text-center mb-6">
                Managed by Visit Drakensberg · supplier access not assigned
              </p>
            ) : (
              <div className="border border-gray-200 divide-y divide-gray-100 mb-6">
                {access.map(row => (
                  <div key={row.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-sans text-sm text-gray-800">{people[row.user_id] ?? row.user_id}</p>
                      <p className="font-sans text-xs text-gray-500 mt-0.5">
                        {roles.find(r => r.key === row.role_key)?.label ?? row.role_key}
                        {' · '}{HANDOVER_LABEL[row.handover_level]}
                        {row.auto_publish ? ' · publishes immediately' : ' · edits reviewed'}
                      </p>
                      <span className={`inline-block mt-1.5 font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 ${
                        row.access_status === 'active' ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]' : 'bg-gray-100 text-gray-500'}`}>
                        {row.access_status}
                      </span>
                    </div>
                    {row.access_status === 'active' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <select value={row.handover_level}
                          onChange={e => handleLevel(row, e.target.value as HandoverLevel)}
                          className="border border-gray-200 bg-white px-2 py-1.5 font-sans text-xs focus:outline-none">
                          <option value="managed">Managed</option>
                          <option value="self_managed">Self-managed</option>
                        </select>
                        <button onClick={() => handleRevoke(row)}
                          className="inline-flex items-center gap-1.5 font-sans text-xs text-red-400 hover:underline">
                          <Ban size={12} /> Revoke
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {invites.length > 0 && (
              <>
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">Invitations</p>
                <div className="border border-gray-200 divide-y divide-gray-100">
                  {invites.map(i => (
                    <div key={i.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-sans text-sm text-gray-700">{i.email}</p>
                        <p className="font-sans text-xs text-gray-400">
                          {i.role_key} · {i.handover_level} · expires {new Date(i.expires_at).toLocaleDateString('en-ZA')}
                        </p>
                      </div>
                      <span className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{i.status}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function AdminPartnersPage() {
  const [establishments, setEstablishments] = useState<Establishment[]>([])
  const [accessCounts, setAccessCounts] = useState<Record<string, number>>({})
  const [roles, setRoles] = useState<Role[]>([])
  const [rolePermissions, setRolePermissions] = useState<Record<string, PermissionKey[]>>({})
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<Establishment | undefined>()
  const [viewing, setViewing] = useState<Establishment | undefined>()

  async function load() {
    setLoading(true)
    const [ents, r, rp, p] = await Promise.all([
      (async () => {
        try {
          const { data } = await supabase
            .from('vd_entities').select('id, kind, status, owner_id, value')
            .in('kind', ESTABLISHMENT_KINDS)
            .order('created_at', { ascending: false })
          return Array.isArray(data) ? data as Establishment[] : []
        } catch { return [] }
      })(),
      getRoles('supplier'),
      getRolePermissions(),
      getPermissions(),
    ])
    setEstablishments(ents); setRoles(r); setRolePermissions(rp); setPermissions(p)
    try {
      const { data } = await supabase
        .from('vd_establishment_access').select('establishment_id').eq('access_status', 'active')
      const counts: Record<string, number> = {}
      for (const row of (data ?? []) as { establishment_id: string }[]) {
        counts[row.establishment_id] = (counts[row.establishment_id] ?? 0) + 1
      }
      setAccessCounts(counts)
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => establishments.filter(e =>
    `${estName(e)} ${e.kind}`.toLowerCase().includes(search.toLowerCase())
  ), [establishments, search])

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Supplier Access</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">
            Assign partners to establishments. Visit Drakensberg remains the platform administrator —
            revoking access never removes the listing.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 font-sans text-sm text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-2 mb-6 max-w-md">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search establishments…"
          className="flex-1 font-sans text-sm focus:outline-none" />
      </div>

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead><tr className="border-b border-gray-100">
            {['Establishment', 'Type', 'Status', 'Supplier access', ''].map(h =>
              <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(e => {
              const assigned = accessCounts[e.id] ?? 0
              return (
                <tr key={e.id} className="hover:bg-[#F7F5F2] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-gray-300 shrink-0" />
                      <span className="font-sans text-sm text-gray-800">{estName(e)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-sans text-xs text-gray-500 capitalize">{e.kind.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-4">
                    <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-1 bg-gray-100 text-gray-500">{e.status}</span>
                  </td>
                  <td className="px-5 py-4">
                    {assigned === 0 ? (
                      <span className="font-sans text-xs text-gray-400">Managed by Visit Drakensberg</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f]">
                        <ShieldCheck size={12} /> {assigned} partner{assigned === 1 ? '' : 's'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 justify-end">
                      <button onClick={() => setViewing(e)} className="font-sans text-xs text-[#2d6a4f] hover:underline">Manage</button>
                      <button onClick={() => setAssigning(e)} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline">
                        <UserPlus size={12} /> Assign
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center font-sans text-sm text-gray-400">No establishments found.</td></tr>}
            {loading && <tr><td colSpan={5} className="px-5 py-12 text-center font-sans text-sm text-gray-400">Loading…</td></tr>}
          </tbody>
        </table>
      </div>

      {assigning && (
        <AssignModal establishment={assigning} roles={roles} rolePermissions={rolePermissions}
          permissions={permissions} onClose={() => setAssigning(undefined)} onDone={load} />
      )}
      {viewing && (
        <AccessPanel establishment={viewing} roles={roles} onClose={() => { setViewing(undefined); load() }} />
      )}
    </div>
  )
}

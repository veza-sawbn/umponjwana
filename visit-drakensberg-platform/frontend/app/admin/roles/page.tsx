'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, Shield, X } from 'lucide-react'
import { supabase } from '@/lib/auth'
import {
  getCollaborators, setCollaboratorLevel, inviteCollaborator, collaboratorLevel,
  type Collaborator, type CollaboratorLevel,
} from '@/lib/collaborators'

// Roles & Permissions: invite collaborators (via Supabase Auth's built-in
// invite email — requires SMTP configured on the Supabase project) and
// manage their access level. Three levels, all backed by the existing
// profiles.role / staff_role columns — no new role model invented:
//   Administrator — full console access
//   Finance       — finance module only (payments, invoices, settlements)
//   Operations    — operations module only (bookings, fulfilment)

const LEVELS: { value: CollaboratorLevel; label: string; desc: string }[] = [
  { value: 'admin', label: 'Administrator', desc: 'Full access to every admin console module, including managing other collaborators.' },
  { value: 'finance', label: 'Finance', desc: 'Invoices, payments, settlements, financial reporting.' },
  { value: 'operations', label: 'Operations', desc: 'Bookings, orders, fulfilment, operational reporting.' },
]

const LEVEL_BADGE: Record<CollaboratorLevel, string> = {
  admin: 'bg-[#C9A96E]/15 text-[#8B6914]',
  finance: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  operations: 'bg-blue-50 text-blue-600',
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [level, setLevel] = useState<CollaboratorLevel>('operations')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error('Enter a valid email address.'); return }
    setBusy(true)
    try {
      await inviteCollaborator({ email: email.trim(), fullName: fullName.trim(), level })
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
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Roles & Permissions</p>
            <h2 className="font-display italic text-2xl">Invite Collaborator</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Full Name (optional)</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Access Level</label>
            <div className="space-y-2">
              {LEVELS.map(l => (
                <label key={l.value} className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${level === l.value ? 'border-[#2d6a4f] bg-[#2d6a4f]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="level" checked={level === l.value} onChange={() => setLevel(l.value)} className="mt-1 accent-[#2d6a4f]" />
                  <span>
                    <span className="block font-sans text-sm font-medium text-gray-800">{l.label}</span>
                    <span className="block font-sans text-xs text-gray-400 mt-0.5">{l.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <button onClick={submit} disabled={busy}
          className={`w-full mt-6 py-3 font-sans text-sm transition-colors ${busy ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}>
          {busy ? 'Sending invite…' : 'Send Invite'}
        </button>
        <p className="font-sans text-[11px] text-gray-400 mt-3 leading-relaxed">
          Sends a Supabase Auth invite email so they can set their own password. This requires SMTP to be configured on the project — if it isn't, the account is still created but no email goes out.
        </p>
      </div>
    </div>
  )
}

export default function RolesPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [me, setMe] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [rows, { data: { user } }] = await Promise.all([getCollaborators(), supabase.auth.getUser()])
    setCollaborators(rows)
    setMe(user?.id ?? null)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function changeLevel(userId: string, level: CollaboratorLevel | null) {
    setBusyId(userId)
    try {
      await setCollaboratorLevel(userId, level)
      toast.success(level ? 'Access level updated.' : 'Access revoked.')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update access')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Roles & Permissions</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Invite collaborators to work on this site and control what they can access.</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-4 py-2 font-sans text-sm hover:bg-[#245741] transition-colors">
          <UserPlus size={14} /> Invite Collaborator
        </button>
      </div>

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead><tr className="border-b border-gray-100">
            {['Name', 'Email', 'Level', 'Joined', ''].map(h =>
              <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {collaborators.map(c => {
              const level = collaboratorLevel(c)
              const isSelf = c.id === me
              return (
                <tr key={c.id} className="hover:bg-[#F7F5F2] transition-colors">
                  <td className="px-5 py-4 font-sans text-sm text-gray-800">{c.full_name || '—'}{isSelf && <span className="ml-2 font-sans text-[10px] text-gray-400 uppercase tracking-wide">(you)</span>}</td>
                  <td className="px-5 py-4 font-sans text-xs text-gray-500">{c.email}</td>
                  <td className="px-5 py-4">
                    {level && <span className={`font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${LEVEL_BADGE[level]}`}>{LEVELS.find(l => l.value === level)?.label}</span>}
                  </td>
                  <td className="px-5 py-4 font-sans text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-5 py-4">
                    {isSelf ? (
                      <span className="font-sans text-xs text-gray-300">Manage your own access from another admin account</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={level ?? ''}
                          disabled={busyId === c.id}
                          onChange={e => changeLevel(c.id, (e.target.value || null) as CollaboratorLevel | null)}
                          className="border border-gray-200 bg-white px-2 py-1.5 font-sans text-xs focus:outline-none disabled:opacity-50"
                        >
                          <option value="">No access</option>
                          {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </select>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {!loading && collaborators.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center font-sans text-sm text-gray-400">
                <Shield size={20} className="mx-auto mb-2 text-gray-300" />
                No collaborators yet — invite one above.
              </td></tr>
            )}
            {loading && <tr><td colSpan={5} className="px-5 py-12 text-center font-sans text-sm text-gray-400">Loading collaborators…</td></tr>}
          </tbody>
        </table>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={load} />}
    </div>
  )
}

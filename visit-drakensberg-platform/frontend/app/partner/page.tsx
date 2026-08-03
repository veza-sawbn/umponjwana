'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, ShieldCheck, Eye, Pencil } from 'lucide-react'
import {
  getMyAccess, getMyPermissions, HANDOVER_LABEL,
  type EstablishmentAccess, type PermissionKey,
} from '@/lib/partner-access'
import { supabase } from '@/lib/auth'
import Logo from '@/components/Logo'

// Partner dashboard — the establishments assigned to the signed-in user.
//
// The list comes from vd_establishment_access filtered by RLS to the caller's
// own rows, so an account with no assignments genuinely sees nothing: there is
// no "all establishments" query here to accidentally widen. Permission badges
// are resolved by the database (vd_effective_permissions) rather than inferred
// from the role, so what is shown matches what the server will actually allow.

type Row = EstablishmentAccess & {
  name: string
  kind: string
  permissions: PermissionKey[]
}

export default function PartnerDashboard() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const access = await getMyAccess()
      if (access.length === 0) { setRows([]); setLoading(false); return }

      const ids = access.map(a => a.establishment_id)
      let entities: Record<string, { name: string; kind: string }> = {}
      try {
        const { data } = await supabase
          .from('vd_entities').select('id, kind, value').in('id', ids)
        for (const e of (data ?? []) as { id: string; kind: string; value: Record<string, unknown> }[]) {
          entities[e.id] = {
            name: String(e.value?.name ?? e.value?.title ?? e.id),
            kind: e.kind,
          }
        }
      } catch {}

      const withPerms = await Promise.all(access.map(async a => ({
        ...a,
        name: entities[a.establishment_id]?.name ?? a.establishment_id,
        kind: entities[a.establishment_id]?.kind ?? '',
        permissions: await getMyPermissions(a.establishment_id),
      })))
      setRows(withPerms)
      setLoading(false)
    })()
  }, [])

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <div className="bg-black px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Logo className="w-40 text-white" />
          <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E]">Partner portal</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-10">
        <h1 className="font-display italic text-3xl mb-1">My establishments</h1>
        <p className="font-sans text-sm text-gray-500 mb-8">
          Listings you have been given access to manage on Visit Drakensberg.
        </p>

        {loading ? (
          <p className="font-sans text-sm text-gray-400 py-12 text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-gray-200 p-10 text-center">
            <Building2 size={22} className="text-gray-300 mx-auto mb-3" />
            <p className="font-sans text-sm text-gray-600 mb-1">No establishments assigned yet</p>
            <p className="font-sans text-xs text-gray-400">
              When Visit Drakensberg assigns you an establishment, it will appear here. If you were sent
              an invitation link, open it to accept.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map(r => (
              <div key={r.id} className="bg-white border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 size={15} className="text-gray-300 shrink-0" />
                      <h2 className="font-display italic text-xl text-gray-900 truncate">{r.name}</h2>
                    </div>
                    <p className="font-sans text-xs text-gray-500 mt-1 capitalize">
                      {r.kind.replace(/_/g, ' ')} · {HANDOVER_LABEL[r.handover_level]}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1.5 font-sans text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 ${
                    r.handover_level === 'self_managed'
                      ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]'
                      : 'bg-[#C9A96E]/15 text-[#8B6914]'}`}>
                    {r.handover_level === 'self_managed' ? <Pencil size={11} /> : <Eye size={11} />}
                    {r.handover_level === 'self_managed' ? 'Self-managed' : 'Managed'}
                  </span>
                </div>

                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">
                  What you can do here
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {r.permissions.length === 0 ? (
                    <span className="font-sans text-xs text-gray-400">No active permissions.</span>
                  ) : r.permissions.map(p => (
                    <span key={p} className="font-sans text-[11px] px-2 py-1 border border-gray-200 text-gray-600">
                      {p}
                    </span>
                  ))}
                </div>

                {!r.auto_publish && (
                  <p className="font-sans text-xs text-gray-400 mt-4 flex items-center gap-1.5">
                    <ShieldCheck size={12} /> Your changes are reviewed by Visit Drakensberg before they go live.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

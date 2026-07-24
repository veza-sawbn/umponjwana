import { supabase } from './auth'

// Site collaborators — anyone with elevated console access. Three levels are
// exposed in the UI, all backed by the existing profiles.role / staff_role
// columns and their SECURITY DEFINER setters (no new role model invented):
//   Administrator — role='admin' (full access)
//   Finance       — staff_role='finance' (finance module access)
//   Operations    — staff_role='operations' (operations module access)
// 'supplier' stays reserved for marketplace suppliers and never appears here.

export type CollaboratorLevel = 'admin' | 'finance' | 'operations'

export type Collaborator = {
  id: string
  full_name: string | null
  email: string | null
  role: 'admin' | 'supplier' | 'visitor'
  staff_role: string | null
  is_approved: boolean
  created_at: string
}

export function collaboratorLevel(c: Pick<Collaborator, 'role' | 'staff_role'>): CollaboratorLevel | null {
  if (c.role === 'admin') return 'admin'
  if (c.staff_role === 'finance') return 'finance'
  if (c.staff_role === 'operations') return 'operations'
  return null
}

export async function getCollaborators(): Promise<Collaborator[]> {
  try {
    const { data } = await supabase
      .from('profiles').select('id, full_name, email, role, staff_role, is_approved, created_at')
      .or('role.eq.admin,staff_role.eq.finance,staff_role.eq.operations')
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return data as Collaborator[]
  } catch {}
  return []
}

/**
 * Sets a collaborator's level (null revokes all elevated access). Goes
 * through the server route rather than calling the RPCs directly, so the
 * user's auth metadata (what middleware reads) stays in sync with
 * profiles.role/staff_role (what RLS reads) — see app/api/admin/set-level.
 */
export async function setCollaboratorLevel(userId: string, level: CollaboratorLevel | null): Promise<void> {
  const res = await fetch('/api/admin/set-level', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, level }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Could not update access level')
}

export async function inviteCollaborator(input: { email: string; fullName: string; level: CollaboratorLevel }): Promise<void> {
  const res = await fetch('/api/admin/invite', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Could not send invite')
}

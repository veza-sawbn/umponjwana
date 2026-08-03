import { supabase } from './auth'

// Partner access control — organisations, establishment-scoped access, and the
// permission matrix.
//
// Everything here is a thin wrapper over the database. The rules are enforced
// by RLS and SECURITY DEFINER functions in
// supabase/migrations/20260806_partner_access_control.sql, not by this module:
// a partner who calls these functions directly, or skips the UI entirely, hits
// exactly the same limits. Treat the helpers below as a convenience for
// rendering, never as the guard itself.

export type PermissionKey = string

export type Permission = {
  key: PermissionKey
  label: string
  category: string
  platform_only: boolean
}

export type RoleScope = 'platform' | 'supplier'

export type Role = {
  key: string
  label: string
  scope: RoleScope
  rank: number
}

export type HandoverLevel = 'managed' | 'self_managed'

export type AccessStatus = 'invited' | 'active' | 'suspended' | 'revoked'

export type EstablishmentAccess = {
  id: string
  establishment_id: string
  user_id: string
  organisation_id: string | null
  role_key: string
  handover_level: HandoverLevel
  granted_permissions: PermissionKey[]
  revoked_permissions: PermissionKey[]
  auto_publish: boolean
  access_status: AccessStatus
  invited_by: string | null
  access_start_date: string | null
  access_end_date: string | null
  created_at: string
  updated_at: string
}

export type Organisation = {
  id: string
  trading_name: string
  legal_name: string
  registration_number: string
  vat_number: string
  contact_email: string
  contact_phone: string
  contract_status: 'pending' | 'active' | 'expired' | 'terminated'
  verification_status: 'unverified' | 'in_review' | 'verified' | 'rejected'
  created_at: string
}

export type Invitation = {
  id: string
  establishment_id: string
  email: string
  role_key: string
  handover_level: HandoverLevel
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at: string
  accepted_at: string | null
  created_at: string
}

/** What each handover level can reach — mirrors vd_handover_ceiling(). */
export const HANDOVER_CEILING: Record<HandoverLevel, PermissionKey[]> = {
  managed: ['listing.view', 'listing.suggest', 'bookings.view', 'enquiries.respond', 'reports.view'],
  self_managed: [
    'listing.view', 'listing.edit', 'listing.suggest', 'photos.upload', 'photos.delete',
    'rates.view', 'rates.edit', 'availability.edit', 'offers.manage',
    'bookings.view', 'bookings.manage', 'enquiries.respond',
    'payments.view', 'reports.view', 'users.invite',
  ],
}

export const HANDOVER_LABEL: Record<HandoverLevel, string> = {
  managed: 'Managed by Visit Drakensberg',
  self_managed: 'Self-managed by the partner',
}

export async function getPermissions(): Promise<Permission[]> {
  try {
    const { data } = await supabase.from('vd_permissions').select('*').order('category')
    if (Array.isArray(data)) return data as Permission[]
  } catch {}
  return []
}

export async function getRoles(scope?: RoleScope): Promise<Role[]> {
  try {
    let q = supabase.from('vd_roles').select('*').order('rank', { ascending: false })
    if (scope) q = q.eq('scope', scope)
    const { data } = await q
    if (Array.isArray(data)) return data as Role[]
  } catch {}
  return []
}

export async function getRolePermissions(): Promise<Record<string, PermissionKey[]>> {
  const out: Record<string, PermissionKey[]> = {}
  try {
    const { data } = await supabase.from('vd_role_permissions').select('role_key, permission_key')
    for (const row of (data ?? []) as { role_key: string; permission_key: string }[]) {
      ;(out[row.role_key] ??= []).push(row.permission_key)
    }
  } catch {}
  return out
}

/** Access rows for one establishment. Admin-only by RLS. */
export async function getEstablishmentAccess(establishmentId: string): Promise<EstablishmentAccess[]> {
  try {
    const { data } = await supabase
      .from('vd_establishment_access').select('*')
      .eq('establishment_id', establishmentId)
      .order('created_at')
    if (Array.isArray(data)) return data as EstablishmentAccess[]
  } catch {}
  return []
}

/**
 * The caller's own access rows. A partner sees only their own by RLS, so this
 * is what the partner portal builds its establishment list from.
 */
export async function getMyAccess(): Promise<EstablishmentAccess[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('vd_establishment_access').select('*')
      .eq('user_id', user.id)
      .eq('access_status', 'active')
    if (Array.isArray(data)) return data as EstablishmentAccess[]
  } catch {}
  return []
}

/**
 * Effective permissions for the signed-in user on one establishment, resolved
 * by the database. Use for rendering only — the same check runs again on every
 * write, so hiding a button is a courtesy, not the control.
 */
export async function getMyPermissions(establishmentId: string): Promise<PermissionKey[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase.rpc('vd_effective_permissions', {
      p_user: user.id,
      p_establishment: establishmentId,
    })
    if (error || !Array.isArray(data)) return []
    return data as PermissionKey[]
  } catch {}
  return []
}

export async function can(establishmentId: string, permission: PermissionKey): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('vd_can', {
      p_establishment: establishmentId,
      p_permission: permission,
    })
    if (error) return false
    return data === true
  } catch { return false }
}

/**
 * Invite a partner onto an establishment. Returns the acceptance token so the
 * console can show the link — email delivery is a separate step.
 */
export async function inviteEstablishmentUser(input: {
  establishmentId: string
  email: string
  role: string
  handoverLevel: HandoverLevel
  permissions?: PermissionKey[]
  autoPublish?: boolean
  organisationId?: string | null
}): Promise<{ invitationId: string; token: string }> {
  const { data, error } = await supabase.rpc('vd_invite_establishment_user', {
    p_establishment: input.establishmentId,
    p_email: input.email,
    p_role: input.role,
    p_handover: input.handoverLevel,
    p_permissions: input.permissions ?? [],
    p_auto_publish: input.autoPublish ?? false,
    p_organisation: input.organisationId ?? null,
  })
  if (error) throw new Error(error.message || 'Could not send the invitation')
  const result = data as { invitationId: string; token: string }
  return result
}

export async function acceptInvitation(token: string): Promise<{ establishmentId: string; role: string }> {
  const { data, error } = await supabase.rpc('vd_accept_establishment_invitation', { p_token: token })
  if (error) throw new Error(error.message || 'Could not accept the invitation')
  return data as { establishmentId: string; role: string }
}

export async function revokeAccess(accessId: string, reason = ''): Promise<void> {
  const { error } = await supabase.rpc('vd_revoke_establishment_access', {
    p_access_id: accessId,
    p_reason: reason,
  })
  if (error) throw new Error(error.message || 'Could not revoke access')
}

export async function setAccess(accessId: string, patch: {
  role?: string
  handoverLevel?: HandoverLevel
  granted?: PermissionKey[]
  revoked?: PermissionKey[]
  autoPublish?: boolean
  status?: AccessStatus
}): Promise<void> {
  const { error } = await supabase.rpc('vd_set_establishment_access', {
    p_access_id: accessId,
    p_role: patch.role ?? null,
    p_handover: patch.handoverLevel ?? null,
    p_granted: patch.granted ?? null,
    p_revoked: patch.revoked ?? null,
    p_auto_publish: patch.autoPublish ?? null,
    p_status: patch.status ?? null,
  })
  if (error) throw new Error(error.message || 'Could not update access')
}

export async function getInvitations(establishmentId: string): Promise<Invitation[]> {
  try {
    const { data } = await supabase
      .from('vd_establishment_invitations')
      .select('id, establishment_id, email, role_key, handover_level, status, expires_at, accepted_at, created_at')
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false })
    if (Array.isArray(data)) return data as Invitation[]
  } catch {}
  return []
}

export type ListingChangeStatus =
  | 'draft' | 'submitted' | 'changes_requested' | 'approved' | 'published' | 'rejected'

export type ListingChange = {
  id: string
  establishment_id: string
  submitted_by: string | null
  previous_value: Record<string, unknown>
  proposed_value: Record<string, unknown>
  changed_fields: string[]
  status: ListingChangeStatus
  review_notes: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

/**
 * The ONLY way a partner changes anything. Partners have no write access to
 * vd_entities at all, so this is not a convenience wrapper — it is the write
 * path. The database decides per field whether the change publishes now or
 * queues, based on auto_publish / auto_publish_fields on the access row.
 *
 * Works for child records too (a room, a rate): the establishment is resolved
 * from the entity's parent reference server-side.
 */
export async function submitListingChange(
  entityId: string,
  changes: Record<string, unknown>,
): Promise<{ applied: string[]; queued: string[]; changeId: string | null }> {
  const { data, error } = await supabase.rpc('vd_submit_listing_change', {
    p_entity: entityId,
    p_changes: changes,
  })
  if (error) throw new Error(error.message || 'Could not submit the change')
  const r = data as { applied: string[]; queued: string[]; changeId: string | null }
  return { applied: r.applied ?? [], queued: r.queued ?? [], changeId: r.changeId ?? null }
}

/** Staff only — approvals.manage is platform-only, so no partner can call this. */
export async function reviewListingChange(
  changeId: string,
  decision: 'approved' | 'rejected' | 'changes_requested',
  notes = '',
): Promise<void> {
  const { error } = await supabase.rpc('vd_review_listing_change', {
    p_change_id: changeId,
    p_decision: decision,
    p_notes: notes,
  })
  if (error) throw new Error(error.message || 'Could not record the review')
}

export async function getListingChanges(status?: ListingChangeStatus): Promise<ListingChange[]> {
  try {
    let q = supabase.from('vd_listing_changes').select('*').order('created_at', { ascending: false })
    if (status) q = q.eq('status', status)
    const { data } = await q
    if (Array.isArray(data)) return data as ListingChange[]
  } catch {}
  return []
}

export async function getOrganisations(): Promise<Organisation[]> {
  try {
    const { data } = await supabase
      .from('vd_organisations')
      .select('id, trading_name, legal_name, registration_number, vat_number, contact_email, contact_phone, contract_status, verification_status, created_at')
      .order('trading_name')
    if (Array.isArray(data)) return data as Organisation[]
  } catch {}
  return []
}

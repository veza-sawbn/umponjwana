import { supabase } from './auth'
import { getEffectiveSupplierId } from './effective-supplier'

/**
 * Digital waivers for Activity and Guided Tours suppliers.
 *
 * Three tables (see 20260816_waivers.sql):
 *   vd_waiver_templates   — what the supplier asks participants to agree to
 *   vd_waiver_requests    — one per participant, carrying the public token
 *   vd_waiver_submissions — the signed record, immutable once written
 *
 * The participant-facing calls (openWaiver / submitWaiver) go through
 * SECURITY DEFINER functions rather than table access: an unsigned visitor
 * holding a token can read exactly one request and write exactly one
 * submission, and can reach nothing else.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type WaiverClause = {
  id: string
  text: string
  /** Required clauses block submission until ticked. */
  required: boolean
}

export type WaiverFields = {
  dateOfBirth?: boolean
  phone?: boolean
  emergencyContact?: boolean
  medical?: boolean
  address?: boolean
}

export type WaiverTemplate = {
  id: string
  supplier_id: string
  title: string
  intro: string
  clauses: WaiverClause[]
  fields: WaiverFields
  minor_age: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type WaiverRequestDetails = {
  id: string
  token: string
  template_id: string
  supplier_id: string
  participant_name: string
  participant_email: string
  activity_name: string
  service_date: string | null
  booking_reference: string | null
  status: 'pending' | 'signed' | 'expired' | 'void'
  expires_at: string | null
  created_at: string
  template_title: string
  submission_id: string | null
  signed_name: string | null
  signed_at: string | null
  guardian_name: string | null
}

export type WaiverSubmission = {
  id: string
  request_id: string
  supplier_id: string
  answers: Record<string, string>
  acknowledged: Record<string, boolean>
  template_snapshot: {
    title: string
    intro: string
    clauses: WaiverClause[]
    fields: WaiverFields
    minorAge: number
  }
  signed_name: string
  signature_data: string | null
  guardian_name: string | null
  signed_at: string
}

/** What a participant sees when they open their link. */
export type OpenWaiver =
  | {
      ok: true
      request: {
        participantName: string
        activityName: string
        serviceDate: string | null
        bookingReference: string | null
      }
      template: {
        title: string
        intro: string
        clauses: WaiverClause[]
        fields: WaiverFields
        minorAge: number
      }
      supplierName: string
    }
  | { ok: false; reason: 'not_found' | 'expired' | 'already_signed' | 'void' }

export const WAIVER_FIELD_LABELS: { key: keyof WaiverFields; label: string; hint: string }[] = [
  { key: 'dateOfBirth',      label: 'Date of birth',     hint: 'Also determines whether a guardian must countersign.' },
  { key: 'phone',            label: 'Phone number',      hint: 'Reachable on the day of the activity.' },
  { key: 'emergencyContact', label: 'Emergency contact', hint: 'Name and number of someone not on the trip.' },
  { key: 'medical',          label: 'Medical conditions', hint: 'Allergies, medication, conditions a guide should know.' },
  { key: 'address',          label: 'Home address',      hint: 'Occasionally required by insurers.' },
]

export function newClauseId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
}

/** Opaque public handle for a waiver link. Generated client-side but only
 *  ever used as a lookup key — it grants access to one request row and
 *  nothing else, and the server re-validates it on both read and write. */
function newToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
  }
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('')
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getMyWaiverTemplates(): Promise<WaiverTemplate[]> {
  const supplierId = await getEffectiveSupplierId()
  if (!supplierId) return []
  const { data } = await supabase
    .from('vd_waiver_templates')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
  return (data ?? []) as WaiverTemplate[]
}

export async function getWaiverTemplate(id: string): Promise<WaiverTemplate | null> {
  const { data } = await supabase
    .from('vd_waiver_templates').select('*').eq('id', id).maybeSingle()
  return (data as WaiverTemplate) ?? null
}

export async function saveWaiverTemplate(input: {
  id?: string
  title: string
  intro: string
  clauses: WaiverClause[]
  fields: WaiverFields
  minorAge: number
  isActive: boolean
}): Promise<WaiverTemplate> {
  const supplierId = await getEffectiveSupplierId()
  if (!supplierId) throw new Error('You need to be signed in to save a waiver.')

  const row = {
    supplier_id: supplierId,
    title: input.title.trim(),
    intro: input.intro.trim(),
    clauses: input.clauses,
    fields: input.fields,
    minor_age: input.minorAge,
    is_active: input.isActive,
    updated_at: new Date().toISOString(),
  }

  const query = input.id
    ? supabase.from('vd_waiver_templates').update(row).eq('id', input.id).select().maybeSingle()
    : supabase.from('vd_waiver_templates').insert(row).select().maybeSingle()

  const { data, error } = await query
  if (error) throw new Error(error.message || 'Could not save the waiver form.')
  return data as WaiverTemplate
}

export async function deleteWaiverTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('vd_waiver_templates').delete().eq('id', id)
  // A template with waivers already sent against it is retained by the
  // foreign key; say so rather than surfacing a constraint error.
  if (error) {
    throw new Error(
      error.code === '23503'
        ? 'This form has already been sent to participants, so it cannot be deleted. Deactivate it instead.'
        : error.message || 'Could not delete the waiver form.',
    )
  }
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export async function getMyWaiverRequests(): Promise<WaiverRequestDetails[]> {
  const supplierId = await getEffectiveSupplierId()
  if (!supplierId) return []
  const { data } = await supabase
    .from('vd_waiver_request_details')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
  return (data ?? []) as WaiverRequestDetails[]
}

export async function sendWaiverRequests(input: {
  templateId: string
  activityName: string
  serviceDate?: string | null
  bookingReference?: string | null
  expiresAt?: string | null
  participants: { name: string; email: string }[]
}): Promise<WaiverRequestDetails[]> {
  const supplierId = await getEffectiveSupplierId()
  if (!supplierId) throw new Error('You need to be signed in to send waivers.')
  if (input.participants.length === 0) throw new Error('Add at least one participant.')

  const rows = input.participants.map(p => ({
    token: newToken(),
    template_id: input.templateId,
    supplier_id: supplierId,
    participant_name: p.name.trim(),
    participant_email: p.email.trim().toLowerCase(),
    activity_name: input.activityName.trim(),
    service_date: input.serviceDate || null,
    booking_reference: input.bookingReference?.trim() || null,
    expires_at: input.expiresAt || null,
    status: 'pending' as const,
  }))

  const { data, error } = await supabase.from('vd_waiver_requests').insert(rows).select()
  if (error) throw new Error(error.message || 'Could not create the waiver links.')

  // Delivery is best-effort and non-fatal: the links exist either way and the
  // supplier can copy them straight out of the table.
  await Promise.all(
    (data ?? []).map(r =>
      fetch('/api/waivers/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: r.id }),
      }).catch(() => {}),
    ),
  )

  return (data ?? []) as unknown as WaiverRequestDetails[]
}

export async function voidWaiverRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('vd_waiver_requests')
    .update({ status: 'void', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message || 'Could not withdraw this waiver.')
}

export async function getWaiverSubmission(requestId: string): Promise<WaiverSubmission | null> {
  const { data } = await supabase
    .from('vd_waiver_submissions').select('*').eq('request_id', requestId).maybeSingle()
  return (data as WaiverSubmission) ?? null
}

/** The link a participant receives. */
export function waiverUrl(token: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/waiver/${token}`
}

// ─── Participant-facing ───────────────────────────────────────────────────────

export async function openWaiver(token: string): Promise<OpenWaiver> {
  const { data, error } = await supabase.rpc('vd_waiver_open', { p_token: token })
  if (error || !data) return { ok: false, reason: 'not_found' }
  return data as OpenWaiver
}

export async function submitWaiver(input: {
  token: string
  answers: Record<string, string>
  acknowledged: Record<string, boolean>
  signedName: string
  signature?: string | null
  guardianName?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('vd_waiver_submit', {
    p_token: input.token,
    p_answers: input.answers,
    p_acknowledged: input.acknowledged,
    p_signed_name: input.signedName,
    p_signature: input.signature ?? null,
    p_guardian_name: input.guardianName ?? null,
  })
  if (error) throw new Error(error.message || 'Could not submit this waiver.')
}

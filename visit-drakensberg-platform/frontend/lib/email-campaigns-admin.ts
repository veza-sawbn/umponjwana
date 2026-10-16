import { supabase } from './auth'
import { fetchAllRows, getSegmentCounts, type SegmentCount } from './customers-admin'
import type { MergeContact } from './email-merge-tags'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin email campaign system (§10/§11 "Email Campaign System" / "Campaign
 * Types"). Templates + campaigns are plain CRUD over the Phase 5 schema
 * (supabase/migrations/20260825_email_campaign_foundation.sql); "sending" a
 * campaign either dry-runs it (vd_campaign_dry_run_send() — resolves and
 * records the audience, emails nobody) or sends it for real through Brevo
 * (app/api/admin/campaigns/[id]/send — see
 * migrations/20261008_brevo_campaign_send.sql).
 * ──────────────────────────────────────────────────────────────────────────── */

export type EmailTemplate = {
  id: string
  name: string
  subject: string
  preheader: string
  htmlBody: string
  /** Full-bleed image band above the body. Empty = no hero (migrations/20260918_email_template_hero.sql). */
  heroImageUrl: string
  /** Alt text for the hero. Not optional in practice — see that migration's header. */
  heroImageAlt: string
  createdAt: string
  updatedAt: string
}

export type EmailCampaign = {
  id: string
  name: string
  campaignType: 'broadcast' | 'segmented' | 'behavioral' | 'lifecycle'
  templateId: string | null
  audienceSegmentId: string | null
  /** 'segment' = audienceSegmentId (null = all consented); 'manual' = recipientUserIds.
   *  See migrations/20261001_campaign_manual_recipients.sql. */
  audienceMode: 'segment' | 'manual'
  recipientUserIds: string[]
  /** Hand-picked recipients by email — accounts or not (migrations/20261016_campaign_any_contact.sql).
   *  Both lists count; new campaigns save picks here. */
  recipientEmails: string[]
  /** Campaign-level merge fields ({{offer}}, {{promo_code}}…), see lib/email-merge-tags.ts. */
  mergeValues: Record<string, string>
  status: 'draft' | 'scheduled' | 'dry_run_sent' | 'sending' | 'sent' | 'paused' | 'cancelled'
  scheduledAt: string | null
  sentAt: string | null
  dryRun: boolean
  audienceCountSnapshot: number | null
  /** Last ESP failure; kept alongside status 'sent' after a partial send. */
  sendError: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

function rowToTemplate(r: any): EmailTemplate {
  return {
    id: r.id, name: r.name, subject: r.subject, preheader: r.preheader, htmlBody: r.html_body,
    // Coalesced rather than read straight through: a template row written
    // before the hero migration landed has no such key at all.
    heroImageUrl: r.hero_image_url ?? '', heroImageAlt: r.hero_image_alt ?? '',
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}
function rowToCampaign(r: any): EmailCampaign {
  return {
    id: r.id, name: r.name, campaignType: r.campaign_type, templateId: r.template_id,
    audienceSegmentId: r.audience_segment_id,
    // Coalesced for the same reason as the template hero fields: a row read
    // before 20261001 landed has none of these keys.
    audienceMode: r.audience_mode === 'manual' ? 'manual' : 'segment',
    recipientUserIds: r.recipient_user_ids ?? [],
    recipientEmails: r.recipient_emails ?? [],
    mergeValues: r.merge_values && typeof r.merge_values === 'object' ? r.merge_values : {},
    status: r.status, scheduledAt: r.scheduled_at,
    sentAt: r.sent_at, dryRun: r.dry_run, audienceCountSnapshot: r.audience_count_snapshot,
    sendError: r.send_error ?? null,
    notes: r.notes ?? '', createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

// ── Templates ────────────────────────────────────────────────────────────

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase.from('vd_email_templates').select('*').order('updated_at', { ascending: false })
  if (error) { console.error('[email-campaigns-admin] templates fetch failed:', error); return [] }
  return (data ?? []).map(rowToTemplate)
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate | null> {
  const { data, error } = await supabase.from('vd_email_templates').select('*').eq('id', id).maybeSingle()
  if (error) { console.error('[email-campaigns-admin] template fetch failed:', error); return null }
  return data ? rowToTemplate(data) : null
}

export async function saveEmailTemplate(
  id: string | null,
  patch: {
    name: string; subject: string; preheader: string; htmlBody: string
    heroImageUrl?: string; heroImageAlt?: string
  },
): Promise<{ id: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const row = {
    name: patch.name, subject: patch.subject, preheader: patch.preheader, html_body: patch.htmlBody,
    hero_image_url: patch.heroImageUrl ?? '', hero_image_alt: patch.heroImageAlt ?? '',
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { error } = await supabase.from('vd_email_templates').update(row).eq('id', id)
    return { id, error: error?.message ?? null }
  }
  const { data, error } = await supabase.from('vd_email_templates')
    .insert({ ...row, created_by: user?.id ?? null }).select('id').maybeSingle()
  return { id: data?.id ?? null, error: error?.message ?? null }
}

export async function deleteEmailTemplate(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('vd_email_templates').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── Campaigns ────────────────────────────────────────────────────────────

export async function getEmailCampaigns(): Promise<EmailCampaign[]> {
  const { data, error } = await supabase.from('vd_email_campaigns').select('*').order('created_at', { ascending: false })
  if (error) { console.error('[email-campaigns-admin] campaigns fetch failed:', error); return [] }
  return (data ?? []).map(rowToCampaign)
}

export async function getEmailCampaign(id: string): Promise<EmailCampaign | null> {
  const { data, error } = await supabase.from('vd_email_campaigns').select('*').eq('id', id).maybeSingle()
  if (error) { console.error('[email-campaigns-admin] campaign fetch failed:', error); return null }
  return data ? rowToCampaign(data) : null
}

export async function saveEmailCampaign(
  id: string | null,
  patch: {
    name: string; campaignType: EmailCampaign['campaignType']; templateId: string | null
    audienceSegmentId: string | null; scheduledAt: string | null; notes: string
    audienceMode: EmailCampaign['audienceMode']; recipientUserIds: string[]; recipientEmails: string[]
    mergeValues: Record<string, string>
  },
): Promise<{ id: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const row = {
    name: patch.name, campaign_type: patch.campaignType, template_id: patch.templateId,
    audience_segment_id: patch.audienceMode === 'segment' ? patch.audienceSegmentId : null,
    audience_mode: patch.audienceMode,
    recipient_user_ids: patch.audienceMode === 'manual' ? Array.from(new Set(patch.recipientUserIds)) : [],
    recipient_emails: patch.audienceMode === 'manual'
      ? Array.from(new Set(patch.recipientEmails.map(e => e.trim().toLowerCase()).filter(Boolean)))
      : [],
    merge_values: patch.mergeValues,
    scheduled_at: patch.scheduledAt,
    status: patch.scheduledAt ? 'scheduled' : 'draft', notes: patch.notes, updated_at: new Date().toISOString(),
  }
  if (id) {
    const { error } = await supabase.from('vd_email_campaigns').update(row).eq('id', id)
    return { id, error: error?.message ?? null }
  }
  const { data, error } = await supabase.from('vd_email_campaigns')
    .insert({ ...row, created_by: user?.id ?? null }).select('id').maybeSingle()
  return { id: data?.id ?? null, error: error?.message ?? null }
}

export async function deleteEmailCampaign(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('vd_email_campaigns').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function setCampaignStatus(id: string, status: 'paused' | 'cancelled' | 'draft'): Promise<{ error: string | null }> {
  const { error } = await supabase.from('vd_email_campaigns').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  return { error: error?.message ?? null }
}

/** Resolves the real consented audience server-side and records the
 *  outcome; never delivers real email. Returns the resolved recipient count. */
export async function dryRunSendCampaign(id: string): Promise<{ count: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc('vd_campaign_dry_run_send', { p_campaign_id: id })
  return { count: typeof data === 'number' ? data : null, error: error?.message ?? null }
}

/** The real send, through Brevo. Server-side because rendering uses the
 *  server-only email shell and the Brevo key never leaves the server. */
export async function sendCampaign(id: string): Promise<{ sent: number; total: number; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/campaigns/${encodeURIComponent(id)}/send`, { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    return { sent: Number(body.sent) || 0, total: Number(body.total) || 0, error: body.error ?? (res.ok ? null : `send failed (${res.status})`) }
  } catch (e) {
    return { sent: 0, total: 0, error: e instanceof Error ? e.message : 'send failed' }
  }
}

/** Closes out a send that was cut off and left the campaign in 'sending'
 *  (migrations/20261012_campaign_send_recovery.sql). Marks it sent — never
 *  back to draft, since some recipients were very likely emailed. Returns
 *  how many are recorded as sent. */
export async function releaseStuckCampaign(id: string): Promise<{ sent: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc('vd_campaign_release_stuck', { p_campaign_id: id })
  return { sent: typeof data === 'number' ? data : null, error: error?.message ?? null }
}

// ── Audience ─────────────────────────────────────────────────────────────

export async function getAudienceSegmentOptions(): Promise<SegmentCount[]> {
  return getSegmentCounts()
}

/** Live consented-audience count for the builder UI. Resolved server-side
 *  (vd_count_consented_audience — the same function vd_campaign_dry_run_send
 *  uses) rather than fetching segment membership rows to count client-side,
 *  so it stays correct and cheap at any table size. */
export async function getConsentedAudienceCount(segmentId: string | null): Promise<number> {
  const { data, error } = await supabase.rpc('vd_count_consented_audience', { p_segment_id: segmentId })
  if (error) { console.error('[email-campaigns-admin] audience count failed:', error); return 0 }
  return typeof data === 'number' ? data : 0
}

/** How many people a saved campaign would reach right now — the same
 *  resolution the real send and the dry run use (vd_campaign_recipients). */
export async function getCampaignRecipientCount(campaignId: string): Promise<number> {
  const { data, error } = await supabase.rpc('vd_campaign_recipient_count', { p_campaign_id: campaignId })
  if (error) { console.error('[email-campaigns-admin] recipient count failed:', error); return 0 }
  return typeof data === 'number' ? data : 0
}

export type ContactConsent = 'opted_in' | 'unknown' | 'opted_out'

/** One pickable recipient. `id` is the lower-cased email address: the same
 *  person can be a customer and sit in a supplier address book, and the
 *  address is what both have in common. */
export type CampaignContact = MergeContact & {
  segmentIds: string[]
  /** The website account behind this address, if any. */
  userId: string | null
  /** 'customer' has a website account; 'address_book' is a supplier contact (e.g. imported from Wix). */
  kind: 'customer' | 'address_book' | 'typed'
  /** Supplier names whose address book holds this address. */
  addressBooks: string[]
  consent: ContactConsent
}

function rowToContact(r: any): CampaignContact {
  const email = String(r.email ?? '').toLowerCase()
  return {
    id: email,
    fullName: (r.full_name ?? '').trim() || email,
    email,
    country: r.country ?? null,
    city: r.city ?? null,
    lifecycleStage: r.lifecycle_stage ?? 'visitor',
    interests: r.interests ?? [],
    favouriteDestinations: r.favourite_destinations ?? [],
    favouriteActivities: r.favourite_activities ?? [],
    tripCount: r.trip_count ?? 0,
    upcomingTravel: r.upcoming_travel ?? null,
    segmentIds: r.segment_ids ?? [],
    userId: r.user_id ?? null,
    kind: r.kind === 'customer' ? 'customer' : 'address_book',
    addressBooks: r.address_books ?? [],
    consent: r.consent === 'opted_in' || r.consent === 'opted_out' ? r.consent : 'unknown',
  }
}

/** Every customer and every supplier address-book contact, one per email
 *  address, with their marketing consent status (vd_campaign_contacts).
 *  Opted-out people are included so the picker can show them as such. */
export async function getCampaignContacts(): Promise<CampaignContact[]> {
  const rows = await fetchAllRows(
    (from, to) => supabase.rpc('vd_campaign_contacts').range(from, to),
    'vd_campaign_contacts',
  )
  return (rows as any[]).map(rowToContact)
}

/** A contact for an address typed into the builder that isn't in the list. */
export function typedContact(email: string, consent: ContactConsent): CampaignContact {
  const e = email.trim().toLowerCase()
  return {
    id: e, fullName: e, email: e, country: null, city: null, lifecycleStage: 'visitor',
    interests: [], favouriteDestinations: [], favouriteActivities: [], tripCount: 0, upcomingTravel: null,
    segmentIds: [], userId: null, kind: 'typed', addressBooks: [], consent,
  }
}

/** Consent status for typed-in addresses. Staff addresses come back flagged
 *  so the builder can refuse them. */
export async function getConsentStatus(emails: string[]): Promise<{ email: string; consent: ContactConsent; isStaff: boolean }[]> {
  if (emails.length === 0) return []
  const { data, error } = await supabase.rpc('vd_marketing_consent_status', { p_emails: emails })
  if (error) { console.error('[email-campaigns-admin] consent status failed:', error); return [] }
  return ((data ?? []) as any[]).map(r => ({
    email: String(r.email), consent: r.consent === 'opted_in' || r.consent === 'opted_out' ? r.consent : 'unknown',
    isStaff: !!r.is_staff,
  }))
}

/** Records the admin's confirmation that these people opted in elsewhere
 *  (e.g. on Wix). Never overrides an opt-out. Returns how many were recorded. */
export async function recordMarketingConsent(emails: string[]): Promise<{ recorded: number; error: string | null }> {
  const { data, error } = await supabase.rpc('vd_admin_record_marketing_consent', { p_emails: emails, p_source: 'admin_attested' })
  return { recorded: typeof data === 'number' ? data : 0, error: error?.message ?? null }
}

/** Sends the campaign, marked [Test], to a few typed addresses. Doesn't change
 *  the campaign or need consent: it's for checking the email before sending. */
export async function sendTestEmail(campaignId: string, emails: string[]): Promise<{ sent: number; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/campaigns/${encodeURIComponent(campaignId)}/test`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ emails }),
    })
    const body = await res.json().catch(() => ({}))
    return { sent: Number(body.sent) || 0, error: body.error ?? (res.ok ? null : `test send failed (${res.status})`) }
  } catch (e) {
    return { sent: 0, error: e instanceof Error ? e.message : 'test send failed' }
  }
}

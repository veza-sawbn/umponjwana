import { supabase } from './auth'
import { fetchAllRows, getCustomerDirectory, getSegmentCounts, type SegmentCount } from './customers-admin'
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
    audienceMode: EmailCampaign['audienceMode']; recipientUserIds: string[]
    mergeValues: Record<string, string>
  },
): Promise<{ id: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const row = {
    name: patch.name, campaign_type: patch.campaignType, template_id: patch.templateId,
    audience_segment_id: patch.audienceMode === 'segment' ? patch.audienceSegmentId : null,
    audience_mode: patch.audienceMode,
    recipient_user_ids: patch.audienceMode === 'manual' ? Array.from(new Set(patch.recipientUserIds)) : [],
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

/** Consented count for a hand-picked list — vd_count_consented_recipients,
 *  the same function vd_campaign_dry_run_send uses for a manual campaign, so
 *  the builder's number and the send's number can't disagree. */
export async function getConsentedRecipientCount(userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0
  const { data, error } = await supabase.rpc('vd_count_consented_recipients', { p_user_ids: userIds })
  if (error) { console.error('[email-campaigns-admin] recipient count failed:', error); return 0 }
  return typeof data === 'number' ? data : 0
}

/** One pickable recipient: everything the merge tags read, plus what the
 *  picker filters on. */
export type CampaignContact = MergeContact & {
  segmentIds: string[]
}

/** Every marketing-consented customer, with the profile fields the merge
 *  tags fill and their segment memberships. Only consented customers are
 *  returned — a promotional campaign has no business offering anyone else
 *  as a pick (and the send re-checks consent regardless). */
export async function getCampaignContacts(): Promise<CampaignContact[]> {
  const [directory, crm, members] = await Promise.all([
    getCustomerDirectory(),
    fetchAllRows(
      (from, to) => supabase.from('vd_customer_profiles')
        .select('user_id, province_or_city, interests, favourite_destinations, favourite_activities')
        .eq('marketing_consent', true).range(from, to),
      'vd_customer_profiles',
    ),
    fetchAllRows(
      (from, to) => supabase.from('vd_customer_segment_members').select('user_id, segment_id').range(from, to),
      'vd_customer_segment_members',
    ),
  ])
  const crmByUser = new Map(crm.map((c: any) => [c.user_id, c]))
  const segmentsByUser = new Map<string, string[]>()
  for (const m of members as { user_id: string; segment_id: string }[]) {
    const list = segmentsByUser.get(m.user_id) ?? []
    list.push(m.segment_id)
    segmentsByUser.set(m.user_id, list)
  }
  return directory
    .filter(c => c.marketingConsent && c.email)
    .map(c => {
      const extra: any = crmByUser.get(c.id)
      return {
        id: c.id,
        fullName: c.fullName,
        email: c.email,
        country: c.country,
        city: extra?.province_or_city ?? null,
        lifecycleStage: c.lifecycleStage,
        interests: extra?.interests ?? [],
        favouriteDestinations: extra?.favourite_destinations ?? [],
        favouriteActivities: extra?.favourite_activities ?? [],
        tripCount: c.tripCount,
        upcomingTravel: c.upcomingTravel,
        segmentIds: segmentsByUser.get(c.id) ?? [],
      }
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}

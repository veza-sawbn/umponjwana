import { supabase } from './auth'
import { getSegmentCounts, type SegmentCount } from './customers-admin'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin email campaign system (§10/§11 "Email Campaign System" / "Campaign
 * Types"). Templates + campaigns are plain CRUD over the Phase 5 schema
 * (supabase/migrations/20260825_email_campaign_foundation.sql); "sending" a
 * campaign calls vd_campaign_dry_run_send() — the only send path that
 * exists today (see that migration's header for why). Every campaign this
 * module can create or send is dry-run only; nothing here delivers real
 * email.
 * ──────────────────────────────────────────────────────────────────────────── */

export type EmailTemplate = {
  id: string
  name: string
  subject: string
  preheader: string
  htmlBody: string
  createdAt: string
  updatedAt: string
}

export type EmailCampaign = {
  id: string
  name: string
  campaignType: 'broadcast' | 'segmented' | 'behavioral' | 'lifecycle'
  templateId: string | null
  audienceSegmentId: string | null
  status: 'draft' | 'scheduled' | 'dry_run_sent' | 'sent' | 'paused' | 'cancelled'
  scheduledAt: string | null
  sentAt: string | null
  dryRun: boolean
  audienceCountSnapshot: number | null
  notes: string
  createdAt: string
  updatedAt: string
}

function rowToTemplate(r: any): EmailTemplate {
  return {
    id: r.id, name: r.name, subject: r.subject, preheader: r.preheader, htmlBody: r.html_body,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}
function rowToCampaign(r: any): EmailCampaign {
  return {
    id: r.id, name: r.name, campaignType: r.campaign_type, templateId: r.template_id,
    audienceSegmentId: r.audience_segment_id, status: r.status, scheduledAt: r.scheduled_at,
    sentAt: r.sent_at, dryRun: r.dry_run, audienceCountSnapshot: r.audience_count_snapshot,
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
  patch: { name: string; subject: string; preheader: string; htmlBody: string },
): Promise<{ id: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const row = { name: patch.name, subject: patch.subject, preheader: patch.preheader, html_body: patch.htmlBody, updated_at: new Date().toISOString() }
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
  },
): Promise<{ id: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  const row = {
    name: patch.name, campaign_type: patch.campaignType, template_id: patch.templateId,
    audience_segment_id: patch.audienceSegmentId, scheduled_at: patch.scheduledAt,
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

/** The only send path that exists today — see the migration header. Resolves
 *  the real consented audience server-side and records the outcome; never
 *  delivers real email. Returns the resolved recipient count. */
export async function dryRunSendCampaign(id: string): Promise<{ count: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc('vd_campaign_dry_run_send', { p_campaign_id: id })
  return { count: typeof data === 'number' ? data : null, error: error?.message ?? null }
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

// SERVER ONLY — the campaign send worker.
//
// Every state change goes through the SQL functions in
// supabase/migrations/20261007_marketing_send_pipeline.sql; this module only
// orchestrates: claim a batch → render each recipient → send via Brevo → record
// the result. All durable state is per-recipient in vd_campaign_recipients, so
// the worker is safe to run concurrently, to kill mid-batch, and to run again.

import { supabaseAdmin } from './supabase-admin'
import { getMarketingConfig, type MarketingConfig } from './marketing-config'
import { sendBrevoEmail, type BrevoSendResult } from './brevo'
import { renderCampaignEmail } from './campaign-render'
import type { MergeContact } from './email-merge-tags'

type Admin = ReturnType<typeof supabaseAdmin>

export type DispatchSummary = {
  skipped?: string[]
  activated: number
  sent: number
  failed: number
  requeued: number
  finalized: number
  dailyCapReached: boolean
  haltedReason?: string
}

type Claimed = { recipient_id: string; campaign_id: string; email: string; user_id: string | null; attempts: number }
type CampaignRow = {
  id: string; name: string; merge_values: Record<string, string> | null; template_id: string | null
}
type TemplateRow = {
  id: string; subject: string; preheader: string; html_body: string
  hero_image_url: string | null; hero_image_alt: string | null
}

/** Start of the current UTC day — the window the daily cap counts over. */
function startOfUtcDay(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

async function sentToday(admin: Admin): Promise<number> {
  const { count, error } = await admin
    .from('vd_campaign_recipients').select('id', { count: 'exact', head: true })
    .eq('status', 'sent').gte('sent_at', startOfUtcDay())
  if (error) throw new Error(`daily-cap lookup failed: ${error.message}`)
  return count ?? 0
}

/** Merge fields for the accounts in a batch — one round of queries per batch, not per recipient. */
async function loadContacts(admin: Admin, userIds: string[]): Promise<Map<string, MergeContact>> {
  const out = new Map<string, MergeContact>()
  if (userIds.length === 0) return out
  const [profiles, crm, orders] = await Promise.all([
    admin.from('profiles').select('id, full_name, email').in('id', userIds),
    admin.from('vd_customer_profiles')
      .select('user_id, country, province_or_city, lifecycle_stage, interests, favourite_destinations, favourite_activities')
      .in('user_id', userIds),
    admin.from('vd_orders').select('user_id, travel_start, booking_status').in('user_id', userIds).neq('booking_status', 'cancelled'),
  ])
  const crmBy = new Map((crm.data ?? []).map((c: any) => [c.user_id, c]))
  const today = new Date().toISOString().slice(0, 10)
  const trips = new Map<string, { n: number; next: string | null }>()
  for (const o of (orders.data ?? []) as { user_id: string; travel_start: string | null }[]) {
    const t = trips.get(o.user_id) ?? { n: 0, next: null }
    t.n += 1
    if (o.travel_start && o.travel_start.slice(0, 10) >= today && (!t.next || o.travel_start < t.next)) t.next = o.travel_start
    trips.set(o.user_id, t)
  }
  for (const p of (profiles.data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
    const c: any = crmBy.get(p.id)
    const t = trips.get(p.id)
    out.set(p.id, {
      id: p.id,
      fullName: p.full_name?.trim() || p.email || '',
      email: p.email ?? '',
      country: c?.country ?? null,
      city: c?.province_or_city ?? null,
      lifecycleStage: c?.lifecycle_stage ?? 'visitor',
      interests: c?.interests ?? [],
      favouriteDestinations: c?.favourite_destinations ?? [],
      favouriteActivities: c?.favourite_activities ?? [],
      tripCount: t?.n ?? 0,
      upcomingTravel: t?.next ?? null,
    })
  }
  return out
}

export async function dispatchCampaigns(opts: {
  origin: string
  /** Wall-clock budget for this invocation (serverless functions are time-boxed). */
  budgetMs: number
  cfg?: MarketingConfig
  admin?: Admin
  fetchImpl?: typeof fetch
}): Promise<DispatchSummary> {
  const cfg = opts.cfg ?? getMarketingConfig()
  const summary: DispatchSummary = {
    activated: 0, sent: 0, failed: 0, requeued: 0, finalized: 0, dailyCapReached: false,
  }
  if (!cfg.ready) return { ...summary, skipped: cfg.missing }

  const admin = opts.admin ?? supabaseAdmin()
  const deadline = Date.now() + opts.budgetMs

  const act = await admin.rpc('vd_campaign_activate_due')
  if (act.error) throw new Error(`activate_due failed: ${act.error.message}`)
  summary.activated = act.data ?? 0

  const campaigns = new Map<string, CampaignRow>()
  const templates = new Map<string, TemplateRow>()
  let stop = false

  while (!stop && Date.now() < deadline) {
    const remaining = cfg.dailyCap - (await sentToday(admin))
    if (remaining <= 0) { summary.dailyCapReached = true; break }

    const claim = await admin.rpc('vd_campaign_claim_batch', { p_limit: Math.min(cfg.batchSize, remaining) })
    if (claim.error) throw new Error(`claim failed: ${claim.error.message}`)
    const batch = (claim.data ?? []) as Claimed[]
    if (batch.length === 0) break

    // Load any campaign / template we have not seen this run.
    const newCampaignIds = [...new Set(batch.map(b => b.campaign_id))].filter(id => !campaigns.has(id))
    if (newCampaignIds.length) {
      const { data } = await admin.from('vd_email_campaigns').select('id, name, merge_values, template_id').in('id', newCampaignIds)
      for (const c of (data ?? []) as CampaignRow[]) campaigns.set(c.id, c)
      const tplIds = [...new Set((data ?? []).map((c: any) => c.template_id).filter(Boolean))].filter(id => !templates.has(id as string))
      if (tplIds.length) {
        const { data: t } = await admin.from('vd_email_templates')
          .select('id, subject, preheader, html_body, hero_image_url, hero_image_alt').in('id', tplIds as string[])
        for (const row of (t ?? []) as TemplateRow[]) templates.set(row.id, row)
      }
    }
    const contacts = await loadContacts(admin, [...new Set(batch.map(b => b.user_id).filter((x): x is string => !!x))])

    const unprocessed = new Set(batch.map(b => b.recipient_id))
    const release = async () => {
      if (unprocessed.size === 0) return
      // Give back what this worker claimed but never reached; it did not spend an attempt on them.
      for (const id of unprocessed) {
        const { data: r } = await admin.from('vd_campaign_recipients').select('attempts').eq('id', id).maybeSingle()
        await admin.from('vd_campaign_recipients')
          .update({ status: 'queued', attempts: Math.max(0, (r?.attempts ?? 1) - 1), updated_at: new Date().toISOString() })
          .eq('id', id).eq('status', 'sending')
      }
      summary.requeued += unprocessed.size
      unprocessed.clear()
    }

    for (const rec of batch) {
      if (Date.now() >= deadline) { stop = true; break }
      const campaign = campaigns.get(rec.campaign_id)
      const template = campaign?.template_id ? templates.get(campaign.template_id) : undefined
      if (!campaign || !template) {
        await admin.rpc('vd_campaign_halt', { p_campaign_id: rec.campaign_id, p_reason: 'template is missing — it may have been deleted' })
        summary.haltedReason = 'template missing'
        unprocessed.delete(rec.recipient_id)
        continue
      }

      const contact = rec.user_id ? contacts.get(rec.user_id) ?? null : null
      let rendered
      try {
        rendered = renderCampaignEmail({
          template: {
            subject: template.subject, preheader: template.preheader, htmlBody: template.html_body,
            heroImageUrl: template.hero_image_url ?? '', heroImageAlt: template.hero_image_alt ?? '',
          },
          campaignFields: campaign.merge_values ?? {},
          contact: contact ?? (rec.user_id ? null : { id: rec.email, fullName: '', email: rec.email, country: null, city: null, lifecycleStage: 'visitor', interests: [], favouriteDestinations: [], favouriteActivities: [], tripCount: 0, upcomingTravel: null }),
          toEmail: rec.email,
          origin: opts.origin,
          tokenSecret: cfg.tokenSecret,
          postalAddress: cfg.postalAddress,
        })
      } catch (e) {
        await admin.rpc('vd_campaign_mark_recipient', {
          p_recipient_id: rec.recipient_id, p_ok: false, p_error: `render failed: ${e instanceof Error ? e.message : e}`, p_retryable: false,
        })
        summary.failed += 1
        unprocessed.delete(rec.recipient_id)
        continue
      }

      const first = contact?.fullName && !contact.fullName.includes('@') ? contact.fullName : null
      const result: BrevoSendResult = await sendBrevoEmail({
        apiKey: cfg.apiKey, fromEmail: cfg.senderEmail, fromName: cfg.senderName, replyTo: cfg.replyTo,
        to: rec.email, toName: first, subject: rendered.subject, html: rendered.html, text: rendered.text,
        headers: rendered.headers, tags: ['campaign', `campaign:${rec.campaign_id}`],
      }, opts.fetchImpl)
      unprocessed.delete(rec.recipient_id)

      if (result.ok) {
        const mark = await admin.rpc('vd_campaign_mark_recipient', {
          p_recipient_id: rec.recipient_id, p_ok: true, p_message_id: result.messageId,
        })
        // The email left; if only the bookkeeping failed, say so loudly rather than risk a resend.
        if (mark.error) console.error('[campaign-dispatch] sent but could not record', rec.recipient_id, mark.error.message)
        summary.sent += 1
        continue
      }

      await admin.rpc('vd_campaign_mark_recipient', {
        p_recipient_id: rec.recipient_id, p_ok: false, p_error: result.error, p_retryable: result.retryable,
      })
      if (result.retryable) summary.requeued += 1; else summary.failed += 1

      if (result.fatal) {
        await admin.rpc('vd_campaign_halt', { p_campaign_id: rec.campaign_id, p_reason: result.error })
        summary.haltedReason = result.error
        stop = true
        break
      }
      if (result.rateLimited) { stop = true; break }
    }
    await release()
  }

  const fin = await admin.rpc('vd_campaign_finalize')
  if (!fin.error) summary.finalized = fin.data ?? 0
  return summary
}

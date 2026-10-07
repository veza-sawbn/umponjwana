import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSiteOrigin } from '@/lib/origin'
import { BREVO_BATCH_SIZE, brevoConfigured, sendBrevoBatch, type BrevoMessage } from '@/lib/brevo'
import { renderCampaignEmail, type CampaignRecipientRow } from '@/lib/campaign-send'

export const dynamic = 'force-dynamic'
// A few thousand recipients is a handful of Brevo calls, but give a large
// list room rather than have the platform kill the function mid-send.
export const maxDuration = 300

/** The real send. Status is claimed and released in the database
 *  (vd_campaign_begin_send / vd_campaign_finish_send — see
 *  supabase/migrations/20261008_brevo_campaign_send.sql), both called as the
 *  signed-in admin so is_admin() gates them exactly like the dry run. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })

  if (!brevoConfigured()) {
    return NextResponse.json(
      { error: 'Brevo is not configured — set BREVO_API_KEY and BREVO_SENDER_EMAIL.' },
      { status: 503 },
    )
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('vd_email_campaigns').select('id, template_id, merge_values').eq('id', params.id).maybeSingle()
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 })
  if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })
  if (!campaign.template_id) return NextResponse.json({ error: 'campaign has no template' }, { status: 400 })

  const { data: template } = await supabase
    .from('vd_email_templates').select('*').eq('id', campaign.template_id).maybeSingle()
  if (!template) return NextResponse.json({ error: 'template not found' }, { status: 400 })

  // Claims the campaign (status → 'sending') and resolves who gets it. If this
  // fails nothing has changed, so the error goes straight back to the admin.
  const { data: rows, error: beginError } = await supabase.rpc('vd_campaign_begin_send', { p_campaign_id: params.id })
  if (beginError) return NextResponse.json({ error: beginError.message }, { status: 409 })
  const recipients = (rows ?? []) as CampaignRecipientRow[]

  const origin = getSiteOrigin(req)
  const campaignFields = campaign.merge_values && typeof campaign.merge_values === 'object' ? campaign.merge_values : {}
  const content = {
    subject: template.subject ?? '',
    preheader: template.preheader ?? '',
    htmlBody: template.html_body ?? '',
    heroImageUrl: template.hero_image_url ?? '',
    heroImageAlt: template.hero_image_alt ?? '',
  }

  let sent = 0
  const errors: string[] = []
  const sentEmails: { email: string; userId: string }[] = []
  try {
    for (let i = 0; i < recipients.length; i += BREVO_BATCH_SIZE) {
      const batch = recipients.slice(i, i + BREVO_BATCH_SIZE)
      const messages: BrevoMessage[] = batch.map(r => renderCampaignEmail({
        origin, template: content, recipient: r, campaignFields,
        postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
      }))
      const result = await sendBrevoBatch({ messages, campaignId: params.id, unsubscribeUrl: `${origin}/unsubscribe` })
      if (result.error) {
        errors.push(`recipients ${i + 1}–${i + batch.length}: ${result.error}`)
        continue
      }
      sent += result.sent
      for (const r of batch) sentEmails.push({ email: r.email, userId: r.user_id })
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'send failed')
  }

  const errorText = errors.length ? errors.join('; ').slice(0, 2000)
    : recipients.length === 0 ? 'no consented recipients' : null

  // Always release the claim, whatever happened above — a campaign left in
  // 'sending' can't be sent or edited again.
  const { error: finishError } = await supabase.rpc('vd_campaign_finish_send', {
    p_campaign_id: params.id, p_sent_count: sent, p_error: errorText,
  })
  if (finishError) console.error('[campaign-send] finish failed:', finishError)

  // Reporting rows are best-effort and service-role only (no client insert
  // policy on vd_email_events). The send already happened either way.
  if (sentEmails.length) {
    const admin = supabaseAdmin()
    for (let i = 0; i < sentEmails.length; i += 1000) {
      const { error } = await admin.from('vd_email_events').insert(
        sentEmails.slice(i, i + 1000).map(s => ({
          campaign_id: params.id, user_id: s.userId, email: s.email, event_type: 'sent',
          metadata: { provider: 'brevo' },
        })),
      )
      if (error) { console.error('[campaign-send] event log failed:', error); break }
    }
  }

  if (sent === 0) {
    return NextResponse.json({ sent: 0, total: recipients.length, error: errorText }, { status: recipients.length ? 502 : 400 })
  }
  return NextResponse.json({ sent, total: recipients.length, error: errorText })
}

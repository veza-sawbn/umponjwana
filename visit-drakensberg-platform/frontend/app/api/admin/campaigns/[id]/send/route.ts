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

  // Reporting rows go in after every accepted batch, not once at the end: if
  // the function is cut off mid-send they are the only record of who got the
  // email, and vd_campaign_release_stuck() counts them. Service role only (no
  // client insert policy on vd_email_events); best-effort either way.
  const admin = supabaseAdmin()
  async function recordSent(batch: CampaignRecipientRow[], unconfirmed: boolean) {
    const { error } = await admin.from('vd_email_events').insert(batch.map(r => ({
      campaign_id: params.id, user_id: r.user_id, email: r.email, event_type: 'sent',
      metadata: unconfirmed ? { provider: 'brevo', unconfirmed: true } : { provider: 'brevo' },
    })))
    if (error) console.error('[campaign-send] event log failed:', error)
  }

  let sent = 0
  const errors: string[] = []
  try {
    for (let i = 0; i < recipients.length; i += BREVO_BATCH_SIZE) {
      const batch = recipients.slice(i, i + BREVO_BATCH_SIZE)
      const messages: BrevoMessage[] = batch.map(r => renderCampaignEmail({
        origin, template: content, recipient: r, campaignFields,
        postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
      }))
      const result = await sendBrevoBatch({ messages, campaignId: params.id, unsubscribeUrl: `${origin}/unsubscribe` })
      const range = `recipients ${i + 1}–${i + batch.length}`
      if (result.uncertain) {
        // Counted as sent so the campaign can't fall back to draft and be
        // retried into a double send; the error says to check Brevo.
        errors.push(`${range}: no reply from Brevo (${result.error}) — may have been sent, check Brevo's logs`)
        sent += batch.length
        await recordSent(batch, true)
        continue
      }
      if (result.error) {
        errors.push(`${range}: ${result.error}`)
        continue
      }
      sent += result.sent
      await recordSent(batch, false)
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'send failed')
  }

  const errorText = errors.length ? errors.join('; ').slice(0, 2000)
    : recipients.length === 0 ? 'no consented recipients' : null

  // Releases the claim. If the function dies before getting here the
  // campaign stays 'sending' until an admin releases it from the campaign
  // page (vd_campaign_release_stuck, migrations/20261012_campaign_send_recovery.sql).
  const { error: finishError } = await supabase.rpc('vd_campaign_finish_send', {
    p_campaign_id: params.id, p_sent_count: sent, p_error: errorText,
  })
  if (finishError) console.error('[campaign-send] finish failed:', finishError)

  if (sent === 0) {
    return NextResponse.json({ sent: 0, total: recipients.length, error: errorText }, { status: recipients.length ? 502 : 400 })
  }
  return NextResponse.json({ sent, total: recipients.length, error: errorText })
}

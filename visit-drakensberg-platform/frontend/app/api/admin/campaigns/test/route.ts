import { NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin-route'
import { getMarketingConfig } from '@/lib/marketing-config'
import { sendBrevoEmail } from '@/lib/brevo'
import { renderCampaignEmail } from '@/lib/campaign-render'
import { getSiteOrigin } from '@/lib/origin'
import { isValidEmail, normaliseEmail } from '@/lib/marketing-tokens'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Sends a campaign's template to up to 5 addresses the admin types, through
// the REAL provider and the REAL renderer, with sample merge values and a
// [TEST] subject prefix. This is the pilot's first step: it proves DNS,
// sender authentication, rendering and the unsubscribe headers end to end
// without touching a single customer. It checks no consent (it is not a
// campaign send) so it only ever goes to addresses typed in by the admin.
export async function POST(req: Request) {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const limited = await rateLimit('campaignTest', gate.userId)
  if (!limited.ok) return NextResponse.json({ error: 'Too many test sends — wait a few minutes.' }, { status: 429, headers: rateLimitHeaders(limited) })

  const cfg = getMarketingConfig()
  if (!cfg.ready) return NextResponse.json({ error: 'Sending is not configured.', missing: cfg.missing }, { status: 409 })

  let body: { templateId?: string; campaignId?: string; to?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }) }

  const to = [...new Set((body.to ?? []).map(a => normaliseEmail(String(a))))].filter(isValidEmail).slice(0, 5)
  if (to.length === 0) return NextResponse.json({ error: 'Enter at least one valid email address.' }, { status: 400 })

  let templateId = body.templateId
  let fields: Record<string, string> = {}
  if (body.campaignId) {
    const { data: c } = await gate.supabase.from('vd_email_campaigns').select('template_id, merge_values').eq('id', body.campaignId).maybeSingle()
    if (c) { templateId = c.template_id ?? templateId; fields = (c.merge_values as Record<string, string>) ?? {} }
  }
  if (!templateId) return NextResponse.json({ error: 'Choose a template first.' }, { status: 400 })
  const { data: t } = await gate.supabase.from('vd_email_templates').select('*').eq('id', templateId).maybeSingle()
  if (!t) return NextResponse.json({ error: 'Template not found.' }, { status: 404 })

  const origin = getSiteOrigin(req)
  const results: { to: string; ok: boolean; error?: string }[] = []
  for (const address of to) {
    const rendered = renderCampaignEmail({
      template: {
        subject: t.subject, preheader: t.preheader, htmlBody: t.html_body,
        heroImageUrl: t.hero_image_url ?? '', heroImageAlt: t.hero_image_alt ?? '',
      },
      campaignFields: fields, contact: null, toEmail: address, origin,
      tokenSecret: cfg.tokenSecret, postalAddress: cfg.postalAddress, subjectPrefix: '[TEST] ',
    })
    const r = await sendBrevoEmail({
      apiKey: cfg.apiKey, fromEmail: cfg.senderEmail, fromName: cfg.senderName, replyTo: cfg.replyTo,
      to: address, subject: rendered.subject, html: rendered.html, text: rendered.text,
      headers: rendered.headers, tags: ['campaign-test'],
    })
    results.push(r.ok ? { to: address, ok: true } : { to: address, ok: false, error: r.error })
  }
  return NextResponse.json({ results })
}

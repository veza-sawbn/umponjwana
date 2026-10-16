import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSiteOrigin } from '@/lib/origin'
import { brevoConfigured, sendBrevoBatch } from '@/lib/brevo'
import { renderCampaignEmail } from '@/lib/campaign-send'
import { CONTACT_MERGE_TAGS } from '@/lib/email-merge-tags'

export const dynamic = 'force-dynamic'

/** A test is for the admin's own inboxes, so it stays small. */
const MAX_TEST_RECIPIENTS = 5
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const sample = Object.fromEntries(CONTACT_MERGE_TAGS.map(t => [t.key, t.sample]))

/**
 * Sends the campaign, subject prefixed "[Test]", to a few typed addresses so
 * the admin can see the real email in a real inbox before sending. It changes
 * nothing on the campaign, records nothing as sent, and doesn't need consent:
 * it goes to the person checking it. Personal tags are filled with the sample
 * values the builder shows, not anyone's real details.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })

  if (!brevoConfigured()) {
    return NextResponse.json({ error: 'Brevo is not configured — set BREVO_API_KEY and BREVO_SENDER_EMAIL.' }, { status: 503 })
  }

  let body: { emails?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }) }
  const emails = Array.from(new Set(
    (Array.isArray(body.emails) ? body.emails : []).map(e => String(e).trim().toLowerCase()).filter(Boolean),
  ))
  if (emails.length === 0) return NextResponse.json({ error: 'Enter at least one email address.' }, { status: 400 })
  if (emails.length > MAX_TEST_RECIPIENTS) {
    return NextResponse.json({ error: `A test goes to at most ${MAX_TEST_RECIPIENTS} addresses.` }, { status: 400 })
  }
  const invalid = emails.filter(e => !EMAIL.test(e))
  if (invalid.length) return NextResponse.json({ error: `Not an email address: ${invalid.join(', ')}` }, { status: 400 })

  const { data: campaign } = await supabase
    .from('vd_email_campaigns').select('id, template_id, merge_values').eq('id', params.id).maybeSingle()
  if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })
  if (!campaign.template_id) return NextResponse.json({ error: 'Add a template before sending a test.' }, { status: 400 })
  const { data: template } = await supabase
    .from('vd_email_templates').select('*').eq('id', campaign.template_id).maybeSingle()
  if (!template) return NextResponse.json({ error: 'template not found' }, { status: 400 })

  const origin = getSiteOrigin(req)
  const campaignFields = campaign.merge_values && typeof campaign.merge_values === 'object' ? campaign.merge_values : {}
  const messages = emails.map(email => {
    const m = renderCampaignEmail({
      origin,
      template: {
        subject: template.subject ?? '', preheader: template.preheader ?? '', htmlBody: template.html_body ?? '',
        heroImageUrl: template.hero_image_url ?? '', heroImageAlt: template.hero_image_alt ?? '',
      },
      recipient: {
        user_id: null, email, full_name: sample.full_name, country: sample.country, city: sample.city,
        lifecycle_stage: 'returning_customer', interests: ['hiking', 'birding'],
        favourite_destinations: [sample.favourite_destination], favourite_activities: [sample.favourite_activity],
        trip_count: Number(sample.trip_count) || 0, upcoming_travel: null,
      },
      campaignFields,
      postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
    })
    return { ...m, name: undefined, subject: `[Test] ${m.subject}` }
  })

  // Tagged "test:<id>", not the campaign id: the Brevo webhook only attributes
  // events whose tag is a bare campaign id, so a test's opens and clicks never
  // land in the campaign's figures.
  const result = await sendBrevoBatch({ messages, campaignId: `test:${params.id}`, unsubscribeUrl: `${origin}/unsubscribe` })
  if (result.error) return NextResponse.json({ sent: 0, error: result.error }, { status: result.uncertain ? 504 : 502 })
  return NextResponse.json({ sent: result.sent, error: null })
}

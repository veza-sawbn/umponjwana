import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { sendMail } from '@/lib/mailer'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { emailShell } from '@/lib/email-layout'
import { isSendable, toConsentState, type RecipientKind } from '@/lib/email-consent'
import { getSiteOrigin } from '@/lib/origin'

export const dynamic = 'force-dynamic'

// Sends a saved template to a hand-picked list of recipients, for real, over
// the SMTP mailbox in lib/mailer.ts.
//
// WHY THIS IS ALLOWED TO SEND WHEN vd_campaign_dry_run_send() IS NOT:
//   The 20260825 migration header rules out pointing the business mailbox at a
//   whole segment, and that still stands — no bounce or complaint webhooks, no
//   provider-side suppression list, and real reputation risk at volume. None
//   of those objections is about volume in the abstract; they are about BULK.
//   Fifty individually addressed messages, each chosen by a human, is ordinary
//   business correspondence, and the cap below is what keeps it that way. When
//   an ESP is wired in, this route is the thing that should start calling it —
//   the consent rules and the audit log stay exactly as they are.
const MAX_RECIPIENTS = 50

// Enough to be a courteous client to the mailbox host rather than opening
// fifty near-simultaneous transactions. Sequential sending is also what makes
// per-recipient results possible at all.
const DELAY_BETWEEN_SENDS_MS = 250

type IncomingRecipient = {
  email?: string
  name?: string
  kind?: RecipientKind
  id?: string
}

type SendOutcome = {
  email: string
  name: string
  status: 'sent' | 'skipped_no_consent' | 'skipped_opted_out' | 'failed'
  detail: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })

  let body: { templateId?: string; campaignId?: string; recipients?: IncomingRecipient[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!body.templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 })

  const incoming = body.recipients ?? []
  if (incoming.length === 0) return NextResponse.json({ error: 'select at least one recipient' }, { status: 400 })
  if (incoming.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `${incoming.length} recipients selected — this send is capped at ${MAX_RECIPIENTS}. Send in smaller batches.` },
      { status: 400 },
    )
  }

  // The template is read from the database by id rather than taken from the
  // request. The admin could edit it first either way, so this is not a trust
  // boundary — it is about the log: vd_email_sends records a template_id, and
  // that reference is worthless if the HTML actually sent came from somewhere
  // else.
  const { data: template } = await supabase
    .from('vd_email_templates')
    .select('id, name, subject, preheader, html_body, hero_image_url, hero_image_alt')
    .eq('id', body.templateId)
    .maybeSingle()
  if (!template) return NextResponse.json({ error: 'template not found' }, { status: 404 })
  if (!template.subject?.trim()) {
    return NextResponse.json({ error: 'this template has no subject line' }, { status: 400 })
  }

  const origin = getSiteOrigin(req)
  const admin = supabaseAdmin()

  // De-duplicated here as well as in the picker: the cap and the "did this
  // person already get it" guarantee both have to hold against a request that
  // did not come from our own UI.
  const seen = new Set<string>()
  const recipients = incoming.filter(r => {
    const email = r.email?.trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) return false
    seen.add(email)
    return true
  })

  const outcomes: SendOutcome[] = []

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]
    const email = r.email!.trim().toLowerCase()
    const name = r.name?.trim() || ''
    const kind: RecipientKind = r.kind === 'contact' ? 'contact' : 'customer'

    // The authoritative consent check. lib/email-recipients.ts computes the
    // same thing for the picker, but that is a display — this is the gate, and
    // it runs per recipient at the moment of sending rather than whenever the
    // admin last loaded the page.
    const { data: stateRaw } = await supabase.rpc('vd_consent_state', {
      p_email: email, p_consent_type: 'marketing_email',
    })
    const consent = toConsentState(stateRaw)

    if (!isSendable(kind, consent)) {
      outcomes.push({
        email, name,
        status: consent === 'withdrawn' ? 'skipped_opted_out' : 'skipped_no_consent',
        detail: consent === 'withdrawn'
          ? 'This address has opted out of marketing email.'
          : 'No marketing consent on record for this customer.',
      })
      continue
    }

    // Each recipient gets their own message and their own unsubscribe link,
    // rather than one message BCC'd to everyone. That is not politeness: a
    // shared unsubscribe link cannot identify who clicked it, and a BCC list
    // is one misconfiguration away from disclosing the whole list.
    const html = emailShell({
      origin,
      heading: template.subject,
      preheader: template.preheader || undefined,
      bodyHtml: template.html_body || '',
      hero: template.hero_image_url?.trim()
        ? { src: template.hero_image_url.trim(), alt: template.hero_image_alt?.trim() || '' }
        : undefined,
      footer: {
        variant: 'marketing',
        unsubscribeUrl: `${origin}/unsubscribe?email=${encodeURIComponent(email)}`,
        postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
      },
    })

    const { sent, error } = await sendMail({ to: email, subject: template.subject, html })
    outcomes.push({
      email, name,
      status: sent ? 'sent' : 'failed',
      detail: sent ? '' : (error ?? 'send failed'),
    })

    if (i < recipients.length - 1) await sleep(DELAY_BETWEEN_SENDS_MS)
  }

  // Logged through the service role: vd_email_sends has a select policy for
  // admins and no write policy at all, so nothing client-side can forge a
  // delivery record or quietly remove one.
  const { error: logError } = await admin.from('vd_email_sends').insert(
    outcomes.map((o, i) => ({
      template_id: template.id,
      campaign_id: body.campaignId ?? null,
      recipient_email: o.email,
      recipient_name: o.name,
      recipient_kind: recipients[i].kind === 'contact' ? 'contact' : 'customer',
      recipient_id: recipients[i].id ?? null,
      subject: template.subject,
      status: o.status,
      detail: o.detail,
      sent_by: user.id,
    })),
  )
  // A logging failure is reported but never swallows the send result — the
  // mail has already gone, and telling the admin it failed would be a lie.
  if (logError) console.error('[campaigns/send] audit log write failed:', logError)

  return NextResponse.json({
    outcomes,
    summary: {
      sent: outcomes.filter(o => o.status === 'sent').length,
      skipped: outcomes.filter(o => o.status.startsWith('skipped')).length,
      failed: outcomes.filter(o => o.status === 'failed').length,
    },
    logged: !logError,
  })
}

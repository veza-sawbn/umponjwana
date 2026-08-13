import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'
import { emailShell, ctaButton, detailTable, esc } from '@/lib/email-layout'
import { getSiteOrigin } from '@/lib/origin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/waivers/send  { requestId }
 *
 * Emails a participant their waiver link. Only the supplier who owns the
 * request (or an admin) may trigger it, so the token can't be mailed to an
 * address chosen by anyone else.
 *
 * The token is read server-side via the service role: it is never accepted
 * from the request body, so this endpoint cannot be used to have the platform
 * send an arbitrary link.
 */
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { requestId?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.requestId) {
    return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const { data: request } = await admin
    .from('vd_waiver_requests')
    .select('id, token, supplier_id, participant_name, participant_email, activity_name, service_date, expires_at, status')
    .eq('id', body.requestId)
    .maybeSingle()

  if (!request) return NextResponse.json({ error: 'Waiver request not found' }, { status: 404 })

  // Ownership: the signed-in user must be the supplier, a platform admin, or
  // an operations employee holding manage_customers on that supplier.
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  let permitted = profile?.role === 'admin' || request.supplier_id === user.id

  if (!permitted) {
    const { data: allowed } = await supabase.rpc('has_supplier_permission', {
      p_supplier_id: request.supplier_id,
      p_permission: 'manage_customers',
    })
    permitted = Boolean(allowed)
  }
  if (!permitted) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'This waiver is no longer awaiting a signature.' }, { status: 409 })
  }
  if (!request.participant_email) {
    return NextResponse.json({ error: 'This participant has no email address on file.' }, { status: 400 })
  }

  const { data: supplierProfile } = await admin
    .from('profiles').select('full_name').eq('id', request.supplier_id).maybeSingle()
  const supplierName = supplierProfile?.full_name || 'Visit Drakensberg'

  const origin = getSiteOrigin(req)
  const link = `${origin}/waiver/${request.token}`

  // detailTable escapes its own cells — pass raw values.
  const rows: [string, string][] = [['Activity', request.activity_name || '—']]
  if (request.service_date) rows.push(['Date', request.service_date])
  rows.push(['Operator', supplierName])
  if (request.expires_at) {
    rows.push(['Complete by', new Date(request.expires_at).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'long', year: 'numeric',
    })])
  }

  const html = emailShell({
    origin,
    eyebrow: 'Waiver',
    preheader: `Please sign your waiver for ${request.activity_name || 'your upcoming activity'}.`,
    heading: 'Your waiver is ready to sign',
    bodyHtml: `
      <p style="margin:0 0 14px;">Hi ${esc(request.participant_name || 'there')},</p>
      <p style="margin:0 0 14px;">
        ${esc(supplierName)} needs you to complete a short waiver before your activity.
        It takes a couple of minutes and can be signed on your phone.
      </p>
      ${detailTable(rows)}
      ${ctaButton(link, 'Review & sign your waiver')}
      <p style="margin:24px 0 0;font-size:13px;color:#666;">
        This link is personal to you — please don't forward it. If someone else on the
        booking still needs to sign, they will receive their own link.
      </p>
    `,
  })

  const { sent, error } = await sendMail({
    to: request.participant_email,
    subject: `Waiver to sign — ${request.activity_name || supplierName}`,
    html,
  })

  if (!sent) {
    // Non-fatal: the link exists regardless and the supplier can share it
    // directly from the portal.
    console.error('[waivers/send] mail failed:', error)
    return NextResponse.json({ ok: false, error: error || 'Could not send the email' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}

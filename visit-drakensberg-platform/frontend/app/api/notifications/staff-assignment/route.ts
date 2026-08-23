import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { sendMail } from '@/lib/mailer'
import { emailShell, detailTable, esc } from '@/lib/email-layout'

export const dynamic = 'force-dynamic'

// Emails a guide/driver appointed to a booking line via vd_assign_line_staff().
// Unlike lib/notifications.ts notify(), the recipient here is a supplier's own
// roster entry (vd_entities), not a platform user — there's no profiles row to
// look an address up from. So this route re-reads the line through the
// caller's own session (RLS already scopes vd_order_lines to the supplier
// themselves or ops staff with view_bookings/manage_bookings on that
// supplier), and only ever emails the assigned_email that vd_assign_line_staff
// itself set server-side — the caller cannot redirect the email elsewhere.
export async function POST(req: Request) {
  let payload: { lineId?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!payload.lineId) {
    return NextResponse.json({ error: 'lineId required' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: line } = await supabase
    .from('vd_order_lines')
    .select('title, category, service_date, end_date, guests, quantity, unit_label, order_number, supplier_name, assigned_name, assigned_email')
    .eq('id', payload.lineId)
    .maybeSingle()

  if (!line) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!line.assigned_email) return NextResponse.json({ sent: false, error: 'no assignment on this line' })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin

  const rows: [string, string][] = [
    ['Booking reference', line.order_number],
    ['Service', line.title],
    ...(line.service_date ? [['Date', new Date(line.service_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })] as [string, string]] : []),
    ...(line.end_date ? [['Until', new Date(line.end_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })] as [string, string]] : []),
    ...(line.guests ? [['Guests', String(line.guests)] as [string, string]] : []),
  ]

  const html = emailShell({
    origin,
    eyebrow: line.supplier_name,
    heading: "You've been appointed to a booking",
    preheader: `${line.title} — ${line.order_number}`,
    bodyHtml: `
      <p style="margin:0 0 4px;">Dear ${esc(line.assigned_name || 'there')},</p>
      <p style="margin:0 0 20px;">You've been appointed to deliver the booking below. Please confirm you're available.</p>
      ${detailTable(rows)}`,
  })

  const { sent, error } = await sendMail({
    to: line.assigned_email,
    subject: `You've been appointed — ${line.title}`,
    html,
  })

  return NextResponse.json({ sent, error })
}

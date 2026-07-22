import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export const dynamic = 'force-dynamic'

/*
 * Outbound message delivery for connected messaging channels.
 *
 * Runs under the CALLER's Supabase session, so RLS applies: only an admin can
 * read `vd_channel_connections` (which holds the tokens), which means only an
 * admin can trigger a send. WhatsApp / Messenger / Instagram deliver via the
 * Meta Graph API using the stored credentials; other channels return 501 until
 * their provider integration is added.
 *
 * Inbound messages (customer → us) arrive via each provider's webhook, which
 * is a separate public endpoint the connection settings page documents.
 */

const GRAPH = 'https://graph.facebook.com/v21.0'

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let payload: { channel?: string; to?: string; body?: string }
  try { payload = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const { channel, to, body } = payload
  if (!channel || !to || !body) return NextResponse.json({ error: 'channel, to and body are required' }, { status: 400 })

  // Admin-only RLS on this table means a non-admin simply gets no row.
  const { data: conn } = await supabase.from('vd_channel_connections').select('*').eq('channel', channel).maybeSingle()
  if (!conn || !(conn as any).connected) {
    return NextResponse.json({ error: `The ${channel} channel is not connected.` }, { status: 409 })
  }
  const config = (conn as any).config ?? {}
  const secret = (conn as any).secret ?? {}

  try {
    if (channel === 'whatsapp') {
      const token = secret.accessToken
      const phoneNumberId = config.phoneNumberId
      if (!token || !phoneNumberId) return NextResponse.json({ error: 'WhatsApp is missing a Phone Number ID or access token.' }, { status: 409 })
      const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: json?.error?.message || 'WhatsApp API error' }, { status: 502 })
      return NextResponse.json({ delivered: true, providerRef: json?.messages?.[0]?.id })
    }

    if (channel === 'messenger' || channel === 'instagram') {
      const token = secret.pageAccessToken
      const pageId = config.pageId
      if (!token || !pageId) return NextResponse.json({ error: 'Missing a Page ID or Page access token.' }, { status: 409 })
      const res = await fetch(`${GRAPH}/${pageId}/messages?access_token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: to }, message: { text: body }, messaging_type: 'RESPONSE' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: json?.error?.message || 'Meta Graph API error' }, { status: 502 })
      return NextResponse.json({ delivered: true, providerRef: json?.message_id })
    }

    return NextResponse.json({ error: `Outbound delivery for ${channel} is not implemented yet.` }, { status: 501 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Delivery failed' }, { status: 502 })
  }
}

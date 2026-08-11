import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { OpsRole } from '@/lib/ops-assignments'

export const dynamic = 'force-dynamic'

const VALID_OPS_ROLES: (OpsRole | null)[] = [
  'reservation_agent',
  'reservations_manager',
  'asset_manager',
  'ops_administrator',
  null,
]

/**
 * POST /api/admin/ops/profile
 * Set or update an existing user's ops_role and organisation.
 * Used when promoting an existing platform user to a VD Operations role
 * (as opposed to inviting a brand-new user via ops/invite).
 */
export async function POST(req: Request) {
  let body: { userId?: string; opsRole?: OpsRole | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!body.userId || !/^[0-9a-f-]{36}$/.test(body.userId)) {
    return NextResponse.json({ error: 'valid userId required' }, { status: 400 })
  }
  if (!VALID_OPS_ROLES.includes(body.opsRole ?? null)) {
    return NextResponse.json({ error: 'valid opsRole required' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 })
  }

  const { error } = await supabase.rpc('admin_set_ops_profile', {
    p_user: body.userId,
    p_ops_role: body.opsRole ?? null,
    p_organisation: 'vd_operations',
  })

  if (error) {
    console.error('[ops/profile] failed:', error)
    return NextResponse.json({ error: error.message || 'Could not update profile' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

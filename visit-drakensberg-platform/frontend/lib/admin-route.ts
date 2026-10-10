import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

// SERVER ONLY. The admin gate the app/api/admin/* routes share: a signed-in
// user whose profile role is 'admin'. Returns the user-scoped Supabase client
// so RPCs that check is_admin() in SQL run as that admin, not as the service.
export async function requireAdminRoute(): Promise<
  | { ok: true; userId: string; supabase: ReturnType<typeof createRouteHandlerClient> }
  | { ok: false; response: NextResponse }
> {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return { ok: false, response: NextResponse.json({ error: 'admin only' }, { status: 403 }) }
  return { ok: true, userId: user.id, supabase }
}

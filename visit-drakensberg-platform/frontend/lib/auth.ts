import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Fall back to placeholder credentials so static prerendering doesn't crash
// when env vars are absent at build time (e.g. CI). All real queries happen
// client-side at runtime, where the genuine NEXT_PUBLIC_* values are present.
export const supabase = createClientComponentClient({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
})

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string, fullName: string, role = 'visitor') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
  })
  if (error) throw error
}

export type StaffAccess = {
  role?: string
  staffRole?: string
  /** Admin or a finance/operations collaborator — console access. */
  isStaff: boolean
  /** Full CMS rights: publishing content, editing the live site. */
  isAdmin: boolean
}

/**
 * Resolves the signed-in user's role the same way middleware.ts does: auth
 * metadata first, then the profiles table — which is what RLS reads and what
 * admin_set_staff_role() writes, so a promotion can exist there and nowhere
 * else. Client-side gates must agree with the middleware, otherwise a real
 * admin gets through to the console and then finds editing switched off.
 */
export async function resolveStaffAccess(): Promise<StaffAccess> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isStaff: false, isAdmin: false }

  let role: string | undefined = user.app_metadata?.role ?? user.user_metadata?.role
  let staffRole: string | undefined = user.app_metadata?.staff_role ?? user.user_metadata?.staff_role

  if (role !== 'admin' && !staffRole) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, staff_role')
      .eq('id', user.id)
      .maybeSingle()
    role = (profile as { role?: string } | null)?.role ?? role
    staffRole = (profile as { staff_role?: string } | null)?.staff_role ?? undefined
  }

  const isAdmin = role === 'admin'
  return {
    role,
    staffRole,
    isAdmin,
    isStaff: isAdmin || staffRole === 'finance' || staffRole === 'operations',
  }
}

export function onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
  return supabase.auth.onAuthStateChange(callback)
}

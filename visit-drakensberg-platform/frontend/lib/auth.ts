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
  // Delegate to the server-side API route so that:
  //   1. The redirectTo URL is built from reliable request headers (x-forwarded-host
  //      / x-forwarded-proto), not the NEXT_PUBLIC_SITE_URL env var which may be
  //      missing the "https://" scheme or point to a wrong host.
  //   2. The admin client (service-role key) is used, removing any dependency on
  //      the browser-side anon key being correctly injected at build time.
  // Without this fix, a misconfigured NEXT_PUBLIC_SITE_URL causes Supabase to
  // redirect the password-reset link to an invalid URL (often the Supabase REST
  // endpoint itself), which responds with
  //   {"message":"No API key found in request",...}
  const res = await fetch('/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    let message = 'Failed to send reset email'
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch { /* ignore parse error */ }
    throw new Error(message)
  }
}

export function onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
  return supabase.auth.onAuthStateChange(callback)
}

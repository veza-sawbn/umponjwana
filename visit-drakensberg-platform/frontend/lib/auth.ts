import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { captchaOptions } from './turnstile'

// Fall back to placeholder credentials so static prerendering doesn't crash
// when env vars are absent at build time (e.g. CI). All real queries happen
// client-side at runtime, where the genuine NEXT_PUBLIC_* values are present.
export const supabase = createClientComponentClient({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
})

// captchaToken: a Cloudflare Turnstile token, when the deployment has a site
// key. These two calls go from the browser straight to *.supabase.co — no
// Vercel function sees them — so the token is checked by Supabase itself
// (Authentication → Attack Protection), not by anything in this repository.
// captchaOptions() sends no field at all when there is no token, which is what
// a deployment with the setting switched off needs. See lib/turnstile.ts.

export async function signIn(email: string, password: string, captchaToken?: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaOptions(captchaToken),
  })
  if (error) throw error
  return data
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role = 'visitor',
  captchaToken?: string,
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role }, ...captchaOptions(captchaToken) },
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

export async function resetPassword(email: string, captchaToken?: string) {
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
  //
  // The captcha token travels in the body rather than through Supabase: this
  // route holds the service-role key, and service-role calls bypass GoTrue's
  // captcha entirely, so the route verifies the token itself against
  // Cloudflare's siteverify (lib/turnstile-verify.ts).
  const res = await fetch('/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, captchaToken }),
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

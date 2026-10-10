'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import AuthPhoto from '@/components/auth/AuthPhoto'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signIn, isEmailNotConfirmed, resendConfirmation, supabase } from '@/lib/auth'
import { trackEvent, AnalyticsEvent } from '@/lib/analytics'
import { safeRedirectPath } from '@/lib/safe-redirect'
import Turnstile, {
  captchaBlocked,
  turnstileErrorMessage,
  type TurnstileHandle,
} from '@/components/security/Turnstile'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
})
type Form = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [authError, setAuthError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState('')
  const turnstile = useRef<TurnstileHandle>(null)
  // The address sign-in was refused for as unconfirmed — offers a resend.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  // ?confirmed=1 — /api/auth/callback after a confirmation link that couldn't
  // also sign the person in (opened in a different browser).
  const [justConfirmed, setJustConfirmed] = useState(false)
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    setJustConfirmed(query.get('confirmed') === '1')
    // A refused email link: ?link_error= from /api/auth/callback, or GoTrue's
    // own #error_code= when it redirected straight here.
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const linkError = query.get('link_error') ?? hash.get('error_code')
    if (linkError) {
      setAuthError(
        linkError === 'otp_expired'
          ? 'That confirmation link has expired or was already used. Sign in below — if your email still needs confirming, you can get a fresh link.'
          : 'That email link didn\'t work. Sign in below — if your email still needs confirming, you can get a fresh link.',
      )
    }
  }, [])
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onResend = async () => {
    if (!unconfirmedEmail) return
    setAuthError(null)
    setResendState('sending')
    try {
      await resendConfirmation(unconfirmedEmail, '/account', captchaToken)
      setResendState('sent')
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Could not resend the email')
      setResendState('idle')
    } finally {
      turnstile.current?.reset()
    }
  }

  const onSubmit = async (data: Form) => {
    setAuthError(null)
    setUnconfirmedEmail(null)
    setResendState('idle')
    try {
      const result = await signIn(data.email, data.password, captchaToken)
      let role = result?.user?.app_metadata?.role ?? result?.user?.user_metadata?.role
      let staffRole = result?.user?.app_metadata?.staff_role ?? result?.user?.user_metadata?.staff_role

      // Auth metadata is set at invite/creation time and can be incomplete —
      // e.g. accounts created outside the standard invite flow, or ones where
      // only user_metadata (not app_metadata) was ever set. profiles is the
      // authoritative record for both fields, so confirm against it rather
      // than trust metadata alone: this is the same fallback middleware.ts
      // already uses, kept in sync here so the very first navigation lands
      // in the right place instead of bouncing through a wrong default and
      // back.
      if (result?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, staff_role')
          .eq('id', result.user.id)
          .maybeSingle()
        if (profile) {
          role = profile.role ?? role
          staffRole = profile.staff_role ?? staffRole
        }
      }

      // Awaited so the hard navigation below doesn't tear the page down
      // mid-request and silently drop the event (same fix as registration).
      await trackEvent(AnalyticsEvent.LOGIN, { role })

      const redirect = new URLSearchParams(window.location.search).get('redirect')
      // Operations employees have role='visitor' but belong in their own
      // /operations environment — not the admin console.
      const defaultPath =
        role === 'supplier' ? '/supplier'
        : role === 'admin' ? '/admin'
        : staffRole === 'operations' ? '/operations'
        : '/account'
      // The inline check here used to be startsWith('/') && !startsWith('//'),
      // which misses '/\host' (browsers read it as protocol-relative too) and
      // encoded separators. One shared validator, same as /api/auth/callback.
      const targetPath = safeRedirectPath(redirect, defaultPath)
      // Hard navigation: guarantees the middleware sees the fresh session
      // cookie and bypasses any prefetched redirect cached by the router.
      window.location.assign(targetPath)
    } catch (err: unknown) {
      if (isEmailNotConfirmed(err)) {
        setUnconfirmedEmail(data.email)
        setAuthError('Please confirm your email address first. We sent you a link when you created your account.')
      } else {
        setAuthError(err instanceof Error ? err.message : 'Sign in failed')
      }
      // The token was spent on the attempt that just failed — a second submit
      // with the same one is refused by Supabase for a reason that has nothing
      // to do with the password, so hand the visitor a fresh challenge.
      turnstile.current?.reset()
    }
  }

  return (
    <div className="min-h-screen bg-mist flex pt-16">
      {/* Left — image */}
      <div className="hidden lg:block relative w-1/2 bg-forest overflow-hidden">
        <AuthPhoto src="https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=1200&q=85" />
        <div className="absolute inset-0 bg-forest/40" />
        <div className="absolute bottom-12 left-12 right-12">
          <Link href="/" className="font-display italic text-2xl text-gold">Visit Drakensberg</Link>
          <p className="font-sans text-sm text-white/80 mt-3 leading-relaxed">
            Africa&apos;s highest mountain range. Book stays, hikes, and experiences across the Drakensberg escarpment.
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="lg:hidden font-display italic text-xl text-forest block mb-10">
            Visit Drakensberg
          </Link>
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">Welcome back</p>
          <h1 className="font-display text-4xl text-forest mb-8">Sign in</h1>

          {justConfirmed && !authError && (
            <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 font-sans text-sm text-green-800">
              Your email is confirmed. Sign in to continue.
            </div>
          )}

          {authError && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 font-sans text-sm text-red-700">
              {authError}
              {unconfirmedEmail && resendState !== 'sent' && (
                <button type="button" onClick={onResend}
                  disabled={resendState === 'sending' || captchaBlocked(captchaToken)}
                  className="block mt-2 underline font-medium disabled:opacity-50">
                  {resendState === 'sending' ? 'Sending…' : `Resend the link to ${unconfirmedEmail}`}
                </button>
              )}
            </div>
          )}

          {resendState === 'sent' && (
            <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 font-sans text-sm text-green-800">
              Sent. Check your inbox (and spam folder) for the newest email and open the link in it.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div>
              <label className="font-sans text-xs tracking-[0.1em] uppercase text-forest/50 block mb-2">
                Email address
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`w-full bg-white border px-4 py-3 font-sans text-sm text-forest placeholder:text-forest/25 focus:outline-none focus:border-forest transition-colors ${errors.email ? 'border-red-400' : 'border-black/15'}`}
              />
              {errors.email && <p className="font-sans text-xs text-red-500 mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-sans text-xs tracking-[0.1em] uppercase text-forest/50">Password</label>
                <Link href="/auth/forgot-password" className="font-sans text-xs text-forest/40 hover:text-gold transition-colors">
                  Forgot?
                </Link>
              </div>
              <input
                {...register('password')}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className={`w-full bg-white border px-4 py-3 font-sans text-sm text-forest focus:outline-none focus:border-forest transition-colors ${errors.password ? 'border-red-400' : 'border-black/15'}`}
              />
              {errors.password && <p className="font-sans text-xs text-red-500 mt-1.5">{errors.password.message}</p>}
            </div>

            <Turnstile
              ref={turnstile}
              action="login"
              onToken={setCaptchaToken}
              onError={code => setAuthError(turnstileErrorMessage(code))}
              className="flex justify-center"
            />

            <button
              type="submit"
              disabled={isSubmitting || captchaBlocked(captchaToken)}
              className="w-full bg-forest text-white py-3.5 font-sans text-sm hover:bg-sage transition-colors disabled:opacity-50 mt-2"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="font-sans text-sm text-forest/50 text-center mt-8">
            No account?{' '}
            <Link href="/auth/register" className="text-forest hover:text-gold transition-colors font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

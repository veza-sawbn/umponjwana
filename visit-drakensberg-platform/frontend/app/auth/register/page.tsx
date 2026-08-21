'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signUp, supabase } from '@/lib/auth'
import { trackEvent, AnalyticsEvent } from '@/lib/analytics'

const schema = z.object({
  fullName: z.string().min(2, 'At least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters').regex(/[A-Z]/, 'Needs an uppercase letter').regex(/[0-9]/, 'Needs a number'),
  confirmPassword: z.string(),
  role: z.enum(['visitor', 'supplier']),
  marketingConsent: z.boolean().optional(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })

type Form = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const [authError, setAuthError] = useState<string | null>(null)
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'visitor', marketingConsent: false },
  })

  const role = watch('role')

  const onSubmit = async (data: Form) => {
    setAuthError(null)
    try {
      await signUp(data.email, data.password, data.fullName, data.role)
      // Consent + funnel tracking never block account creation on failure —
      // both are awaited (not fire-and-forget) purely so the hard navigation
      // right after doesn't tear the page down mid-request and silently
      // drop them; a failed write here still doesn't stop signup.
      // vd_set_consent() writes an audit-trail row (§22); account_created
      // feeds the Prospect -> Customer journey (§3, §21).
      if (data.marketingConsent) {
        const { error } = await supabase.rpc('vd_set_consent', {
          p_email: data.email, p_consent_type: 'marketing_email', p_granted: true, p_source: 'registration',
        })
        if (error) console.error('[register] consent record failed:', error)
      }
      await trackEvent(AnalyticsEvent.ACCOUNT_CREATED, { role: data.role })
      // Hard navigation so middleware sees the fresh session cookie.
      window.location.assign(data.role === 'supplier' ? '/supplier' : '/account')
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen bg-mist flex">
      {/* Left */}
      <div className="hidden lg:block relative w-1/2">
        <img
          src="https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=85"
          alt="Drakensberg"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-forest/40" />
        <div className="absolute bottom-12 left-12 right-12">
          <Link href="/" className="font-display italic text-2xl text-gold">Visit Drakensberg</Link>
          <p className="font-sans text-sm text-white/60 mt-3 leading-relaxed">
            Join thousands of guests and local suppliers on South Africa&apos;s mountain travel platform.
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 flex items-center justify-center px-6 py-16 overflow-y-auto">
        <div className="w-full max-w-sm">
          <Link href="/" className="lg:hidden font-display italic text-xl text-forest block mb-10">
            Visit Drakensberg
          </Link>
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-forest/40 mb-2">Get started</p>
          <h1 className="font-display text-4xl text-forest mb-8">Create account</h1>

          {authError && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 font-sans text-sm text-red-700">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Role selector */}
            <div>
              <p className="font-sans text-xs tracking-[0.1em] uppercase text-forest/50 mb-3">I am a</p>
              <div className="grid grid-cols-2 gap-3">
                {(['visitor', 'supplier'] as const).map((r) => (
                  <label key={r}
                    className={`flex items-center justify-center gap-2 border px-4 py-3 cursor-pointer transition-colors ${role === r ? 'border-forest bg-forest text-white' : 'border-black/15 bg-white text-forest/60 hover:border-forest'}`}>
                    <input {...register('role')} type="radio" value={r} className="sr-only" />
                    <span className="font-sans text-sm capitalize">{r === 'visitor' ? 'Guest / Traveller' : 'Property / Activity Supplier'}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="font-sans text-xs tracking-[0.1em] uppercase text-forest/50 block mb-2">Full name</label>
              <input {...register('fullName')} type="text" placeholder="Your name"
                className={`w-full bg-white border px-4 py-3 font-sans text-sm text-forest placeholder:text-forest/25 focus:outline-none focus:border-forest transition-colors ${errors.fullName ? 'border-red-400' : 'border-black/15'}`} />
              {errors.fullName && <p className="font-sans text-xs text-red-500 mt-1.5">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="font-sans text-xs tracking-[0.1em] uppercase text-forest/50 block mb-2">Email address</label>
              <input {...register('email')} type="email" placeholder="you@example.com"
                className={`w-full bg-white border px-4 py-3 font-sans text-sm text-forest placeholder:text-forest/25 focus:outline-none focus:border-forest transition-colors ${errors.email ? 'border-red-400' : 'border-black/15'}`} />
              {errors.email && <p className="font-sans text-xs text-red-500 mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <label className="font-sans text-xs tracking-[0.1em] uppercase text-forest/50 block mb-2">Password</label>
              <input {...register('password')} type="password" placeholder="Min. 8 characters"
                className={`w-full bg-white border px-4 py-3 font-sans text-sm text-forest placeholder:text-forest/25 focus:outline-none focus:border-forest transition-colors ${errors.password ? 'border-red-400' : 'border-black/15'}`} />
              {errors.password && <p className="font-sans text-xs text-red-500 mt-1.5">{errors.password.message}</p>}
            </div>

            <div>
              <label className="font-sans text-xs tracking-[0.1em] uppercase text-forest/50 block mb-2">Confirm password</label>
              <input {...register('confirmPassword')} type="password" placeholder="••••••••"
                className={`w-full bg-white border px-4 py-3 font-sans text-sm text-forest placeholder:text-forest/25 focus:outline-none focus:border-forest transition-colors ${errors.confirmPassword ? 'border-red-400' : 'border-black/15'}`} />
              {errors.confirmPassword && <p className="font-sans text-xs text-red-500 mt-1.5">{errors.confirmPassword.message}</p>}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input {...register('marketingConsent')} type="checkbox"
                className="mt-0.5 h-4 w-4 border-black/20 text-forest focus:ring-forest" />
              <span className="font-sans text-xs text-forest/50 leading-relaxed">
                Send me trip inspiration, seasonal offers and Drakensberg updates. You can unsubscribe anytime.
              </span>
            </label>

            <button type="submit" disabled={isSubmitting}
              className="w-full bg-forest text-white py-3.5 font-sans text-sm hover:bg-sage transition-colors disabled:opacity-50 mt-2">
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="font-sans text-sm text-forest/50 text-center mt-8">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-forest hover:text-gold transition-colors font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

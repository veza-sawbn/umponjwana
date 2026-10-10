'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { requestNewsletterOptIn } from '@/lib/newsletter-client'
import { trackEvent, AnalyticsEvent } from '@/lib/analytics'

interface NewsletterSignupProps {
  /** Entry point this signup belongs to (e.g. `hikes_hero`). Recorded on the
   *  consent row and the analytics event so subscribers can be attributed to
   *  the place they signed up. */
  source: string
  /** Unique id for the email input — pages may render more than one form. */
  inputId: string
  label: string
  buttonLabel?: string
  placeholder?: string
  successMessage?: string
  /** `dark` inverts the field styling for use on the forest hero bands. */
  tone?: 'light' | 'dark'
  className?: string
}

/**
 * Mailing-list signup form (double opt-in). Submitting emails the address a
 * confirmation link; consent is recorded only once that link is confirmed —
 * see app/api/marketing/subscribe and supabase/migrations/20261007_marketing_send_pipeline.sql.
 */
export default function NewsletterSignup({
  source,
  inputId,
  label,
  buttonLabel = 'Subscribe',
  placeholder = 'Your email address',
  successMessage = 'Almost there — check your inbox and confirm your email to join the list.',
  tone = 'light',
  className = '',
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  const [subscribing, setSubscribing] = useState(false)

  const dark = tone === 'dark'
  const fieldClass = dark
    ? 'bg-white/10 border-white/25 text-white placeholder:text-white/40 focus:border-white'
    : 'bg-white border-black/10 text-forest placeholder:text-forest/30 focus:border-forest'
  const buttonClass = dark
    ? 'bg-gold text-forest hover:bg-white'
    : 'bg-forest text-white hover:bg-sage'

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    const address = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      toast.error('Please enter a valid email address.')
      return
    }
    setSubscribing(true)
    try {
      const result = await requestNewsletterOptIn(address, source)
      if (!result.ok) throw new Error(result.error)
      // The funnel event is best-effort. Consent itself is recorded only when
      // the visitor confirms from the email we just sent (double opt-in).
      trackEvent(AnalyticsEvent.NEWSLETTER_SIGNUP, { source })
      toast.success(successMessage)
      setEmail('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Subscription failed. Please try again later.')
    } finally {
      setSubscribing(false)
    }
  }

  return (
    <form className={`flex max-w-md ${className}`} onSubmit={subscribe}>
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <input
        id={inputId}
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 min-w-0 px-4 py-3 border font-sans text-sm focus:outline-none transition-colors ${fieldClass}`}
      />
      <button
        type="submit"
        disabled={subscribing}
        className={`px-6 py-3 font-sans text-sm whitespace-nowrap transition-colors disabled:opacity-60 ${buttonClass}`}
      >
        {subscribing ? 'Subscribing…' : buttonLabel}
      </button>
    </form>
  )
}

'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/auth'
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
 * Mailing-list signup form. Writes the address to `vd_newsletter_subscribers`
 * (insert-only for the public) and records explicit marketing consent through
 * `vd_set_consent`, exactly like the homepage newsletter block — see
 * supabase/migrations/20260824_customer_intelligence_foundation.sql.
 */
export default function NewsletterSignup({
  source,
  inputId,
  label,
  buttonLabel = 'Subscribe',
  placeholder = 'Your email address',
  successMessage = 'You’re on the list — see you in the next dispatch.',
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
      const { error } = await supabase.from('vd_newsletter_subscribers').insert({ email: address })
      // 23505 = already subscribed; treat as success.
      if (error && error.code !== '23505') throw error
      // Consent + funnel event are best-effort: neither blocks the
      // confirmation the visitor sees.
      supabase.rpc('vd_set_consent', {
        p_email: address, p_consent_type: 'marketing_email', p_granted: true, p_source: source,
      }).then(({ error: consentError }) => { if (consentError) console.error('[newsletter] consent record failed:', consentError) })
      trackEvent(AnalyticsEvent.NEWSLETTER_SIGNUP, { source })
      toast.success(successMessage)
      setEmail('')
    } catch {
      toast.error('Subscription failed. Please try again later.')
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

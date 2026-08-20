'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/auth'

// Public, unauthenticated opt-out (§22 — "Unsubscribe functionality"). No
// login required: requiring an account to stop receiving marketing email is
// exactly the kind of friction consent law (POPIA/CAN-SPAM alike) exists to
// prevent. vd_set_consent() appends an audit-trail row rather than deleting
// anything, so the platform always has a record of when and how someone
// opted out.
const CONSENT_TYPE = 'marketing_email'

function UnsubscribeForm() {
  const params = useSearchParams()
  const emailParam = params.get('email') || ''
  const [email, setEmail] = useState(emailParam)
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [alreadyChecked, setAlreadyChecked] = useState(false)
  const [alreadyOptedOut, setAlreadyOptedOut] = useState(false)

  useEffect(() => {
    if (!emailParam) return
    supabase.rpc('vd_is_subscribed', { p_email: emailParam, p_consent_type: CONSENT_TYPE })
      .then(({ data }) => { setAlreadyOptedOut(data === false); setAlreadyChecked(true) })
      .catch(() => setAlreadyChecked(true))
  }, [emailParam])

  async function handleUnsubscribe() {
    if (!email.trim()) return
    setStatus('working')
    const { error } = await supabase.rpc('vd_set_consent', {
      p_email: email.trim(), p_consent_type: CONSENT_TYPE, p_granted: false, p_source: 'unsubscribe_link',
    })
    setStatus(error ? 'error' : 'done')
  }

  if (status === 'done' || (alreadyChecked && alreadyOptedOut && email === emailParam)) {
    return (
      <div className="text-center">
        <h1 className="font-display italic text-3xl text-[#000000] mb-3">You&apos;re unsubscribed</h1>
        <p className="font-sans text-sm text-gray-500 mb-6">
          {email} won&apos;t receive marketing emails from Visit Drakensberg. Booking confirmations and other
          trip-related messages for existing bookings will still be sent — those aren&apos;t marketing.
        </p>
        <Link href="/" className="font-sans text-sm text-[#2d6a4f] hover:text-[#C9A96E] transition-colors">
          Return to Visit Drakensberg
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center">
      <h1 className="font-display italic text-3xl text-[#000000] mb-3">Unsubscribe</h1>
      <p className="font-sans text-sm text-gray-500 mb-6">
        Confirm the email address to stop receiving marketing and campaign emails from Visit Drakensberg.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full max-w-sm mx-auto block border border-gray-200 px-4 py-3 font-sans text-sm text-[#000000] placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f] transition-colors mb-4"
      />
      <button
        onClick={handleUnsubscribe}
        disabled={status === 'working' || !email.trim()}
        className="bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#245a41] transition-colors disabled:opacity-50"
      >
        {status === 'working' ? 'Unsubscribing…' : 'Unsubscribe'}
      </button>
      {status === 'error' && (
        <p className="font-sans text-xs text-red-500 mt-4">Something went wrong — please try again.</p>
      )}
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md">
        <Suspense>
          <UnsubscribeForm />
        </Suspense>
      </div>
    </div>
  )
}

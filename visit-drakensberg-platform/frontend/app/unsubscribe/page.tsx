'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

// Public, unauthenticated opt-out (§22 — "Unsubscribe functionality"). No
// login is required: making someone sign in to stop receiving marketing email
// is exactly the friction POPIA and CAN-SPAM exist to prevent.
//
// Two ways in, both safe:
//  * A link from one of our emails carries a signed token (?t=) bound to the
//    recipient's address. One click confirms it. The page asks for that click
//    instead of acting on load, because mail scanners fetch every link.
//  * Without a token, the visitor types their address and we EMAIL them a
//    signed link. We never opt an address out on a typed address alone — the
//    old ?email= flow let anyone unsubscribe anyone.
//
// Opt-out appends an audit-trail row and clears the cached flag on any account
// with that address (see vd_record_marketing_consent); nothing is deleted.

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return ''
  return `${local[0]}${'•'.repeat(Math.max(1, Math.min(local.length - 1, 6)))}@${domain}`
}

/** The token's first segment is just the base64url address — shown so the
 *  person can see which address they are about to opt out. The server, not
 *  this, verifies the signature. */
function addressFromToken(token: string | null): string {
  if (!token) return ''
  try {
    const b64 = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    return atob(b64)
  } catch { return '' }
}

function UnsubscribeForm() {
  const params = useSearchParams()
  const token = params.get('t')
  const tokenEmail = addressFromToken(token)

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'link_sent' | 'error'>('idle')

  async function confirmWithToken() {
    setStatus('working')
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token }),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch { setStatus('error') }
  }

  async function requestLink() {
    if (!email.trim()) return
    setStatus('working')
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }),
      })
      setStatus(res.ok ? 'link_sent' : 'error')
    } catch { setStatus('error') }
  }

  if (status === 'done') {
    return (
      <div className="text-center">
        <h1 className="font-display italic text-3xl text-[#000000] mb-3">You&apos;re unsubscribed</h1>
        <p className="font-sans text-sm text-gray-500 mb-6">
          {tokenEmail ? maskEmail(tokenEmail) : 'This address'} won&apos;t receive marketing emails from Visit Drakensberg. Booking
          confirmations and other trip-related messages for existing bookings will still be sent, as those are not marketing.
        </p>
        <Link href="/" className="font-sans text-sm text-[#2d6a4f] hover:text-[#C9A96E] transition-colors">
          Return to Visit Drakensberg
        </Link>
      </div>
    )
  }

  if (status === 'link_sent') {
    return (
      <div className="text-center">
        <h1 className="font-display italic text-3xl text-[#000000] mb-3">Check your inbox</h1>
        <p className="font-sans text-sm text-gray-500">
          If that address is on our list, we&apos;ve emailed it a link to finish unsubscribing. It&apos;s a safety step — it stops
          anyone else from opting you out.
        </p>
      </div>
    )
  }

  if (token && tokenEmail) {
    return (
      <div className="text-center">
        <h1 className="font-display italic text-3xl text-[#000000] mb-3">Unsubscribe</h1>
        <p className="font-sans text-sm text-gray-500 mb-6">
          Stop marketing and campaign emails from Visit Drakensberg to <strong>{maskEmail(tokenEmail)}</strong>?
        </p>
        <button
          onClick={confirmWithToken}
          disabled={status === 'working'}
          className="bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#245a41] transition-colors disabled:opacity-50"
        >
          {status === 'working' ? 'Unsubscribing…' : 'Confirm unsubscribe'}
        </button>
        {status === 'error' && (
          <p className="font-sans text-xs text-red-500 mt-4">That link isn&apos;t valid any more. Enter your address below and we&apos;ll send a fresh one.</p>
        )}
        {status === 'error' && <RequestForm email={email} setEmail={setEmail} onSubmit={requestLink} working={false} />}
      </div>
    )
  }

  return (
    <div className="text-center">
      <h1 className="font-display italic text-3xl text-[#000000] mb-3">Unsubscribe</h1>
      <p className="font-sans text-sm text-gray-500 mb-6">
        Enter your email address and we&apos;ll send you a link to stop marketing and campaign emails from Visit Drakensberg.
      </p>
      <RequestForm email={email} setEmail={setEmail} onSubmit={requestLink} working={status === 'working'} />
      {status === 'error' && <p className="font-sans text-xs text-red-500 mt-4">Something went wrong. Please try again.</p>}
    </div>
  )
}

function RequestForm(p: { email: string; setEmail: (v: string) => void; onSubmit: () => void; working: boolean }) {
  return (
    <div className="mt-4">
      <input
        type="email"
        value={p.email}
        onChange={(e) => p.setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full max-w-sm mx-auto block border border-gray-200 px-4 py-3 font-sans text-sm text-[#000000] placeholder:text-gray-300 focus:outline-none focus:border-[#2d6a4f] transition-colors mb-4"
      />
      <button
        onClick={p.onSubmit}
        disabled={p.working || !p.email.trim()}
        className="bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#245a41] transition-colors disabled:opacity-50"
      >
        {p.working ? 'Sending…' : 'Email me an unsubscribe link'}
      </button>
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

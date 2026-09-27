'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled page error:', error)
  }, [error])

  return (
    <main className="min-h-screen bg-mist flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-4">Something went wrong</p>
        <h1 className="font-display italic text-4xl text-forest mb-4">We hit a rough patch</h1>
        <p className="font-sans text-sm text-forest/60 leading-relaxed mb-4">
          This page didn&apos;t load properly. It&apos;s usually a brief connection hiccup, so trying again
          often fixes it. Anything already in your trip is saved.
        </p>
        <p className="font-sans text-xs text-forest/50 leading-relaxed mb-8">
          Still stuck? Email{' '}
          <a href="mailto:hello@visitdrakensberg.com" className="underline underline-offset-2">hello@visitdrakensberg.com</a>
          {error.digest ? <> and quote reference <span className="font-mono">{error.digest}</span></> : null}.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={reset}
            className="px-6 py-3 bg-forest text-white font-sans text-sm hover:bg-sage transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-6 py-3 border border-forest text-forest font-sans text-sm hover:bg-forest hover:text-white transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}

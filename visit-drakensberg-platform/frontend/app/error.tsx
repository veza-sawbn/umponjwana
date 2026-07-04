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
        <p className="font-sans text-sm text-forest/60 leading-relaxed mb-8">
          An unexpected error occurred while loading this page. It&apos;s not you — please try again,
          or head back to the home page.
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

import Link from 'next/link'

export const metadata = { title: 'Down for Maintenance' }

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-mist flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-4">Maintenance</p>
        <h1 className="font-display italic text-5xl text-forest mb-4">Back soon</h1>
        <p className="font-sans text-sm text-forest/60 leading-relaxed">
          We&apos;re making some improvements to Visit Drakensberg and will be
          back online shortly. Thanks for your patience.
        </p>
        {/* Staff land here too when they hit the site signed out. Without this
            the console is unreachable while the banner is up: every public
            route redirects back here, so there is nothing to click through to
            /auth/login. */}
        <Link
          href="/auth/login?redirect=/admin"
          className="inline-block mt-10 font-sans text-xs tracking-[0.14em] uppercase text-forest/40 hover:text-gold transition-colors"
        >
          Staff sign in
        </Link>
      </div>
    </main>
  )
}

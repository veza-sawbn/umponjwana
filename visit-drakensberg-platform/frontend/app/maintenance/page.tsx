import Link from 'next/link'

export const metadata = { title: 'Down for Maintenance' }

// The public site is closed, but two doors stay open (see
// MAINTENANCE_EXEMPT_ROUTES in middleware.ts): the sign-in flow, so suppliers
// and staff can reach their consoles, and the operator listing application, so
// onboarding keeps running while the browse-and-book site is hidden.
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

        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <Link
            href="/auth/login"
            className="bg-forest text-white px-6 py-3 font-sans text-sm hover:bg-sage transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/list-with-us"
            className="border border-forest text-forest px-6 py-3 font-sans text-sm hover:bg-forest hover:text-white transition-colors"
          >
            List with us
          </Link>
        </div>

        <p className="font-sans text-xs text-forest/40 leading-relaxed mt-6">
          Suppliers can still sign in to their portal, and operators can apply to
          list with us while we work.
        </p>
      </div>
    </main>
  )
}

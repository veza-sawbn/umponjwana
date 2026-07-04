import Link from 'next/link'

export const metadata = { title: 'Page Not Found' }

export default function NotFound() {
  return (
    <main className="min-h-screen bg-mist flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-4">404 — Not Found</p>
        <h1 className="font-display italic text-5xl text-forest mb-4">Lost in the mist</h1>
        <p className="font-sans text-sm text-forest/60 leading-relaxed mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
          The mountain trails shift sometimes — let&apos;s get you back on route.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/"
            className="px-6 py-3 bg-forest text-white font-sans text-sm hover:bg-sage transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/search"
            className="px-6 py-3 border border-forest text-forest font-sans text-sm hover:bg-forest hover:text-white transition-colors"
          >
            Explore the Berg
          </Link>
        </div>
      </div>
    </main>
  )
}

'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F7F5F2' }}>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ color: '#2d6a4f', fontSize: '1.75rem', marginBottom: '0.75rem' }}>Something went wrong</h1>
            <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              A critical error occurred. Please refresh the page or try again shortly.
            </p>
            <button
              onClick={reset}
              style={{ background: '#2d6a4f', color: '#fff', border: 0, padding: '0.75rem 1.5rem', fontSize: '0.9rem', cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}

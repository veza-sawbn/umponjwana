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
      </div>
    </main>
  )
}

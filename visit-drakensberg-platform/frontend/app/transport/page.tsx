'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import EditablePageHeader from '@/components/editor/EditablePageHeader'
import { ArrowRight, Bus, Clock, MapPin } from 'lucide-react'
import { getPublishedRoutes, routeDurationLabel, routePrice, routeSlug, type Route } from '@/lib/transport-routes'
import { getTransportCompanies, type TransportCompany } from '@/lib/transport'
import { formatMoney } from '@/lib/allocation'

// Named shuttle routes are real supplier-authored data (see
// lib/transport-routes.ts) that previously had nowhere public to render —
// only the on-demand quote tool at /shuttles read live locations, never
// these fixed, reusable routes (SEO audit G17). This listing + the detail
// route it links to close that gap. See docs/destination-graph/PHASE_C.md.
export default function TransportPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [companies, setCompanies] = useState<TransportCompany[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getPublishedRoutes(), getTransportCompanies()])
      .then(([r, c]) => { setRoutes(r); setCompanies(c) })
      .finally(() => setLoading(false))
  }, [])

  const companyName = (supplierId: string) => companies.find(c => c.supplierId === supplierId)?.companyName

  return (
    <main className="bg-mist min-h-screen pt-16">
      <EditablePageHeader section="transport_page" subClassName="max-w-2xl" />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        {loading ? (
          <div className="py-20 text-center font-sans text-sm text-forest/30">Loading routes…</div>
        ) : routes.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display italic text-2xl text-forest/30 mb-2">No fixed routes listed yet</p>
            <p className="font-sans text-sm text-forest/50">
              Need a transfer? Get an instant quote on the <Link href="/shuttles" className="text-forest underline hover:text-gold">shuttle booking tool</Link>.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {routes.map(r => (
              <Link key={r.id} href={`/transport/${routeSlug(r)}`} className="group block border border-forest/10 bg-white hover:border-gold/40 transition-colors p-5">
                <div className="flex items-center gap-2 font-sans text-base font-medium text-forest">
                  <MapPin className="w-4 h-4 text-forest/30 shrink-0" />
                  <span className="truncate">{r.from}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gold shrink-0" />
                  <span className="truncate">{r.to}</span>
                </div>
                <div className="flex items-center gap-4 mt-3 font-sans text-xs text-forest/50">
                  <span className="flex items-center gap-1"><Clock size={12} /> {routeDurationLabel(r)}</span>
                  {r.distanceKm ? <span>{r.distanceKm} km</span> : null}
                </div>
                {companyName(r.supplierId) && (
                  <p className="mt-2 font-sans text-xs text-forest/40 flex items-center gap-1.5">
                    <Bus size={12} /> {companyName(r.supplierId)}
                  </p>
                )}
                <p className="mt-4 font-display italic text-xl text-forest group-hover:text-sage transition-colors">
                  {formatMoney(routePrice(r))}<span className="font-sans text-xs text-forest/40 not-italic"> pp</span>
                </p>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-12 border-t border-forest/10 pt-8 text-center">
          <p className="font-sans text-sm text-forest/50 mb-3">Going somewhere not listed here?</p>
          <Link href="/shuttles" className="inline-flex items-center gap-2 font-sans text-sm px-5 py-3 bg-forest text-white hover:bg-sage transition-colors">
            Get a Custom Quote <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  )
}

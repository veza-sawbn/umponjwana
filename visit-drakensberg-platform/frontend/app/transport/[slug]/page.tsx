import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Bus, ChevronRight, Clock, MapPin, Route as RouteIcon } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { getRoutes, routeDurationLabel, routePrice, routeSlug, type Route } from '@/lib/transport-routes'
import { getMyTransportCompany } from '@/lib/transport'
import { publicSupabase } from '@/lib/supabase-public'
import { formatMoney } from '@/lib/allocation'
import JsonLd from '@/components/seo/JsonLd'

// New route — closes SEO audit G17: named shuttle routes were real supplier
// data (app/supplier/routes/*) with no public detail page, so search never
// reached "Winterton to Cathedral Peak shuttle"-style queries. Pure server
// component: everything needed is resolved before render, same as the
// nature-reserves/towns detail pages. See docs/destination-graph/PHASE_C.md.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

// ISR — route pricing/duration is supplier-editable but changes far less
// often than activity/stay/tour/package pricing. See
// docs/destination-graph/PHASE_D.md.
export const revalidate = 1800

async function resolveRoute(slug: string): Promise<{ route: Route; companyName?: string } | null> {
  const routes = await getRoutes(publicSupabase)
  const route = routes.find(r => r.slug === slug || r.id === slug)
  if (!route) return null
  const company = await getMyTransportCompany(route.supplierId, publicSupabase)
  return { route, companyName: company?.companyName }
}

function routeTitle(r: Route): string {
  return `${r.from} to ${r.to}`
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const resolved = await resolveRoute(params.slug)
  if (!resolved) return { title: 'Route Not Found' }
  const { route } = resolved

  const title = route.seoTitle || `${routeTitle(route)} Shuttle | Visit Drakensberg`
  const description = route.seoDescription
    || `Fixed-price shuttle transfer from ${route.from} to ${route.to} — ${routeDurationLabel(route)}${route.distanceKm ? `, ${route.distanceKm} km` : ''}. Book a seat or request a private transfer.`
  const canonical = `/transport/${routeSlug(route)}`

  return {
    // `title` already includes " | Visit Drakensberg" — use `absolute` to
    // avoid the root layout's title template doubling the suffix (see
    // docs/destination-graph/PHASE_B.md, the /towns/[slug] bug).
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: route.status === 'active' ? undefined : { index: false, follow: false },
    openGraph: { title, description, url: `${SITE_URL}${canonical}` },
    twitter: { card: 'summary', title, description },
  }
}

export default async function TransportRoutePage({ params }: { params: { slug: string } }) {
  const resolved = await resolveRoute(params.slug)
  if (!resolved) notFound()
  const { route, companyName } = resolved

  const canonicalUrl = `${SITE_URL}/transport/${routeSlug(route)}`
  const price = routePrice(route)

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Shuttle Transfer',
    name: `${routeTitle(route)} Shuttle`,
    description: route.seoDescription || undefined,
    url: canonicalUrl,
    provider: companyName ? { '@type': 'Organization', name: companyName } : undefined,
    areaServed: [
      { '@type': 'Place', name: route.from },
      { '@type': 'Place', name: route.to },
    ],
    offers: price ? {
      '@type': 'Offer',
      price,
      priceCurrency: 'ZAR',
      availability: route.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: canonicalUrl,
    } : undefined,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Shuttle Routes', item: `${SITE_URL}/transport` },
      { '@type': 'ListItem', position: 3, name: routeTitle(route), item: canonicalUrl },
    ],
  }

  return (
    <main className="bg-mist min-h-screen pt-16">
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <div className="px-6 lg:px-12 pt-8">
        <nav className="flex items-center gap-2 font-sans text-[11px] text-forest/40 max-w-[1440px] mx-auto">
          <Link href="/" className="hover:text-forest transition-colors">Home</Link>
          <ChevronRight size={12} />
          <Link href="/transport" className="hover:text-forest transition-colors">Shuttle Routes</Link>
          <ChevronRight size={12} />
          <span className="text-forest/70">{routeTitle(route)}</span>
        </nav>
      </div>

      <section className="py-10">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-[2fr_1fr] gap-12 items-start">
            <div>
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-2">Shuttle Route</p>
              <h1 className="font-display text-4xl lg:text-5xl text-forest mb-4 flex items-center gap-3 flex-wrap">
                <RouteIcon className="w-8 h-8 text-forest/30 shrink-0" />
                <span>{route.from}</span>
                <ArrowRight className="w-6 h-6 text-gold shrink-0" />
                <span>{route.to}</span>
              </h1>

              <div className="flex flex-wrap items-center gap-6 font-sans text-sm text-forest/60 mb-8">
                <span className="flex items-center gap-2"><Clock size={15} className="text-forest/30" /> {routeDurationLabel(route)}</span>
                {route.distanceKm ? <span className="flex items-center gap-2"><MapPin size={15} className="text-forest/30" /> {route.distanceKm} km</span> : null}
                {companyName ? <span className="flex items-center gap-2"><Bus size={15} className="text-forest/30" /> Operated by {companyName}</span> : null}
              </div>

              {route.seoDescription && (
                <p className="font-sans text-base text-forest/70 leading-relaxed">{route.seoDescription}</p>
              )}
            </div>

            <div className="space-y-5">
              <div className="bg-white p-6 border border-forest/10">
                <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 mb-1">From</p>
                <p className="font-display italic text-3xl text-forest">
                  {formatMoney(price)}<span className="font-sans text-sm text-forest/40 not-italic"> pp</span>
                </p>
                <Link
                  href="/shuttles"
                  className="mt-5 block text-center bg-forest text-white py-3 font-sans text-sm hover:bg-sage transition-colors"
                >
                  Book This Route →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-white border-t border-gray-100 py-6">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <Link href="/transport" className="font-sans text-sm text-gray-400 hover:text-forest transition-colors">
            ← Back to all routes
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  )
}

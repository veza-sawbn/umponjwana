import type { Metadata } from 'next'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Visit Drakensberg is the tourism discovery and booking platform for the uKhahlamba-Drakensberg Park, a UNESCO World Heritage Site in KwaZulu-Natal, South Africa.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <main className="bg-mist min-h-screen">
      <section className="bg-forest text-white pt-32 pb-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-3">Our story</p>
          <h1 className="font-display italic text-4xl lg:text-5xl">About Visit Drakensberg</h1>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        <p className="font-sans text-base text-forest/70 leading-relaxed">
          Visit Drakensberg is the premier tourism discovery and booking platform for the
          uKhahlamba-Drakensberg Park, a UNESCO World Heritage Site. We connect visitors with
          local accommodation providers, mountain guides, activity operators and shuttle
          services across the full 200-kilometre escarpment — from Royal Natal in the north
          to Sani Pass and Bushman&apos;s Nek in the south.
        </p>
        <p className="font-sans text-base text-forest/70 leading-relaxed">
          Every listing on the platform is operated by a local supplier. Booking through
          Visit Drakensberg keeps tourism revenue in the communities that call these
          mountains home, and helps fund the conservation of one of the richest natural and
          cultural landscapes in Southern Africa — including more than 20,000 San rock art
          sites, the highest waterfall in Africa, and the last South African stronghold of
          the bearded vulture.
        </p>
        <div>
          <h2 className="font-display italic text-2xl text-forest mb-3">For suppliers</h2>
          <p className="font-sans text-base text-forest/70 leading-relaxed mb-4">
            Run a lodge, guide hikes, operate shuttles or host experiences in the Berg?
            List your business on Visit Drakensberg and reach travellers planning their trip.
          </p>
          <Link
            href="/supplier"
            className="inline-block px-6 py-3 bg-forest text-white font-sans text-sm hover:bg-sage transition-colors"
          >
            List your property
          </Link>
        </div>
        <div>
          <h2 className="font-display italic text-2xl text-forest mb-3">Contact</h2>
          <p className="font-sans text-base text-forest/70 leading-relaxed">
            Questions, feedback or press enquiries:{' '}
            <a href="mailto:hello@visitdrakensberg.com" className="text-forest underline hover:text-gold transition-colors">
              hello@visitdrakensberg.com
            </a>
          </p>
        </div>
      </section>

      <Footer />
    </main>
  )
}

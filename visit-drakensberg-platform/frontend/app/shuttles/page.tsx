'use client'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Footer from '@/components/layout/Footer'

const ROUTES = [
  { id: 's1', from: 'Durban King Shaka Airport', to: 'Northern Berg (Royal Natal)', duration: '3.5 h', price: 850, perPerson: true, img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80', provider: 'Berg Transfers' },
  { id: 's2', from: 'Johannesburg OR Tambo', to: 'Central Berg (Cathedral Peak)', duration: '5 h', price: 1100, perPerson: true, img: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=800&q=80', provider: 'Drakensberg Shuttles' },
  { id: 's3', from: 'Durban King Shaka Airport', to: 'Southern Berg (Underberg)', duration: '2.5 h', price: 720, perPerson: true, img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=800&q=80', provider: 'Berg Transfers' },
  { id: 's4', from: 'Northern Berg', to: 'Central Berg', duration: '1.5 h', price: 450, perPerson: true, img: 'https://images.unsplash.com/photo-1542587222-e14b891ee40b?w=800&q=80', provider: 'Local Link' },
  { id: 's5', from: 'Pietermaritzburg', to: 'Any Berg Region', duration: '2–3 h', price: 600, perPerson: true, img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80', provider: 'Drakensberg Shuttles' },
]

export default function ShuttlesPage() {
  return (
    <main className="bg-mist min-h-screen pt-16">
      <section className="bg-forest text-white py-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-3">Getting here</p>
          <h1 className="font-display text-5xl lg:text-6xl text-white leading-none mb-4">Shuttles & Transfers</h1>
          <p className="font-sans text-sm text-white/50">Airport to Berg transfers and inter-region connections</p>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="bg-white border border-black/8 divide-y divide-black/6 mb-12">
          {ROUTES.map((r) => (
            <Link key={r.id} href={`/shuttles/${r.id}`}
              className="group flex items-center gap-6 px-6 py-6 hover:bg-mist transition-colors">
              <div className="w-24 h-16 shrink-0 overflow-hidden hidden md:block">
                <img src={r.img} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display text-lg text-forest">{r.from}</p>
                  <span className="text-gold">→</span>
                  <p className="font-display text-lg text-forest">{r.to}</p>
                </div>
                <p className="font-sans text-xs text-forest/40 mt-0.5">{r.provider} · {r.duration}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-xl text-forest">R{r.price.toLocaleString()}</p>
                <p className="font-sans text-xs text-forest/40">per person</p>
              </div>
              <ArrowRight className="w-4 h-4 text-forest/20 group-hover:text-gold transition-colors shrink-0" />
            </Link>
          ))}
        </div>

        <div className="bg-forest text-white p-10 max-w-2xl">
          <h2 className="font-display text-3xl mb-3">Private charter</h2>
          <p className="font-sans text-sm text-white/60 leading-relaxed mb-6">
            Need a flexible, private transfer? We arrange door-to-door shuttles for groups and families. Vehicles range from sedans to minibuses.
          </p>
          <Link href="/contact" className="font-sans text-sm border border-white/30 text-white px-5 py-2.5 hover:bg-white hover:text-forest transition-colors inline-block">
            Request quote
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  )
}

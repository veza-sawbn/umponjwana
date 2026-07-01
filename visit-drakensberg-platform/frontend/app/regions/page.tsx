'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Eye, Calendar, Camera, Car, Clock, Compass, MapPin, Mountain, Utensils } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { useBooking } from '@/lib/booking-context'
import { DEFAULT_REGIONS, getRegions, type Region } from '@/lib/regions'
import { DESTINATIONS, buildDestinationRecommendations, type DestinationNode } from '@/lib/destination-ia'

const DESTINATION_LAYERS = [
  'Overview', 'History', 'Culture', 'Wildlife', 'Landscape', 'Towns', 'Villages', 'Attractions',
  'Hiking', 'Accommodation', 'Activities', 'Experiences', 'Events', 'Restaurants', 'Photography',
  'Maps', 'Nearby regions', 'Suggested itineraries', 'Travel information', 'Transport',
]

const CATEGORY_ICON: Record<string, any> = {
  Accommodation: MapPin,
  Activity: Compass,
  'Guided Tour': Mountain,
  Experience: Eye,
  Event: Calendar,
  Restaurant: Utensils,
  Trail: Mountain,
  Transport: Car,
}

function regionImage(region: Region, index: number) {
  return region.heroImage || DEFAULT_REGIONS[index % DEFAULT_REGIONS.length]?.heroImage || DEFAULT_REGIONS[0].heroImage
}

function destinationsForRegion(region: Region) {
  return DESTINATIONS.filter(destination => destination.region === region.name || destination.region.replace('Central', 'South') === region.name)
}

function DestinationHub({ destination }: { destination: DestinationNode }) {
  const booking = useBooking()
  const recommendations = buildDestinationRecommendations(booking, destination).slice(0, 6)
  const contextLabel = booking.stay ? 'from your accommodation' : `from ${destination.name}`

  return (
    <div className="bg-white border border-black/8 p-6 lg:p-8">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
        <div>
          <p className="font-sans text-[10px] tracking-[0.18em] uppercase text-gold mb-2">Destination hub · {destination.subRegion}</p>
          <h3 className="font-display text-3xl text-forest mb-4">{destination.name}</h3>
          <p className="font-sans text-sm text-forest/60 leading-relaxed mb-6">{destination.summary}</p>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-mist p-4"><p className="font-sans text-[10px] uppercase tracking-[0.14em] text-forest/30 mb-2">History</p><p className="font-sans text-xs text-forest/60 leading-relaxed">{destination.history}</p></div>
            <div className="bg-mist p-4"><p className="font-sans text-[10px] uppercase tracking-[0.14em] text-forest/30 mb-2">Culture</p><p className="font-sans text-xs text-forest/60 leading-relaxed">{destination.culture}</p></div>
            <div className="bg-mist p-4"><p className="font-sans text-[10px] uppercase tracking-[0.14em] text-forest/30 mb-2">Wildlife</p><p className="font-sans text-xs text-forest/60 leading-relaxed">{destination.wildlife}</p></div>
            <div className="bg-mist p-4"><p className="font-sans text-[10px] uppercase tracking-[0.14em] text-forest/30 mb-2">Landscape</p><p className="font-sans text-xs text-forest/60 leading-relaxed">{destination.landscape}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {DESTINATION_LAYERS.map(layer => <span key={layer} className="font-sans text-[10px] tracking-[0.08em] uppercase px-2.5 py-1 border border-forest/10 text-forest/50">{layer}</span>)}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-forest text-white p-5">
            <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-white/40 mb-3">Live trip context</p>
            <div className="space-y-2 font-sans text-sm text-white/70">
              <p className="flex gap-2"><MapPin size={14} />Current destination: {destination.name}</p>
              <p className="flex gap-2"><Calendar size={14} />Travel dates: {booking.checkIn || 'not set'}{booking.checkOut ? ` → ${booking.checkOut}` : ''}</p>
              <p className="flex gap-2"><Compass size={14} />Reference point: {booking.stay?.title || destination.mapLabel}</p>
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-gold">Nearby now</p>
                <h4 className="font-display text-2xl text-forest">Context-aware recommendations</h4>
              </div>
              <span className="font-sans text-xs text-forest/40">{contextLabel}</span>
            </div>
            <div className="space-y-2">
              {recommendations.map(item => {
                const Icon = CATEGORY_ICON[item.category] || Compass
                return (
                  <Link key={item.id} href={item.href} className="group flex gap-3 border border-black/8 p-3 hover:border-forest/30 transition-colors">
                    <div className="w-9 h-9 bg-mist flex items-center justify-center text-forest"><Icon size={15} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="font-sans text-[9px] uppercase tracking-[0.12em] text-gold">{item.category}</span><span className="font-sans text-[10px] text-forest/30">{item.availability}</span></div>
                      <p className="font-sans text-sm font-medium text-forest group-hover:text-gold transition-colors">{item.title}</p>
                      <p className="font-sans text-xs text-forest/40 flex items-center gap-1"><Clock size={10} />{item.distanceKm} km · ~{item.travelTimeMinutes} min</p>
                    </div>
                    <div className="text-right shrink-0">
                      {item.price && <p className="font-display italic text-sm text-forest">R{item.price.toLocaleString()}</p>}
                      {item.supplierRating && <p className="font-sans text-[10px] text-forest/40">★ {item.supplierRating}</p>}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegionsPage() {
  const [regions, setRegions] = useState<Region[]>(DEFAULT_REGIONS)

  useEffect(() => {
    getRegions().then(setRegions)
  }, [])

  return (
    <main className="bg-mist pt-16">
      <section className="bg-forest text-white py-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-4">Destinations first</p>
          <h1 className="font-display text-5xl lg:text-7xl text-white leading-none mb-6">Discover the Drakensberg</h1>
          <p className="font-sans text-base text-white/50 max-w-2xl leading-relaxed">
            Explore regions as complete tourism hubs before choosing where to stay, what to do and how to get there. Every recommendation is connected to destination context, travel dates and distance.
          </p>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {['Holiday Destinations', 'Cities & Towns', 'Summer Destinations', 'Winter Destinations', 'Family Destinations', 'Regions', 'Maps', 'Nearby Regions'].map(item => (
            <a key={item} href={`#${item.toLowerCase().replaceAll(' ', '-')}`} className="bg-white border border-black/8 p-4 font-sans text-sm text-forest hover:border-gold/50 transition-colors flex items-center justify-between">
              {item}<ArrowRight size={14} className="text-gold" />
            </a>
          ))}
        </div>
      </section>

      {regions.map((r, i) => {
        const hubs = destinationsForRegion(r)
        return (
          <section key={r.id} id={r.slug} className={`py-20 ${i % 2 === 0 ? 'bg-white' : 'bg-mist'}`}>
            <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
              <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-20 items-center mb-12">
                <div className="aspect-[4/3] overflow-hidden"><img src={regionImage(r, i)} alt={r.name} className="w-full h-full object-cover" /></div>
                <div>
                  <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-gold mb-3">Region container · Destination data source</p>
                  <h2 className="font-display text-4xl lg:text-5xl text-forest mb-6">{r.name}</h2>
                  <p className="font-sans text-base text-forest/60 leading-relaxed mb-8">{r.overview || r.seoDescription}</p>
                  <div className="grid sm:grid-cols-2 gap-3 mb-8">
                    {['Sub-regions', 'Towns', 'Points of interest', 'Supplier listings'].map(label => <div key={label} className="border border-forest/10 p-4"><p className="font-sans text-[10px] uppercase tracking-[0.14em] text-forest/30">{label}</p><p className="font-display text-xl text-forest">Managed here</p></div>)}
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <Link href={`/stays?region=${encodeURIComponent(r.name)}`} className="font-sans text-sm px-5 py-2.5 bg-forest text-white hover:bg-sage transition-colors">Find accommodation</Link>
                    <Link href={`/activities?region=${encodeURIComponent(r.name)}`} className="font-sans text-sm px-5 py-2.5 border border-forest text-forest hover:bg-forest hover:text-white transition-colors inline-flex items-center gap-2">Explore nearby products <ArrowRight className="w-3.5 h-3.5" /></Link>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {(hubs.length ? hubs : DESTINATIONS.slice(0, 1)).map(destination => <DestinationHub key={destination.id} destination={destination} />)}
              </div>
            </div>
          </section>
        )
      })}

      <section className="bg-forest py-20">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-3">Connected tourism ecosystem</p>
          <h2 className="font-display text-4xl text-white mb-8">How destinations connect the journey</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              'Accommodation suggests nearby activities, restaurants, events, hikes and shuttles.',
              'Activities suggest accommodation, restaurants and transfers using live trip context.',
              'Trails suggest guides, equipment, restaurants and transport from the current base.',
            ].map(text => <div key={text} className="border border-white/10 p-6"><p className="font-sans text-sm text-white/60 leading-relaxed">{text}</p></div>)}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}

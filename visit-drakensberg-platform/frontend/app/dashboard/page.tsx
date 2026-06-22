'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react'
import Footer from '@/components/layout/Footer'

const TABS = ['Overview', 'Bookings', 'Profile']

const BOOKINGS = [
  { id: 'b1', title: 'Cathedral Peak Mountain Lodge', location: 'Northern Berg', checkIn: '2025-07-15', checkOut: '2025-07-18', guests: 2, total: 8214, status: 'confirmed', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
  { id: 'b2', title: 'Berg Valley Guesthouse', location: 'Champagne Valley', checkIn: '2025-04-10', checkOut: '2025-04-13', guests: 3, total: 5880, status: 'completed', img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400&q=80' },
  { id: 'b3', title: 'Sani Pass Adventure Camp', location: 'Southern Berg', checkIn: '2025-01-08', checkOut: '2025-01-10', guests: 4, total: 3360, status: 'completed', img: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80' },
]

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-sage/10 text-sage',
  completed: 'bg-black/8 text-forest/50',
  cancelled: 'bg-red-50 text-red-500',
  pending: 'bg-gold/10 text-gold',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('Overview')

  return (
    <main className="bg-mist min-h-screen pt-16">
      {/* Header */}
      <section className="bg-forest text-white py-14 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-2">My account</p>
          <h1 className="font-display text-4xl text-white">Welcome back, Sarah</h1>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        {/* Tabs */}
        <div className="flex border-b border-black/10 mb-10">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`font-sans text-sm px-5 py-3 border-b-2 -mb-px transition-colors ${activeTab === tab ? 'border-forest text-forest' : 'border-transparent text-forest/40 hover:text-forest'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'Overview' && (
          <div className="space-y-10">
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: 'Upcoming trips', value: '1' },
                { label: 'Past bookings', value: '2' },
                { label: 'Total spent', value: 'R17,454' },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-black/8 p-6">
                  <p className="font-sans text-[10px] tracking-[0.18em] uppercase text-forest/35 mb-2">{s.label}</p>
                  <p className="font-display text-3xl text-forest">{s.value}</p>
                </div>
              ))}
            </div>

            <div>
              <h2 className="font-display text-2xl text-forest mb-5">Upcoming booking</h2>
              {BOOKINGS.filter((b) => b.status === 'confirmed').map((b) => (
                <div key={b.id} className="bg-white border border-black/8 flex gap-6 p-5">
                  <div className="w-28 h-20 shrink-0 overflow-hidden hidden sm:block">
                    <img src={b.img} alt={b.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{b.location}</p>
                    <h3 className="font-display text-xl text-forest mb-2">{b.title}</h3>
                    <div className="flex flex-wrap gap-4">
                      <span className="flex items-center gap-1.5 font-sans text-xs text-forest/50">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {fmt(b.checkIn)} — {fmt(b.checkOut)}
                      </span>
                      <span className="flex items-center gap-1.5 font-sans text-xs text-forest/50">
                        {b.guests} guests
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-xl text-forest mb-1">R{b.total.toLocaleString()}</p>
                    <span className={`font-sans text-[10px] uppercase tracking-wide px-2.5 py-1 ${STATUS_STYLE[b.status]}`}>
                      {b.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h2 className="font-display text-2xl text-forest mb-5">Explore</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Stays', href: '/stays', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
                  { label: 'Hikes', href: '/hikes', img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80' },
                  { label: 'Activities', href: '/activities', img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80' },
                  { label: 'Packages', href: '/packages', img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=400&q=80' },
                ].map((link) => (
                  <Link key={link.href} href={link.href} className="group relative overflow-hidden aspect-square">
                    <img src={link.img} alt={link.label} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-forest/30 group-hover:bg-forest/10 transition-colors" />
                    <span className="absolute bottom-3 left-3 font-display text-lg text-white">{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bookings */}
        {activeTab === 'Bookings' && (
          <div>
            <h2 className="font-display text-2xl text-forest mb-6">All bookings</h2>
            <div className="space-y-4">
              {BOOKINGS.map((b) => (
                <div key={b.id} className="bg-white border border-black/8 flex gap-5 p-5">
                  <div className="w-24 h-16 shrink-0 overflow-hidden hidden sm:block">
                    <img src={b.img} alt={b.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-gold mb-1">{b.location}</p>
                    <h3 className="font-display text-lg text-forest">{b.title}</h3>
                    <p className="font-sans text-xs text-forest/40 mt-1">{fmt(b.checkIn)} — {fmt(b.checkOut)} · {b.guests} guests</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-lg text-forest mb-1">R{b.total.toLocaleString()}</p>
                    <span className={`font-sans text-[10px] uppercase tracking-wide px-2.5 py-1 ${STATUS_STYLE[b.status]}`}>
                      {b.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile */}
        {activeTab === 'Profile' && (
          <div className="max-w-lg">
            <h2 className="font-display text-2xl text-forest mb-6">Profile settings</h2>
            <div className="bg-white border border-black/8 p-7 space-y-5">
              {[
                { label: 'Full name', value: 'Sarah van der Merwe' },
                { label: 'Email', value: 'sarah@example.com' },
                { label: 'Phone', value: '+27 82 555 1234' },
                { label: 'Member since', value: 'January 2023' },
              ].map((f) => (
                <div key={f.label}>
                  <p className="font-sans text-[10px] tracking-[0.18em] uppercase text-forest/35 mb-1">{f.label}</p>
                  <div className="flex items-center justify-between border-b border-black/6 pb-2">
                    <span className="font-sans text-sm text-forest">{f.value}</span>
                    <button className="font-sans text-xs text-forest/40 hover:text-forest transition-colors">Edit</button>
                  </div>
                </div>
              ))}
              <button className="w-full bg-forest text-white py-3 font-sans text-sm hover:bg-sage transition-colors mt-2">
                Save changes
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </main>
  )
}

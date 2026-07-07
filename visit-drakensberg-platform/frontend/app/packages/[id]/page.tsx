'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import {
  ArrowLeft, Users, CheckCircle, Package as PackageIcon, MapPin, Star,
  Calendar, Minus, Plus, Info, Mountain,
} from 'lucide-react'
import { supabase } from '@/lib/auth'
import { getPackageById, COMPONENT_TYPE_LABELS, type MarketplacePackage } from '@/lib/packages'
import { bookPackage } from '@/lib/package-bookings'
import { getTrails, type Trail } from '@/lib/trails'

// Public package page. Live admin-curated packages are bookable here in one
// step — the platform then coordinates supplier fulfilment behind the scenes.
// The p1–p4 showcase packages from the listing route to the trip planner.

const SHOWCASE: Record<string, { title: string; location: string; duration: string; price: number; img: string; includes: string[] }> = {
  p1: { title: 'Amphitheatre Weekend Escape', location: 'Royal Natal', duration: '3 nights', price: 4200, img: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=1200&q=80', includes: ['3 nights accommodation', 'Daily breakfast', 'Tugela Falls guided hike', 'San rock art tour'] },
  p2: { title: 'Central Berg Family Adventure', location: 'Cathedral Peak', duration: '5 nights', price: 8900, img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1200&q=80', includes: ['5 nights family cottage', 'All meals', 'Horse riding', 'Nature walks', 'Rock art excursion'] },
  p3: { title: 'Sani Pass & Southern Berg Explorer', location: 'Underberg', duration: '4 nights', price: 6600, img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80', includes: ['4 nights lodge', 'Sani Pass 4x4 tour', 'Mountain bike day', 'Fly-fishing half day'] },
  p4: { title: 'Grand Berg Traverse — 7 Days', location: 'Northern to Southern Berg', duration: '7 nights', price: 18500, img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=80', includes: ['7 nights premium accommodation', 'All meals', 'Private guide', 'All park fees', 'Transfers'] },
}

export default function PackageDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const showcase = SHOWCASE[id]
  const [pkg, setPkg] = useState<MarketplacePackage | null>(null)
  const [trails, setTrails] = useState<Trail[]>([])
  const [loaded, setLoaded] = useState(!!showcase)
  const [userId, setUserId] = useState<string | null>(null)

  const [form, setForm] = useState({ startDate: '', guests: 2, customerName: '', customerEmail: '', customerPhone: '', specialRequests: '' })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ reference: string } | null>(null)

  useEffect(() => {
    if (showcase) return
    Promise.all([getPackageById(id), getTrails()]).then(([p, trls]) => {
      setPkg(p)
      setTrails(trls)
      setLoaded(true)
    })
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      const meta = user?.user_metadata ?? {}
      setForm(f => ({ ...f, customerName: f.customerName || meta.full_name || '', customerEmail: f.customerEmail || user?.email || '' }))
    })
  }, [id, showcase])

  async function submit() {
    if (!pkg) return
    setError('')
    if (!form.startDate) { setError('Choose a start date.'); return }
    if (!form.customerName.trim() || !form.customerEmail.trim()) { setError('Your name and email are required.'); return }
    if (!userId) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/packages/${id}`)}`)
      return
    }
    setBooking(true)
    try {
      const saved = await bookPackage({
        pkg,
        userId,
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim(),
        specialRequests: form.specialRequests.trim(),
        startDate: form.startDate,
        guests: form.guests,
      })
      setDone({ reference: saved.reference })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  // ── Showcase fallback ────────────────────────────────────────────────────
  if (showcase) {
    return (
      <main className="bg-mist min-h-screen pt-16">
        <section className="relative h-[40vh] min-h-[320px] overflow-hidden">
          <img src={showcase.img} alt={showcase.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-6 lg:px-12 pb-10">
            <div className="max-w-[1440px] mx-auto">
              <Link href="/packages" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors"><ArrowLeft size={16} /> All Packages</Link>
              <h1 className="font-display text-4xl lg:text-5xl text-white">{showcase.title}</h1>
              <p className="font-sans text-sm text-white/70 mt-2">{showcase.location} · {showcase.duration}</p>
            </div>
          </div>
        </section>
        <div className="max-w-[900px] mx-auto px-6 lg:px-12 py-12">
          <div className="bg-white border border-black/8 p-8">
            <h2 className="font-display text-2xl text-forest mb-4">What's included</h2>
            <ul className="space-y-2 mb-8">
              {showcase.includes.map(i => (
                <li key={i} className="flex items-center gap-2.5 font-sans text-sm text-forest/70"><CheckCircle size={14} className="text-gold shrink-0" /> {i}</li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-black/6 pt-6 flex-wrap gap-4">
              <div>
                <p className="font-display text-3xl text-forest">R{showcase.price.toLocaleString()}</p>
                <p className="font-sans text-xs text-forest/40">per person</p>
              </div>
              <Link href="/plan" className="bg-forest text-white px-8 py-3.5 font-sans text-sm hover:bg-forest/90 transition-colors">
                Plan this Trip →
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    )
  }

  // ── Live package ─────────────────────────────────────────────────────────
  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <div className="flex items-center justify-center h-96 mt-16 font-sans text-sm text-gray-400">Loading package…</div>
        <Footer />
      </div>
    )
  }

  if (!pkg || pkg.packageStatus !== 'published') {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <div className="flex flex-col items-center justify-center h-96 mt-16 text-center px-6">
          <PackageIcon size={32} className="text-gray-300 mb-4" />
          <h1 className="font-display italic text-3xl mb-2">Package not available</h1>
          <p className="font-sans text-sm text-gray-500 mb-6">This package may have been unpublished or archived.</p>
          <Link href="/packages" className="border border-[#2d6a4f] text-[#2d6a4f] px-6 py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
            Browse Packages
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <main className="max-w-2xl mx-auto px-6 pt-40 pb-24 text-center">
          <div className="w-16 h-16 bg-[#2d6a4f]/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={28} className="text-[#2d6a4f]" />
          </div>
          <h1 className="font-display italic text-4xl text-[#000000] mb-3">Package booked</h1>
          <p className="font-sans text-sm text-gray-500 mb-2">Reference <span className="text-[#2d6a4f] font-medium">{done.reference}</span></p>
          <p className="font-sans text-sm text-gray-500 max-w-md mx-auto mb-8 leading-relaxed">
            You completed one booking — Visit Drakensberg now coordinates every supplier in your itinerary. Each provider receives only their assigned services and confirms availability; you'll be notified as your trip is finalised.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/account" className="bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors">My Bookings →</Link>
            <Link href="/packages" className="border border-[#2d6a4f] text-[#2d6a4f] px-6 py-3 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">More Packages</Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const pkgTrails = trails.filter(t => pkg.trailIds.includes(t.id))
  const suppliers = [...new Set(pkg.components.map(c => c.supplierName).filter(Boolean))]

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <section className="relative h-[45vh] min-h-[360px] overflow-hidden mt-16">
        <img src={pkg.image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80'} alt={pkg.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-6 lg:px-12 pb-10">
          <div className="max-w-[1440px] mx-auto">
            <Link href="/packages" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors"><ArrowLeft size={16} /> All Packages</Link>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              {pkg.tag && <span className="font-sans text-[10px] tracking-[0.15em] uppercase bg-[#C9A96E] text-[#2d2d2d] px-3 py-1">{pkg.tag}</span>}
              {pkg.featured && <span className="font-sans text-[10px] tracking-[0.15em] uppercase bg-white/15 text-white px-3 py-1 flex items-center gap-1"><Star size={10} /> Featured</span>}
            </div>
            <h1 className="font-display italic text-4xl lg:text-6xl text-white">{pkg.title}</h1>
            <p className="font-sans text-sm text-white/70 mt-2 flex items-center gap-2">
              <MapPin size={13} /> {pkg.region || 'Drakensberg'} · {pkg.durationNights} night{pkg.durationNights !== 1 ? 's' : ''} · max {pkg.maxGuests} guests
            </p>
          </div>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            {pkg.summary && <p className="font-display italic text-2xl text-[#2d6a4f] leading-relaxed">{pkg.summary}</p>}
            {pkg.description && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">About this Package</h2>
                <p className="font-sans text-gray-700 leading-relaxed whitespace-pre-line">{pkg.description}</p>
              </div>
            )}

            {/* Itinerary components */}
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">What's in the Package</h2>
              <div className="space-y-2">
                {pkg.components.map(c => (
                  <div key={c.id} className="bg-white border border-gray-200 p-4 flex items-start gap-3">
                    <CheckCircle size={15} className="text-[#2d6a4f] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-sans text-sm text-gray-800">
                        <span className="text-[10px] tracking-[0.1em] uppercase text-[#C9A96E] mr-2">{COMPONENT_TYPE_LABELS[c.type]}</span>
                        {c.title}
                      </p>
                      <p className="font-sans text-xs text-gray-400 mt-0.5">
                        {c.supplierName && <>Provided by {c.supplierName}</>}
                        {c.availability && <> · {c.availability}</>}
                        {c.cancellationRules && <> · {c.cancellationRules}</>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {suppliers.length > 1 && (
                <p className="font-sans text-xs text-gray-400 mt-3 flex items-start gap-1.5">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  One booking, {suppliers.length} local businesses — Visit Drakensberg coordinates {suppliers.join(', ')} on your behalf.
                </p>
              )}
            </div>

            {/* Trails */}
            {pkgTrails.length > 0 && (
              <div>
                <h2 className="font-display italic text-2xl text-[#000000] mb-4">Hiking Trails in this Package</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pkgTrails.map(t => (
                    <Link key={t.id} href={`/hikes/${t.id}`} className="bg-white border border-gray-200 p-4 hover:border-[#2d6a4f] transition-colors flex items-center gap-3">
                      <Mountain size={18} className="text-[#C9A96E] shrink-0" />
                      <div>
                        <p className="font-display italic text-lg leading-tight">{t.name}</p>
                        <p className="font-sans text-xs text-gray-400">{t.distance} · {t.difficulty}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Booking sidebar */}
          <div>
            <div className="bg-white border border-gray-200 p-6 sticky top-24">
              <div className="flex items-baseline justify-between mb-5">
                <div>
                  {pkg.originalPrice && pkg.originalPrice > pkg.pricePerPerson && (
                    <p className="font-sans text-xs text-gray-400 line-through">R {pkg.originalPrice.toLocaleString()}</p>
                  )}
                  <p className="font-display italic text-3xl text-[#2d6a4f]">R {pkg.pricePerPerson.toLocaleString()}</p>
                </div>
                <p className="font-sans text-xs text-gray-400">per person</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5"><Calendar size={11} className="inline mr-1 -mt-0.5" />Start Date</label>
                  <input type="date" min={new Date().toISOString().slice(0, 10)} value={form.startDate} onChange={e => set('startDate', e.target.value)}
                    className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-sans text-sm text-gray-600">Guests</span>
                  <div className="flex items-center border border-gray-200">
                    <button onClick={() => set('guests', Math.max(1, form.guests - 1))} className="px-3 py-2 text-gray-500 hover:text-black disabled:opacity-30" disabled={form.guests <= 1}><Minus size={13} /></button>
                    <span className="font-sans text-sm px-3 min-w-[32px] text-center">{form.guests}</span>
                    <button onClick={() => set('guests', Math.min(pkg.maxGuests, form.guests + 1))} className="px-3 py-2 text-gray-500 hover:text-black disabled:opacity-30" disabled={form.guests >= pkg.maxGuests}><Plus size={13} /></button>
                  </div>
                </div>
                <div>
                  <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Full Name</label>
                  <input value={form.customerName} onChange={e => set('customerName', e.target.value)}
                    className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white" />
                </div>
                <div>
                  <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Email</label>
                  <input type="email" value={form.customerEmail} onChange={e => set('customerEmail', e.target.value)}
                    className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white" />
                </div>
                <div>
                  <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Phone (optional)</label>
                  <input value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)}
                    className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white" />
                </div>
                <div>
                  <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Special Requests</label>
                  <textarea rows={2} value={form.specialRequests} onChange={e => set('specialRequests', e.target.value)}
                    className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white resize-none" />
                </div>

                <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                  <span className="font-sans text-sm text-gray-500"><Users size={12} className="inline mr-1 -mt-0.5" />{form.guests} guest{form.guests !== 1 ? 's' : ''}</span>
                  <span className="font-display italic text-xl text-[#2d6a4f]">R {(pkg.pricePerPerson * form.guests).toLocaleString()}</span>
                </div>

                {error && <p className="font-sans text-sm text-red-500">{error}</p>}
                <button onClick={submit} disabled={booking}
                  className="w-full bg-[#C9A96E] text-[#2d2d2d] py-3 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors disabled:opacity-50">
                  {booking ? 'Booking…' : 'Book this Package →'}
                </button>
                <p className="font-sans text-[10px] text-gray-400 text-center leading-relaxed">
                  One booking covers everything — we coordinate all providers in this itinerary for you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

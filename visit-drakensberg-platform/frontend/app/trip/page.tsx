'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import { Mountain, Bed, Car, Compass, ChevronRight, Trash2, Users, Calendar, ArrowLeft, Pencil } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import { getRecommendations, type Recommendation } from '@/lib/recommendations'
import { useState, useEffect } from 'react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function TripPage() {
  const booking = useBooking()
  const router = useRouter()
  const [editingDates, setEditingDates] = useState(false)
  const [draftIn, setDraftIn] = useState('')
  const [draftOut, setDraftOut] = useState('')

  const hikeAddons = booking.addons.filter(a => a.type === 'hike' || a.type === 'tour' || a.type === 'activity')
  const hasStay = !!booking.stay
  const hasShuttle = !!booking.shuttle
  const isEmpty = booking.addons.length === 0 && !booking.stay

  const checkIn = booking.checkIn
  const checkOut = booking.checkOut
  const guests = booking.guests || 1

  // Live, context-aware suggestions: same region as the trip, inside the
  // travel dates, enough seats for the party, minus what's already added.
  const [suggestions, setSuggestions] = useState<Recommendation[]>([])
  useEffect(() => {
    if (isEmpty) { setSuggestions([]); return }
    getRecommendations({
      region: booking.stay?.region || booking.region,
      checkIn,
      checkOut,
      guests,
      excludeIds: [
        ...booking.addons.map(a => a.id),
        ...(booking.stay ? [booking.stay.id] : []),
      ],
    }, 4).then(recs => setSuggestions(recs.filter(r => r.kind !== 'stay')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmpty, booking.addons.length, booking.stay?.id, booking.region, checkIn, checkOut, guests])

  function startEditDates() {
    setDraftIn(checkIn)
    setDraftOut(checkOut)
    setEditingDates(true)
  }

  function applyDates() {
    if (draftIn && draftOut && draftIn < draftOut) {
      booking.setSearch(booking.region, draftIn, draftOut, guests)
    }
    setEditingDates(false)
  }

  const subtotal = booking.totalPrice

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      <div className="max-w-[1200px] mx-auto px-6 lg:px-12 pt-28 pb-20">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 font-sans text-sm text-black/40 hover:text-black/70 mb-8 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <h1 className="font-display italic text-4xl text-black/90 mb-1">Your Trip</h1>
        <p className="font-sans text-sm text-black/40 mb-10">Review your selections and complete your Drakensberg experience</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* ── Left column: items + suggestions ── */}
          <div className="lg:col-span-2 space-y-10">

            {/* Current selections */}
            <section>
              <h2 className="font-display italic text-2xl mb-4">What's in your trip</h2>
              {isEmpty ? (
                <div className="bg-white border border-black/8 rounded-xl p-10 text-center">
                  <Mountain size={28} className="text-black/15 mx-auto mb-3" />
                  <p className="font-sans text-sm text-black/30 mb-4">Nothing added yet — browse trails to get started.</p>
                  <Link href="/hikes" className="inline-block font-sans text-sm text-[#2d6a4f] border border-[#2d6a4f] px-5 py-2 hover:bg-[#2d6a4f] hover:text-white transition-colors">
                    Browse Trails
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {booking.addons.map(a => (
                    <div key={a.id} className="bg-white border border-black/8 rounded-xl p-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-[#2d6a4f]/10 flex items-center justify-center shrink-0">
                          <Mountain size={16} className="text-[#2d6a4f]" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-sans font-medium text-sm text-black/80 truncate">{a.title}</p>
                          <p className="font-sans text-xs text-black/40 mt-0.5 flex items-center gap-3 flex-wrap">
                            {a.date && <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(a.date)}</span>}
                            <span className="flex items-center gap-1"><Users size={10} />{a.guests} {a.guests === 1 ? 'person' : 'people'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <p className="font-sans text-sm font-semibold text-black/80">
                          R {(a.price_per_person * a.guests).toLocaleString()}
                        </p>
                        <button
                          onClick={() => booking.removeAddon(a.id)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {booking.stay && (
                    <div className="bg-white border border-black/8 rounded-xl p-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
                          <Bed size={16} className="text-[#C9A96E]" />
                        </div>
                        <div>
                          <p className="font-sans font-medium text-sm text-black/80">{booking.stay.title}</p>
                          <p className="font-sans text-xs text-black/40 mt-0.5">
                            {booking.stay.roomName ? `${booking.stay.roomName} · ` : ''}{booking.stay.region}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <p className="font-sans text-sm font-semibold text-black/80">
                          R {(booking.stay.price_per_night * booking.nights).toLocaleString()}
                        </p>
                        <button onClick={() => booking.setStay(null)} className="text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Accommodation suggestion */}
            {!hasStay && hikeAddons.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Bed size={16} className="text-[#C9A96E]" />
                    <h2 className="font-display italic text-2xl">Where to stay</h2>
                  </div>
                  {checkIn && !editingDates && (
                    <button
                      onClick={startEditDates}
                      className="flex items-center gap-1.5 font-sans text-xs text-black/40 hover:text-black/70 transition-colors"
                    >
                      <Pencil size={11} /> Adjust dates
                    </button>
                  )}
                </div>
                <p className="font-sans text-xs text-black/40 mb-4">
                  Accommodation for the night before your departure and the night after your tour ends
                </p>

                {editingDates && (
                  <div className="bg-white border border-black/8 rounded-xl p-5 mb-3 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="font-sans text-xs font-medium text-black/60">Check-in</label>
                        <input
                          type="date"
                          value={draftIn}
                          onChange={e => setDraftIn(e.target.value)}
                          className="w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-sans text-xs font-medium text-black/60">Check-out</label>
                        <input
                          type="date"
                          value={draftOut}
                          onChange={e => setDraftOut(e.target.value)}
                          className="w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={applyDates} className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
                        Apply
                      </button>
                      <button onClick={() => setEditingDates(false)} className="font-sans text-sm px-4 py-2 border border-black/10 rounded-lg text-black/50">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <Link
                  href={`/stays${checkIn ? `?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}` : ''}`}
                  className="flex items-center justify-between bg-white border border-black/8 rounded-xl p-6 hover:border-[#C9A96E]/50 transition-colors group"
                >
                  <div>
                    <p className="font-sans font-medium text-sm text-black/80 mb-1">
                      Find accommodation near your trail
                    </p>
                    <p className="font-sans text-xs text-black/40">
                      {checkIn
                        ? `${formatDate(checkIn)} → ${formatDate(checkOut)} · ${guests} ${guests === 1 ? 'guest' : 'guests'}`
                        : 'Lodges, guesthouses and campsites in the Berg'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-black/20 group-hover:text-[#C9A96E] transition-colors shrink-0 ml-4" />
                </Link>
              </section>
            )}

            {/* Shuttle suggestion */}
            {!hasShuttle && hikeAddons.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-1">
                  <Car size={16} className="text-[#C9A96E]" />
                  <h2 className="font-display italic text-2xl">Getting there</h2>
                </div>
                <p className="font-sans text-xs text-black/40 mb-4">
                  Shuttle transfers from Johannesburg and Durban to the Berg
                </p>
                <Link
                  href="/checkout/shuttle"
                  className="flex items-center justify-between bg-white border border-black/8 rounded-xl p-6 hover:border-[#C9A96E]/50 transition-colors group"
                >
                  <div>
                    <p className="font-sans font-medium text-sm text-black/80 mb-1">Add a shuttle transfer</p>
                    <p className="font-sans text-xs text-black/40">
                      From R460 · Shared and private options from OR Tambo and King Shaka
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-black/20 group-hover:text-[#C9A96E] transition-colors shrink-0 ml-4" />
                </Link>
              </section>
            )}

            {/* Context-aware suggestions from live listings */}
            {suggestions.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-1">
                  <Compass size={16} className="text-[#C9A96E]" />
                  <h2 className="font-display italic text-2xl">Make the most of your trip</h2>
                </div>
                <p className="font-sans text-xs text-black/40 mb-4">
                  Matched to your {booking.stay?.region || booking.region ? 'region and ' : ''}travel dates
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {suggestions.map(s => (
                    <Link
                      key={s.id}
                      href={s.href}
                      className="bg-white border border-black/8 rounded-xl p-5 hover:border-[#C9A96E]/50 transition-colors group"
                    >
                      <p className="font-sans text-[10px] text-[#C9A96E] uppercase tracking-widest mb-1.5">
                        {s.kind === 'tour-departure' ? 'Guided tour' : 'Activity'}{s.region ? ` · ${s.region}` : ''}
                      </p>
                      <p className="font-sans font-medium text-sm text-black/80 mb-1">{s.title}</p>
                      <p className="font-sans text-xs text-black/40 leading-relaxed">{s.reason}</p>
                      {s.price != null && (
                        <p className="font-sans text-xs font-semibold text-[#2d6a4f] mt-2">R {s.price.toLocaleString()} pp</p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Right column: sticky summary ── */}
          <div>
            <div className="bg-white border border-black/8 rounded-xl p-6 sticky top-24 space-y-5">
              <h3 className="font-display italic text-xl">Trip Summary</h3>

              {isEmpty ? (
                <p className="font-sans text-xs text-black/30">Add something to your trip to see a summary</p>
              ) : (
                <div className="space-y-3">
                  {booking.addons.map(a => (
                    <div key={a.id} className="flex justify-between gap-2 font-sans text-sm">
                      <span className="text-black/50 truncate">{a.title.split('·')[0].trim()}</span>
                      <span className="text-black/80 shrink-0 font-medium">R {(a.price_per_person * a.guests).toLocaleString()}</span>
                    </div>
                  ))}
                  {booking.stay && (
                    <div className="flex justify-between gap-2 font-sans text-sm">
                      <span className="text-black/50 truncate">{booking.stay.title}</span>
                      <span className="text-black/80 shrink-0 font-medium">R {(booking.stay.price_per_night * booking.nights).toLocaleString()}</span>
                    </div>
                  )}
                  {booking.shuttle && (
                    <div className="flex justify-between gap-2 font-sans text-sm">
                      <span className="text-black/50 truncate">Shuttle</span>
                      <span className="text-black/80 shrink-0 font-medium">R {booking.shuttle.price.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {subtotal > 0 && (
                <div className="border-t border-black/8 pt-4 flex justify-between font-sans text-sm font-semibold">
                  <span>Subtotal</span>
                  <span>R {subtotal.toLocaleString()}</span>
                </div>
              )}

              <button
                onClick={() => router.push('/checkout/shuttle')}
                disabled={isEmpty}
                className="w-full bg-[#2d6a4f] text-white font-sans text-sm py-3 rounded-lg hover:bg-[#235a3f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue to Checkout
              </button>

              {!isEmpty && (
                <button
                  onClick={() => booking.clearBooking()}
                  className="w-full font-sans text-xs text-black/30 hover:text-red-500 transition-colors py-1"
                >
                  Clear trip
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  )
}

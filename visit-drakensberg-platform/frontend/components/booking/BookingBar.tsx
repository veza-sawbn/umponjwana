'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Users, MapPin, Bed, Plus, X, ChevronUp, ChevronDown, ShoppingBag, Trash2, Bus } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useBooking } from '@/lib/booking-context'
import { slideUp, slideUpBar } from '@/lib/motion'
import { useShuttleRecommendations } from '@/lib/shuttle-service'

function fmt(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

export default function BookingBar() {
  const pathname = usePathname()
  const router = useRouter()
  const booking = useBooking()
  const [open, setOpen] = useState(false)

  const hidden = ['/admin', '/checkout', '/auth'].some(p => pathname.startsWith(p))
  const itemCount = (booking.stay ? 1 : 0) + booking.addons.length + (booking.shuttle ? 1 : 0)
  const shuttleRecommendations = useShuttleRecommendations(booking)
  const visible = !hidden && (booking.hasActiveSearch || itemCount > 0)

  function handleCheckout() {
    if (!booking.shuttle) {
      router.push('/checkout/shuttle')
    } else {
      router.push('/checkout')
    }
  }

  return (
    <motion.div
      className="fixed bottom-0 inset-x-0 z-40 shadow-2xl"
      initial={{ y: '100%' }}
      animate={{ y: visible ? 0 : '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    >
      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="bg-white border-t border-gray-200 max-w-[1440px] mx-auto w-full overflow-hidden"
            variants={slideUp}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="px-6 lg:px-12 py-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Search summary */}
                <div>
                  <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-3">Your Search</p>
                  <div className="space-y-2 font-sans text-sm">
                    {booking.region && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <MapPin size={13} className="text-[#2d6a4f] shrink-0" />
                        {booking.region}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar size={13} className="text-[#2d6a4f] shrink-0" />
                      {fmt(booking.checkIn)} → {fmt(booking.checkOut)}
                      {booking.nights > 0 && <span className="text-gray-400">({booking.nights} night{booking.nights !== 1 ? 's' : ''})</span>}
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Users size={13} className="text-[#2d6a4f] shrink-0" />
                      {booking.guests} guest{booking.guests !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <Link
                    href={`/search?region=${encodeURIComponent(booking.region)}&check_in=${booking.checkIn}&check_out=${booking.checkOut}&guests=${booking.guests}`}
                    className="mt-3 inline-block font-sans text-xs text-[#2d6a4f] hover:underline"
                  >
                    ← Modify search
                  </Link>
                </div>

                {/* Selected items */}
                <div className="md:col-span-2">
                  <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-3">Your Booking</p>
                  <div className="space-y-2">
                    {/* Stay */}
                    {booking.stay ? (
                      <div className="flex items-center justify-between bg-[#F7F5F2] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Bed size={13} className="text-[#2d6a4f] shrink-0" />
                          <div>
                            <p className="font-sans text-sm font-medium">{booking.stay.title}</p>
                            <p className="font-sans text-xs text-gray-400">
                              R {booking.stay.price_per_night.toLocaleString()}/night × {booking.nights} = R {(booking.stay.price_per_night * booking.nights).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <motion.button
                          onClick={() => booking.setStay(null)}
                          className="text-gray-300 hover:text-red-400 transition-colors ml-3"
                          whileTap={{ scale: 0.85 }}
                        >
                          <Trash2 size={13} />
                        </motion.button>
                      </div>
                    ) : (
                      <Link href={`/search?region=${encodeURIComponent(booking.region)}&check_in=${booking.checkIn}&check_out=${booking.checkOut}&guests=${booking.guests}`}
                        className="flex items-center gap-2 border border-dashed border-gray-300 px-4 py-3 text-gray-400 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors font-sans text-sm">
                        <Plus size={13} /> Add accommodation
                      </Link>
                    )}

                    {/* Addons */}
                    <AnimatePresence>
                      {booking.addons.map(addon => (
                        <motion.div
                          key={addon.id}
                          className="flex items-center justify-between bg-[#F7F5F2] px-4 py-3"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-[#C9A96E]/20 text-[#9a7840]">{addon.type}</span>
                            <div>
                              <p className="font-sans text-sm font-medium">{addon.title}</p>
                              <p className="font-sans text-xs text-gray-400">
                                {addon.date && `${addon.date} · `}R {addon.price_per_person.toLocaleString()} × {addon.guests}p = R {(addon.price_per_person * addon.guests).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <motion.button
                            onClick={() => booking.removeAddon(addon.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors ml-3"
                            whileTap={{ scale: 0.85 }}
                          >
                            <Trash2 size={13} />
                          </motion.button>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {!booking.shuttle && shuttleRecommendations.length > 0 && (
                      <div className="space-y-2">
                        {shuttleRecommendations.map(shuttle => (
                          <button
                            key={shuttle.id}
                            onClick={() => booking.setShuttle(shuttle)}
                            className="w-full flex items-center justify-between bg-[#2d6a4f]/5 border border-[#2d6a4f]/20 px-4 py-3 text-left hover:border-[#2d6a4f] transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Bus size={13} className="text-[#2d6a4f] shrink-0" />
                              <div>
                                <p className="font-sans text-sm font-medium">Private Transfer Available</p>
                                <p className="font-sans text-xs text-gray-400">{shuttle.label} · {shuttle.date}</p>
                                {shuttle.distanceKm != null && (
                                  <p className="font-sans text-[10px] text-[#2d6a4f]/70 mt-0.5">{shuttle.distanceKm} km · ~{shuttle.durationText} drive</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-display italic text-sm text-[#2d6a4f]">R {shuttle.price.toLocaleString()}</p>
                              <p className="font-sans text-[10px] text-gray-400">Add transfer</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Shuttle */}
                    <AnimatePresence>
                      {booking.shuttle && (
                        <motion.div
                          className="flex items-center justify-between bg-[#F7F5F2] px-4 py-3"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-sans text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 bg-[#2d6a4f]/10 text-[#2d6a4f]">Shuttle</span>
                            <div>
                              <p className="font-sans text-sm font-medium">{booking.shuttle.label}</p>
                              <p className="font-sans text-xs text-gray-400">R {booking.shuttle.price.toLocaleString()}</p>
                            </div>
                          </div>
                          <motion.button
                            onClick={() => booking.setShuttle(null)}
                            className="text-gray-300 hover:text-red-400 transition-colors ml-3"
                            whileTap={{ scale: 0.85 }}
                          >
                            <Trash2 size={13} />
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main bar */}
      <div className="bg-[#1a1a1a] text-white">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-3.5 flex items-center justify-between gap-4 flex-wrap">
          {/* Left: summary */}
          <motion.button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-4 flex-wrap"
            whileTap={{ opacity: 0.7 }}
            transition={{ duration: 0.1 }}
          >
            <div className="flex items-center gap-2">
              <ShoppingBag size={15} className="text-[#C9A96E]" />
              {itemCount > 0 ? (
                <span className="font-sans text-sm">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
              ) : (
                <span className="font-sans text-sm text-white/50">No items yet</span>
              )}
            </div>
            <div className="text-white/30 text-xs">|</div>
            <div className="flex items-center gap-1.5 font-sans text-sm text-white/70">
              <Calendar size={12} className="text-[#C9A96E]" />
              {fmt(booking.checkIn)} → {fmt(booking.checkOut)}
              {booking.nights > 0 && <span className="text-white/40 ml-1">· {booking.nights}n</span>}
            </div>
            {booking.region && (
              <>
                <div className="text-white/30 text-xs">|</div>
                <div className="flex items-center gap-1.5 font-sans text-sm text-white/70">
                  <MapPin size={12} className="text-[#C9A96E]" />
                  {booking.region}
                </div>
              </>
            )}
            {booking.totalPrice > 0 && (
              <>
                <div className="text-white/30 text-xs">|</div>
                <div className="font-display italic text-lg text-[#C9A96E]">
                  R {booking.totalPrice.toLocaleString()}
                </div>
              </>
            )}
            <motion.span
              className="text-white/40"
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            >
              <ChevronUp size={15} />
            </motion.span>
          </motion.button>

          {/* Right: actions */}
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => booking.clearBooking()}
              className="font-sans text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
              whileTap={{ scale: 0.95 }}
            >
              <X size={12} /> Clear
            </motion.button>
            <motion.button
              onClick={handleCheckout}
              className="bg-[#C9A96E] hover:bg-[#b8935e] text-[#1a1a1a] font-sans text-sm font-medium px-6 py-2.5 transition-colors"
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.1 }}
            >
              {!booking.shuttle ? 'Continue →' : 'Go to Checkout →'}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { formatCurrency, calculateNights, calculateServiceFee } from '@/lib/utils'
import { listings as listingsApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface BookingWidgetProps {
  listing: {
    id: string
    price_per_unit: number
    unit_type: string
    max_guests: number
    title: string
  }
}

export default function BookingWidget({ listing }: BookingWidgetProps) {
  const router = useRouter()
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(2)
  const [checking, setChecking] = useState(false)

  const nights = checkIn && checkOut ? calculateNights(checkIn, checkOut) : 0
  const subtotal = listing.price_per_unit * (listing.unit_type === 'per_night' ? nights : guests)
  const serviceFee = calculateServiceFee(subtotal)
  const total = subtotal + serviceFee

  const handleBook = async () => {
    if (!checkIn || !checkOut) { toast.error('Please select dates'); return }
    setChecking(true)
    try {
      const avail = await listingsApi.checkAvailability(listing.id, checkIn, checkOut)
      if (!avail.available) { toast.error('Not available for selected dates'); return }
      router.push(`/checkout?listing_id=${listing.id}&check_in=${checkIn}&check_out=${checkOut}&guests=${guests}&total=${total}`)
    } catch {
      toast.error('Please sign in to book')
      router.push('/auth/login')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sticky top-24">
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-2xl font-bold text-gray-900">{formatCurrency(listing.price_per_unit)}</span>
        <span className="text-gray-500 text-sm">
          {listing.unit_type === 'per_night' ? '/ night' : listing.unit_type === 'per_person' ? '/ person' : '/ group'}
        </span>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
        <div className="grid grid-cols-2 divide-x divide-gray-200">
          <div className="p-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Check in</p>
            <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full text-sm font-medium text-gray-900 outline-none" />
          </div>
          <div className="p-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Check out</p>
            <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
              min={checkIn || new Date().toISOString().split('T')[0]}
              className="w-full text-sm font-medium text-gray-900 outline-none" />
          </div>
        </div>
        <div className="border-t border-gray-200 p-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Guests</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setGuests(g => Math.max(1, g - 1))} className="w-7 h-7 rounded-full border border-gray-300 text-gray-500 hover:border-primary-500 hover:text-primary-500 transition-colors flex items-center justify-center font-bold text-sm">−</button>
            <span className="text-sm font-medium text-gray-900">{guests} guest{guests > 1 ? 's' : ''}</span>
            <button onClick={() => setGuests(g => Math.min(listing.max_guests, g + 1))} className="w-7 h-7 rounded-full border border-gray-300 text-gray-500 hover:border-primary-500 hover:text-primary-500 transition-colors flex items-center justify-center font-bold text-sm">+</button>
          </div>
        </div>
      </div>

      <Button onClick={handleBook} loading={checking} className="w-full" size="lg">
        Book Now
      </Button>

      {nights > 0 && (
        <div className="mt-5 space-y-2.5 border-t border-gray-100 pt-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{formatCurrency(listing.price_per_unit)} × {nights} night{nights > 1 ? 's' : ''}</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Service fee</span>
            <span>{formatCurrency(serviceFee)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 pt-2.5 border-t border-gray-100">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-4">You won&apos;t be charged yet</p>
    </div>
  )
}

'use client'
import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, Users, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import { bookings as bookingsApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { useState } from 'react'

interface Booking {
  id: string
  status: string
  check_in: string
  check_out: string
  guests: number
  total_price: number
  listing: { id: string; title: string; location: string; images: string[] }
}

export function BookingCard({ booking, onCancelled }: { booking: Booking; onCancelled?: () => void }) {
  const [cancelling, setCancelling] = useState(false)
  const image = booking.listing?.images?.[0] ?? 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400'
  const canCancel = ['pending', 'confirmed'].includes(booking.status) && new Date(booking.check_in) > new Date()

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this booking?')) return
    setCancelling(true)
    try {
      await bookingsApi.cancel(booking.id)
      toast.success('Booking cancelled')
      onCancelled?.()
    } catch {
      toast.error('Could not cancel booking')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col sm:flex-row">
      <div className="relative w-full sm:w-44 h-40 sm:h-auto shrink-0">
        <Image src={image} alt={booking.listing?.title ?? ''} fill className="object-cover" />
      </div>
      <div className="p-5 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <Link href={`/listings/${booking.listing?.id}`} className="font-semibold text-gray-900 hover:text-primary-500 transition-colors text-sm leading-snug">
              {booking.listing?.title}
            </Link>
            <Badge className={getStatusColor(booking.status)} variant="neutral">
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Badge>
          </div>
          {booking.listing?.location && (
            <div className="flex items-center gap-1 mt-1 text-gray-400 text-xs">
              <MapPin className="h-3 w-3" />{booking.listing.location}
            </div>
          )}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <span>{formatDate(booking.check_in)} – {formatDate(booking.check_out)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-gray-400" />
              <span>{booking.guests} guest{booking.guests > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="font-bold text-gray-900">{formatCurrency(booking.total_price)}</span>
          {canCancel && (
            <Button variant="danger" size="sm" onClick={handleCancel} loading={cancelling}>
              Cancel booking
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

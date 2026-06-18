'use client';

import { useState } from 'react';
import Link from 'next/link';

type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';

interface Booking {
  id: string;
  listing: string;
  location: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  status: BookingStatus;
}

const sampleBookings: Booking[] = [
  {
    id: 'BK001',
    listing: 'Cathedral Peak Mountain Lodge',
    location: 'Cathedral Peak, Northern Berg',
    checkIn: '15 Jul 2024',
    checkOut: '18 Jul 2024',
    guests: 2,
    total: 8214,
    status: 'confirmed',
  },
  {
    id: 'BK002',
    listing: 'Sani Pass Adventure Camp',
    location: 'Sani Pass, Southern Berg',
    checkIn: '22 Jun 2024',
    checkOut: '24 Jun 2024',
    guests: 4,
    total: 3360,
    status: 'completed',
  },
  {
    id: 'BK003',
    listing: 'Berg Valley Guesthouse',
    location: 'Champagne Valley',
    checkIn: '10 Apr 2024',
    checkOut: '12 Apr 2024',
    guests: 2,
    total: 2940,
    status: 'completed',
  },
  {
    id: 'BK004',
    listing: 'Royal Natal Eco Cabin',
    location: 'Royal Natal Park',
    checkIn: '5 Mar 2024',
    checkOut: '7 Mar 2024',
    guests: 3,
    total: 1950,
    status: 'cancelled',
  },
];

const STATUS_STYLES: Record<BookingStatus, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-700',
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>(sampleBookings);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = (id: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b))
    );
    setCancellingId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2D6A4F] text-white py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard" className="text-green-200 hover:text-white text-sm">
              ← Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold">My Bookings</h1>
          <p className="text-green-100 text-sm mt-1">
            All your past and upcoming Drakensberg bookings
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Summary pills */}
        <div className="flex flex-wrap gap-3 mb-6">
          {(['all', 'confirmed', 'completed', 'pending', 'cancelled'] as const).map((s) => {
            const count =
              s === 'all' ? bookings.length : bookings.filter((b) => b.status === s).length;
            return (
              <span
                key={s}
                className="text-sm bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-600"
              >
                <span className="capitalize">{s}</span>
                <span className="ml-1.5 bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full text-xs">
                  {count}
                </span>
              </span>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Listing
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Dates
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Guests
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Total
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-800">{booking.listing}</p>
                      <p className="text-xs text-gray-500">{booking.location}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">#{booking.id}</p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <p className="text-gray-700">{booking.checkIn}</p>
                      <p className="text-gray-400 text-xs">to {booking.checkOut}</p>
                    </td>
                    <td className="px-4 py-4 text-gray-700">{booking.guests}</td>
                    <td className="px-4 py-4 font-medium text-gray-800">
                      R{booking.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[booking.status]}`}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/listings/1`}
                          className="text-xs text-[#2D6A4F] underline hover:no-underline"
                        >
                          View
                        </Link>
                        {booking.status === 'confirmed' && (
                          <button
                            onClick={() => handleCancel(booking.id)}
                            className="text-xs text-red-500 underline hover:no-underline"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import StatsCard from '@/components/dashboard/StatsCard';
import BookingTable from '@/components/dashboard/BookingTable';

const recentBookings = [
  {
    id: 'BK001',
    guest: 'Sarah van der Merwe',
    listing: 'Cathedral Peak Mountain Lodge',
    checkIn: '15 Jul 2024',
    checkOut: '18 Jul 2024',
    guests: 2,
    total: 8214,
    status: 'confirmed' as const,
  },
  {
    id: 'BK002',
    guest: 'James Fourie',
    listing: 'Cathedral Peak Mountain Lodge',
    checkIn: '22 Jun 2024',
    checkOut: '25 Jun 2024',
    guests: 4,
    total: 12320,
    status: 'completed' as const,
  },
  {
    id: 'BK003',
    guest: 'Priya Naidoo',
    listing: 'Berg Valley Guesthouse',
    checkIn: '10 Jul 2024',
    checkOut: '12 Jul 2024',
    guests: 2,
    total: 2940,
    status: 'pending' as const,
  },
  {
    id: 'BK004',
    guest: 'Lindiwe Dlamini',
    listing: 'Cathedral Peak Mountain Lodge',
    checkIn: '1 Aug 2024',
    checkOut: '4 Aug 2024',
    guests: 6,
    total: 18500,
    status: 'confirmed' as const,
  },
  {
    id: 'BK005',
    guest: 'Mike Peterson',
    listing: 'Berg Valley Guesthouse',
    checkIn: '15 May 2024',
    checkOut: '17 May 2024',
    guests: 2,
    total: 2940,
    status: 'cancelled' as const,
  },
];

export default function SupplierDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#2D6A4F] text-white py-10 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Supplier Dashboard</h1>
            <p className="text-green-100 text-sm mt-1">Manage your listings, bookings and earnings</p>
          </div>
          <Link
            href="/supplier/listings/new"
            className="bg-white text-[#2D6A4F] px-4 py-2 rounded-lg font-medium text-sm hover:bg-green-50 transition-colors"
          >
            + New Listing
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            title="Total Earnings"
            value="R44,914"
            icon="💰"
            trend={{ value: 18, label: 'vs last month', positive: true }}
          />
          <StatsCard
            title="Active Listings"
            value={2}
            icon="🏡"
            trend={{ value: 0, label: 'no change', positive: true }}
          />
          <StatsCard
            title="Bookings This Month"
            value={4}
            icon="📅"
            trend={{ value: 33, label: 'vs last month', positive: true }}
          />
          <StatsCard
            title="Avg Rating"
            value="4.8 ★"
            icon="⭐"
            trend={{ value: 2, label: 'improvement', positive: true }}
          />
        </div>

        {/* Recent Bookings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Recent Bookings</h2>
            <Link href="/supplier/listings" className="text-sm text-[#2D6A4F] underline">
              View all listings
            </Link>
          </div>
          <BookingTable bookings={recentBookings} />
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'My Listings', href: '/supplier/listings', icon: '🏡' },
              { label: 'Add Listing', href: '/supplier/listings/new', icon: '➕' },
              { label: 'Earnings', href: '#', icon: '💰' },
              { label: 'Settings', href: '#', icon: '⚙️' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-[#2D6A4F] transition-colors"
              >
                <span className="text-2xl block mb-1">{item.icon}</span>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookingCard } from '@/components/booking/BookingCard';

const TABS = ['Overview', 'Bookings', 'Profile'];

const upcomingBooking = {
  id: 'b1',
  listing: 'Cathedral Peak Mountain Lodge',
  location: 'Cathedral Peak, Northern Berg',
  check_in: '2025-07-15',
  check_out: '2025-07-18',
  guests: 2,
  total_price: 8214,
  status: 'confirmed' as const,
  image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('Overview');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#2D6A4F] text-white py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold">Welcome back, Sarah 👋</h1>
          <p className="text-green-100 text-sm mt-1">Manage your bookings and account settings</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-[#2D6A4F] text-[#2D6A4F]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'Overview' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Upcoming Trips</p>
                <p className="text-3xl font-bold text-[#2D6A4F] mt-1">1</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Past Bookings</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">3</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Spent</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">R24,680</p>
              </div>
            </div>

            {/* Upcoming Booking */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Upcoming Booking</h2>
              <BookingCard booking={upcomingBooking} />
            </div>

            {/* Quick Links */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Quick Links</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Browse Stays', href: '/stays', icon: '🏡' },
                  { label: 'Activities', href: '/activities', icon: '🧗' },
                  { label: 'Hike Trails', href: '/hikes', icon: '🥾' },
                  { label: 'Packages', href: '/packages', icon: '🎁' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center hover:border-[#2D6A4F] transition-colors"
                  >
                    <span className="text-2xl block mb-1">{link.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'Bookings' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">All Bookings</h2>
              <Link
                href="/dashboard/bookings"
                className="text-sm text-[#2D6A4F] underline"
              >
                View full table
              </Link>
            </div>
            <BookingCard booking={upcomingBooking} />
            <p className="text-sm text-gray-500 mt-4 text-center">
              + 3 past bookings.{' '}
              <Link href="/dashboard/bookings" className="text-[#2D6A4F] underline">
                View all
              </Link>
            </p>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'Profile' && (
          <div className="bg-white rounded-xl p-6 shadow-sm max-w-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Profile Settings</h2>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-[#2D6A4F] rounded-full flex items-center justify-center text-white text-2xl font-bold">
                S
              </div>
              <div>
                <p className="font-medium text-gray-800">Sarah van der Merwe</p>
                <p className="text-sm text-gray-500">sarah@example.com</p>
              </div>
              <button className="ml-auto text-sm text-[#2D6A4F] underline">Change photo</button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Full Name', value: 'Sarah van der Merwe' },
                { label: 'Email', value: 'sarah@example.com' },
                { label: 'Phone', value: '+27 82 555 1234' },
                { label: 'Member since', value: 'January 2023' },
              ].map((field) => (
                <div key={field.label}>
                  <label className="block text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                    {field.label}
                  </label>
                  <div className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2.5">
                    <span className="text-sm text-gray-800">{field.value}</span>
                    <button className="text-xs text-[#2D6A4F]">Edit</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-6 w-full bg-[#2D6A4F] text-white py-2.5 rounded-lg font-medium hover:bg-[#245a42] transition-colors">
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
